/**
 * rv32if.js — Simulateur RISC-V RV32I + F (IEEE 754 single)
 *
 * Régions mémoire (buffer plat 12 MB) :
 *   TEXT  0x00400000..0x004FFFFF  → offset 0x000000  (1 MB)
 *   DATA  0x10000000..0x107FFFFF  → offset 0x100000  (8 MB)  couvre data + FB
 *   STACK 0x7FF00000..0x7FFFFFFF  → offset 0x900000  (1 MB)
 *
 * Syscalls RARS supportés :
 *   a7=1   print int (debug)
 *   a7=2   print float (debug)
 *   a7=4   print string (debug)
 *   a7=10  exit
 *   a7=30  time → Date.now() dans a0
 *   a7=35  rand int [a0..a1] → a0
 */

"use strict";

const TEXT_BASE  = 0x00400000;
const DATA_BASE  = 0x10000000;   // base large pour couvrir 0x10008000 et 0x10010000
const STACK_BASE = 0x7FF00000;
const FB_BASE    = 0x10010000;   // framebuffer : DATA_BASE + 0x10000

const BUF_TEXT  = 0x000000;      // offset dans le buffer
const BUF_DATA  = 0x100000;
const BUF_STACK = 0x900000;
const BUF_SIZE  = 0xA00000;      // 10 MB

export class RV32IF {
    constructor() {
        this.buf  = new ArrayBuffer(BUF_SIZE);
        this._dv  = new DataView(this.buf);
        this.x    = new Int32Array(32);
        this.f    = new Float32Array(32);
        this.pc   = TEXT_BASE;
        this.running = false;
        this.onExit  = null;
        this.onError = null;
    }

    // ── Mapping adresse → offset dans le buffer ───────────────────────────────

    _off(a) {
        a = a >>> 0;
        if (a >= 0x00400000 && a < 0x00500000) return BUF_TEXT  + (a - 0x00400000);
        if (a >= 0x10000000 && a < 0x10800000) return BUF_DATA  + (a - 0x10000000);
        if (a >= 0x7FF00000)                   return BUF_STACK + (a - 0x7FF00000);
        throw new Error(`Adresse non mappée : 0x${a.toString(16).padStart(8,'0')}  PC=0x${this.pc.toString(16)}`);
    }

    // ── Accès mémoire ─────────────────────────────────────────────────────────

    r8 (a) { return this._dv.getUint8 (this._off(a)); }
    r8s(a) { return this._dv.getInt8  (this._off(a)); }
    r16(a) { return this._dv.getUint16(this._off(a), true); }
    r16s(a){ return this._dv.getInt16 (this._off(a), true); }
    r32(a) { return this._dv.getInt32 (this._off(a), true); }
    r32u(a){ return this._dv.getUint32(this._off(a), true); }
    w8 (a,v){ this._dv.setUint8 (this._off(a), v); }
    w16(a,v){ this._dv.setUint16(this._off(a), v, true); }
    w32(a,v){ this._dv.setInt32 (this._off(a), v, true); }
    rf32(a) { return this._dv.getFloat32(this._off(a), true); }
    wf32(a,v){ this._dv.setFloat32(this._off(a), v, true); }

    // ── Float helpers ─────────────────────────────────────────────────────────

    _fget(i)   { return this.f[i]; }
    _fset(i,v) { this.f[i] = Math.fround(v); }

    _bits2f(b) {
        const tmp = new ArrayBuffer(4);
        new Int32Array(tmp)[0] = b;
        return new Float32Array(tmp)[0];
    }
    _f2bits(f) {
        const tmp = new ArrayBuffer(4);
        new Float32Array(tmp)[0] = f;
        return new Int32Array(tmp)[0];
    }

    // ── Chargement binaire ────────────────────────────────────────────────────

    load(textBytes, dataBytes) {
        // Reset complet
        new Uint8Array(this.buf).fill(0);
        this.x.fill(0);
        this.f.fill(0);
        this.pc      = TEXT_BASE;
        this.running = false;

        // sp = valeur par défaut RARS
        this.x[2] = 0x7FFFEFFC | 0;

        // Copie text segment
        const u8 = new Uint8Array(this.buf);
        for (let i = 0; i < textBytes.length; i++)
            u8[BUF_TEXT + i] = textBytes[i];

        // Le serveur produit le dump avec une plage explicite 0x10008000-0x10010000
        // (assemble-only). Premier octet du dump = adresse 0x10008000.
        // Donc on charge à BUF_DATA + (0x10008000 - DATA_BASE) = BUF_DATA + 0x8000.
        const dataOff = BUF_DATA + (0x10008000 - DATA_BASE);
        for (let i = 0; i < dataBytes.length; i++)
            u8[dataOff + i] = dataBytes[i];
    }

    // ── Décodage et exécution d'une instruction ───────────────────────────────

    step() {
        const ir  = this.r32u(this.pc);
        const op  = ir & 0x7F;
        const rd  = (ir >>> 7)  & 0x1F;
        const fn3 = (ir >>> 12) & 0x07;
        const rs1 = (ir >>> 15) & 0x1F;
        const rs2 = (ir >>> 20) & 0x1F;
        const fn7 = (ir >>> 25) & 0x7F;
        const x   = this.x;

        // Décodage immédiat
        const imm_i = (ir & 0x80000000) ? ((ir >> 20) | 0xFFFFF000) : (ir >> 20);
        const imm_s = ((ir >> 7) & 0x1F) | (((ir >> 25) & 0x7F) << 5) |
                      ((ir & 0x80000000) ? 0xFFFFF000 : 0);
        const imm_b = (((ir >>> 8)  & 0x0F) << 1)  |
                      (((ir >>> 25) & 0x3F) << 5)  |
                      (((ir >>> 7)  & 0x01) << 11) |
                      ((ir & 0x80000000) ? 0xFFFFF000 : 0);
        const imm_u = ir & 0xFFFFF000;
        const imm_j = (((ir >>> 21) & 0x3FF) << 1)  |
                      (((ir >>> 20) & 0x001) << 11) |
                      (((ir >>> 12) & 0x0FF) << 12) |
                      ((ir & 0x80000000) ? 0xFFF00000 : 0);

        let npc = (this.pc + 4) | 0;

        switch (op) {

        case 0x37: // LUI
            if (rd) x[rd] = imm_u;
            break;

        case 0x17: // AUIPC
            if (rd) x[rd] = (this.pc + imm_u) | 0;
            break;

        case 0x6F: // JAL
            if (rd) x[rd] = npc;
            npc = (this.pc + imm_j) | 0;
            break;

        case 0x67: // JALR
            { const t = npc;
              npc = (x[rs1] + imm_i) & ~1;
              if (rd) x[rd] = t; }
            break;

        case 0x63: // BRANCH
            { let t = false;
              const u1 = x[rs1] >>> 0, u2 = x[rs2] >>> 0;
              switch (fn3) {
                case 0: t = x[rs1] === x[rs2]; break;
                case 1: t = x[rs1] !== x[rs2]; break;
                case 4: t = x[rs1]  <  x[rs2]; break;
                case 5: t = x[rs1]  >= x[rs2]; break;
                case 6: t = u1 < u2; break;
                case 7: t = u1 >= u2; break;
              }
              if (t) npc = (this.pc + imm_b) | 0;
            }
            break;

        case 0x03: // LOAD
            { const addr = (x[rs1] + imm_i) | 0;
              let v;
              switch (fn3) {
                case 0: v = this.r8s(addr); break;
                case 1: v = this.r16s(addr); break;
                case 2: v = this.r32(addr); break;
                case 4: v = this.r8(addr); break;
                case 5: v = this.r16(addr); break;
                default: v = 0;
              }
              if (rd) x[rd] = v;
            }
            break;

        case 0x23: // STORE
            { const addr = (x[rs1] + imm_s) | 0;
              switch (fn3) {
                case 0: this.w8(addr,  x[rs2]); break;
                case 1: this.w16(addr, x[rs2]); break;
                case 2: this.w32(addr, x[rs2]); break;
              }
            }
            break;

        case 0x13: // OP-IMM
            { let v = 0;
              const shamt = (ir >>> 20) & 0x1F;
              switch (fn3) {
                case 0: v = (x[rs1] + imm_i) | 0; break;
                case 1: v = x[rs1] << shamt; break;
                case 2: v = (x[rs1] < imm_i) ? 1 : 0; break;
                case 3: v = ((x[rs1]>>>0) < (imm_i>>>0)) ? 1 : 0; break;
                case 4: v = x[rs1] ^ imm_i; break;
                case 5: v = fn7 ? (x[rs1] >> shamt) : (x[rs1] >>> shamt); break;
                case 6: v = x[rs1] | imm_i; break;
                case 7: v = x[rs1] & imm_i; break;
              }
              if (rd) x[rd] = v;
            }
            break;

        case 0x33: // OP (RV32I + M extension)
            { let v = 0;
              if (fn7 === 1) { // M extension
                switch (fn3) {
                  case 0: v = Math.imul(x[rs1], x[rs2]); break;
                  case 1: { const a=BigInt(x[rs1]),b=BigInt(x[rs2]); v=Number((a*b)>>32n)|0; break; }
                  case 2: { const a=BigInt(x[rs1]),b=BigInt(x[rs2]>>>0); v=Number((a*b)>>32n)|0; break; }
                  case 3: { const a=BigInt(x[rs1]>>>0),b=BigInt(x[rs2]>>>0); v=Number((a*b)>>32n)|0; break; }
                  case 4: v = x[rs2] ? ((x[rs1]/x[rs2])|0) : -1; break;
                  case 5: v = x[rs2] ? (((x[rs1]>>>0)/(x[rs2]>>>0))|0) : 0xFFFFFFFF; break;
                  case 6: v = x[rs2] ? ((x[rs1]%x[rs2])|0) : x[rs1]; break;
                  case 7: v = x[rs2] ? (((x[rs1]>>>0)%(x[rs2]>>>0))|0) : x[rs1]; break;
                }
              } else {
                switch (fn3) {
                  case 0: v = fn7 ? ((x[rs1]-x[rs2])|0) : ((x[rs1]+x[rs2])|0); break;
                  case 1: v = x[rs1] << (x[rs2]&0x1F); break;
                  case 2: v = (x[rs1] < x[rs2]) ? 1 : 0; break;
                  case 3: v = ((x[rs1]>>>0) < (x[rs2]>>>0)) ? 1 : 0; break;
                  case 4: v = x[rs1] ^ x[rs2]; break;
                  case 5: v = fn7 ? (x[rs1]>>(x[rs2]&0x1F)) : (x[rs1]>>>(x[rs2]&0x1F)); break;
                  case 6: v = x[rs1] | x[rs2]; break;
                  case 7: v = x[rs1] & x[rs2]; break;
                }
              }
              if (rd) x[rd] = v;
            }
            break;

        case 0x0F: break; // FENCE → NOP

        case 0x73: // ECALL / EBREAK
            if ((ir >>> 20) === 0) this._ecall();
            else if ((ir >>> 20) === 1) throw new Error(`EBREAK  IR=0x${ir.toString(16).padStart(8,'0')}  PC=0x${this.pc.toString(16)}`);
            break;

        // ── F extension ──────────────────────────────────────────────────────

        case 0x07: // FLW
            if (fn3 === 2) this._fset(rd, this.rf32((x[rs1] + imm_i)|0));
            break;

        case 0x27: // FSW
            if (fn3 === 2) this.wf32((x[rs1] + imm_s)|0, this._fget(rs2));
            break;

        case 0x43: { const rs3=(ir>>>27)&0x1F; this._fset(rd, this._fget(rs1)*this._fget(rs2)+this._fget(rs3)); break; } // FMADD
        case 0x47: { const rs3=(ir>>>27)&0x1F; this._fset(rd, this._fget(rs1)*this._fget(rs2)-this._fget(rs3)); break; } // FMSUB
        case 0x4B: { const rs3=(ir>>>27)&0x1F; this._fset(rd,-(this._fget(rs1)*this._fget(rs2))+this._fget(rs3)); break; } // FNMSUB
        case 0x4F: { const rs3=(ir>>>27)&0x1F; this._fset(rd,-(this._fget(rs1)*this._fget(rs2))-this._fget(rs3)); break; } // FNMADD

        case 0x53: // OP-FP
            this._op_fp(fn7, rs1, rs2, rd, fn3);
            break;

        default:
            throw new Error(`Opcode inconnu : 0x${op.toString(16).padStart(2,'0')}  IR=0x${ir.toString(16).padStart(8,'0')}  PC=0x${this.pc.toString(16)}`);
        }

        x[0]    = 0;        // x0 toujours zéro
        this.pc = npc;
    }

    // ── Instructions flottantes ───────────────────────────────────────────────

    _op_fp(fn7, rs1, rs2, rd, fn3) {
        const a = this._fget(rs1), b = this._fget(rs2);
        const x = this.x;
        switch (fn7) {
          case 0x00: this._fset(rd, a + b); break;                           // FADD.S
          case 0x04: this._fset(rd, a - b); break;                           // FSUB.S
          case 0x08: this._fset(rd, a * b); break;                           // FMUL.S
          case 0x0C: this._fset(rd, a / b); break;                           // FDIV.S
          case 0x2C: this._fset(rd, Math.fround(Math.sqrt(a))); break;       // FSQRT.S
          case 0x10: // FSGNJ.S / FSGNJN.S / FSGNJX.S
            { const signB = (this._f2bits(b) >>> 31) & 1;
              const signA = (this._f2bits(a) >>> 31) & 1;
              let bitsA   = this._f2bits(a) & 0x7FFFFFFF; // mantissa+exp sans signe
              let newSign;
              if      (fn3 === 0) newSign = signB;
              else if (fn3 === 1) newSign = signB ^ 1;
              else                newSign = signA ^ signB;  // FSGNJX
              this._fset(rd, this._bits2f((newSign << 31) | bitsA));
            } break;
          case 0x14: // FMIN.S / FMAX.S
            if (fn3 === 0) this._fset(rd, (a <= b || isNaN(b)) ? a : b);
            else           this._fset(rd, (a >= b || isNaN(b)) ? a : b);
            break;
          case 0x60: // FCVT.W.S / FCVT.WU.S
            { const t = isNaN(a) ? 0 : Math.trunc(a);
              if (rd) x[rd] = (rs2 === 0) ? (t | 0) : (t >>> 0); }
            break;
          case 0x50: // FEQ.S / FLT.S / FLE.S
            if (rd) x[rd] = (fn3===2) ? (a===b?1:0) : (fn3===1) ? (a<b?1:0) : (a<=b?1:0);
            break;
          case 0x70: // FMV.X.W (fn3=0) / FCLASS (fn3=1)
            if (fn3 === 0 && rd) x[rd] = this._f2bits(a);
            break;
          case 0x68: // FCVT.S.W / FCVT.S.WU
            this._fset(rd, (rs2===0) ? Math.fround(x[rs1]) : Math.fround(x[rs1]>>>0));
            break;
          case 0x78: // FMV.W.X
            this._fset(rd, this._bits2f(x[rs1]));
            break;
        }
    }

    // ── Syscalls ─────────────────────────────────────────────────────────────

    _ecall() {
        switch (this.x[17]) {
          case 10: // exit
            this.running = false;
            if (this.onExit) this.onExit();
            break;
          case 30: // time
            this.x[10] = (Date.now() & 0x7FFFFFFF) | 0;
            break;
          case 35: // random int [a0..a1]
            { const lo = this.x[10], hi = this.x[11];
              this.x[10] = (Math.random() * (hi - lo) + lo) | 0; }
            break;
          case 1:  console.log("[rv32i]", this.x[10]); break;
          case 2:  console.log("[rv32f]", this.f[10]); break;
          case 4:  { let s="",a=this.x[10]>>>0; try{while(true){const c=this.r8(a++);if(!c)break;s+=String.fromCharCode(c);}}catch(e){} console.log("[rv32s]",s); break; }
          default: break; // syscall inconnu → ignoré
        }
    }

    // ── Framebuffer → ImageData RGBA ─────────────────────────────────────────

    getFramebuffer(w, h) {
        const n    = w * h;
        const rgba = new Uint8ClampedArray(n * 4);
        const fbOff = BUF_DATA + (FB_BASE - DATA_BASE);   // offset dans le buffer
        const dv    = this._dv;
        for (let i = 0; i < n; i++) {
            const o = fbOff + i * 4;
            rgba[i*4+0] = dv.getUint8(o + 2); // R  (format RARS : 0x00RRGGBB LE → [BB,GG,RR,00])
            rgba[i*4+1] = dv.getUint8(o + 1); // G
            rgba[i*4+2] = dv.getUint8(o + 0); // B
            rgba[i*4+3] = 255;
        }
        return rgba;
    }

    // ── Lancement synchrone ───────────────────────────────────────────────────

    runSync(maxSteps = 20_000_000) {
        this.running = true;
        let steps = 0;
        try {
            while (this.running && steps < maxSteps) {
                this.step();
                steps++;
            }
        } catch(e) {
            this.running = false;
            if (this.onError) this.onError(e.message);
        }
        return { done: !this.running, steps };
    }

    // ── Lancement asynchrone (non-bloquant) ───────────────────────────────────

    runAsync(onFrame, maxSteps = 500_000_000, chunkSize = 200_000) {
        this.running = true;
        let total = 0;

        const tick = () => {
            if (!this.running || total >= maxSteps) {
                onFrame();
                return;
            }

            let steps = 0;
            try {
                while (this.running && steps < chunkSize) {
                    this.step();
                    steps++;
                }
            } catch(e) {
                this.running = false;
                if (this.onError) this.onError(e.message);
                onFrame();
                return;
            }

            total += steps;
            onFrame();
            if (this.running) setTimeout(tick, 0);
        };

        setTimeout(tick, 0);
    }
}
