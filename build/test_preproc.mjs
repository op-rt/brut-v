// Headless test for the preprocessor. Run: node build/test_preproc.mjs
//
// This intentionally mirrors what a browser would do: it imports assembler.js
// (which itself imports core-fs.js), then exercises a few representative
// sketches. We don't depend on RARS for this stage — we only check that the
// preprocessor produces expanded output without crashing and that a few key
// substitutions happened (.eqv resolved, macros expanded).

import { assemble } from "../assembler.js";
import { CORE_FILES } from "../core-fs.js";
import fs from "node:fs";
import path from "node:path";

const SKETCHES_DIR = path.resolve("..", "sketches");

function check(label, cond, detail = "") {
    const tag = cond ? "PASS" : "FAIL";
    console.log(`[${tag}] ${label}${detail ? "  — " + detail : ""}`);
    if (!cond) process.exitCode = 1;
}

// ── Test 1: a tiny inline source covering .include / .eqv / a simple macro ──
{
    const src = `
.include "../core/core.s"
.text
.globl setup
setup:
    ISIZE 512, 512
    NO_STROKE
    IFILL BLACK
    IRECT 10, 20, 30, 40
    ret
`;
    const r = assemble(src);
    check("inline sketch — no errors", r.errors.length === 0, r.errors.join(" | "));
    check("inline sketch — produced lines", r.lines.length > 0);

    // ISIZE expands to: li a0, 512 / li a1, 512 / __CALL_SAFE size which itself
    // expands to addi sp,sp,-16 / sw ra,12(sp) / call size / lw ra,12(sp) / addi sp,sp,16
    const flat = r.lines.map(l => l.text.trim()).join("\n");
    check("ISIZE expanded — li a0, 512 present",
        /\bli\s+a0,\s*512\b/.test(flat));
    check("ISIZE expanded — call size present",
        /\bcall\s+size\b/.test(flat));
    check("__CALL_SAFE inner expanded — sw ra, 12(sp)",
        /\bsw\s+ra,\s*12\(sp\)/.test(flat));

    // .eqv BLACK 0x00000000 should be applied AFTER macro expansion.
    check("IFILL BLACK — BLACK substituted to 0x00000000",
        /\bli\s+a0,\s*0x00000000\b/.test(flat));

    // IRECT 10, 20, 30, 40 → li a0, 10 / li a1, 20 / ...
    check("IRECT expanded — li a3, 40 present",
        /\bli\s+a3,\s*40\b/.test(flat));
}

// ── Test 2: each existing sketch must preprocess without error ─────────────
const sketches = fs.readdirSync(SKETCHES_DIR)
    .filter(n => n.endsWith(".asm"));

let okCount = 0, failCount = 0;
for (const name of sketches) {
    const src = fs.readFileSync(path.join(SKETCHES_DIR, name), "utf8");
    const r = assemble(src, { mainName: name });
    if (r.errors.length) {
        console.log(`[FAIL] sketch ${name}: ${r.errors.join(" | ")}`);
        failCount++;
        process.exitCode = 1;
    } else {
        okCount++;
    }
}
console.log(`\nSketches preprocessed: ${okCount} ok, ${failCount} failed.`);

// ── Test 3: nested macros (__CALL_SAFE called from many other macros) ──────
{
    const src = `
.include "../core/core.s"
.text
.globl setup
setup:
    ICIRCLE 256, 256, 100
    PUSH_MATRIX
    IROTATE 0x40490fdb
    POP_MATRIX
    ret
`;
    const r = assemble(src);
    check("nested macros — no errors", r.errors.length === 0, r.errors.join(" | "));
    const flat = r.lines.map(l => l.text.trim()).join("\n");
    // ICIRCLE → li a0, 256 / li a1, 256 / li a2, 100 / __CALL_SAFE circle
    check("ICIRCLE — li a2, 100",
        /\bli\s+a2,\s*100\b/.test(flat));
    check("ICIRCLE — call circle (via __CALL_SAFE)",
        /\bcall\s+circle\b/.test(flat));
    // PUSH_MATRIX → __CALL_SAFE pushMatrix
    check("PUSH_MATRIX → call pushMatrix",
        /\bcall\s+pushMatrix\b/.test(flat));
    // IROTATE expands further: it uses fmv.w.x then __CALL_SAFE rotate
    check("IROTATE — fmv.w.x fa0, t0",
        /fmv\.w\.x\s+fa0,\s*t0\b/.test(flat));
    check("IROTATE — call rotate",
        /\bcall\s+rotate\b/.test(flat));
}

console.log(`\nDone. exit code: ${process.exitCode ?? 0}`);
