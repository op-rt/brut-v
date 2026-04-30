// Assemble a sketch with both the JS assembler and RARS, then diff the bytes.
//
// Usage: node build/test_against_rars.mjs [sketch.asm]
//
// Default sketch: pattern.asm.

import { assemble } from "../assembler.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RARS_JAR = String.raw`C:\Users\Louis\Downloads\rars1_6.jar`;
const SKETCHES = path.resolve("..", "sketches");

const target = process.argv[2] ?? "pattern.asm";
const src = fs.readFileSync(path.join(SKETCHES, target), "utf8");

// ── JS path ──
const t0 = process.hrtime.bigint();
const r = assemble(src, { mainName: target });
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
if (r.errors.length) { console.error("JS errors:", r.errors); process.exit(1); }
console.log(`[js]   ${target}: text ${r.text.length} B, data ${r.data.length} B (dataBase=${"0x"+r.dataBase.toString(16)}), in ${ms.toFixed(1)}ms`);

// ── RARS path ──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brutv_cmp_"));
const sketchDir = path.join(tmp, "sketches");
fs.mkdirSync(sketchDir);
fs.writeFileSync(path.join(sketchDir, target), src);
fs.cpSync(path.resolve("..", "core"), path.join(tmp, "core"), { recursive: true });

const textPath = path.join(tmp, "text.bin");
const dataPath = path.join(tmp, "data.bin");

execFileSync("java", ["-jar", RARS_JAR, "nc", "a",
    "dump", ".text",                     "Binary", textPath,
    "dump", "0x10008000-0x10010000",     "Binary", dataPath,
    path.join(sketchDir, target)],
    { stdio: ["ignore", "pipe", "pipe"] });

const rarsText = fs.readFileSync(textPath);
const rarsData = fs.existsSync(dataPath) ? fs.readFileSync(dataPath) : Buffer.alloc(0);
console.log(`[rars] ${target}: text ${rarsText.length} B, data ${rarsData.length} B`);

// ── Compare ──
function diff(a, b, label) {
    const n = Math.max(a.length, b.length);
    const diffs = [];
    for (let i = 0; i < n; i++) {
        const av = a[i] ?? -1, bv = b[i] ?? -1;
        if (av !== bv) {
            diffs.push({ off: i, js: av, rars: bv });
            if (diffs.length >= 8) break;
        }
    }
    if (diffs.length === 0 && a.length === b.length) {
        console.log(`✅ ${label} matches (${a.length} B)`);
        return true;
    }
    console.log(`❌ ${label} differs: js=${a.length} B vs rars=${b.length} B`);
    for (const d of diffs) {
        const jh = d.js  >= 0 ? d.js .toString(16).padStart(2,"0") : "??";
        const rh = d.rars>= 0 ? d.rars.toString(16).padStart(2,"0") : "??";
        console.log(`  off ${d.off.toString(16).padStart(4,"0")}: js=${jh}  rars=${rh}`);
    }
    return false;
}

let ok = true;
ok = diff(r.text, rarsText, ".text") && ok;
ok = diff(r.data, rarsData, ".data") && ok;

// Show first diverging instruction in disassembled form-ish.
if (!ok && r.text.length === rarsText.length) {
    for (let i = 0; i < r.text.length; i += 4) {
        const j = (r.text[i] | (r.text[i+1]<<8) | (r.text[i+2]<<16) | (r.text[i+3]<<24)) >>> 0;
        const k = (rarsText[i] | (rarsText[i+1]<<8) | (rarsText[i+2]<<16) | (rarsText[i+3]<<24)) >>> 0;
        if (j !== k) {
            const pc = 0x00400000 + i;
            console.log(`first text divergence at PC=${"0x"+pc.toString(16)}: js=${"0x"+j.toString(16).padStart(8,"0")}  rars=${"0x"+k.toString(16).padStart(8,"0")}`);
            break;
        }
    }
}

process.exit(ok ? 0 : 1);
