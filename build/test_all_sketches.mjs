// Run every sketch through both the JS assembler and RARS and report any
// byte-level differences. We treat data-segment trailing zeros as harmless
// (RARS pads to 0x3000; we stop at the last emitted byte).

import { assemble } from "../assembler.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RARS_JAR = String.raw`C:\Users\Louis\Downloads\rars1_6.jar`;
const SKETCHES = path.resolve("..", "sketches");

const tmpRoot   = fs.mkdtempSync(path.join(os.tmpdir(), "brutv_all_"));
const sketches  = fs.readdirSync(SKETCHES).filter(n => n.endsWith(".asm")).sort();

let textOk = 0, textBad = 0, dataOk = 0, dataBad = 0;
const failures = [];

for (const name of sketches) {
    const src = fs.readFileSync(path.join(SKETCHES, name), "utf8");
    let r;
    try { r = assemble(src, { mainName: name }); }
    catch (e) { console.log(`✗ ${name}: JS crash ${e.message}`); textBad++; failures.push({name, why: "js crash"}); continue; }
    if (r.errors.length) { console.log(`✗ ${name}: JS error ${r.errors.join("|")}`); textBad++; failures.push({name, why: "js error"}); continue; }

    // RARS path
    const work = path.join(tmpRoot, name.replace(/\W/g, "_"));
    fs.mkdirSync(work);
    const sketchDir = path.join(work, "sketches");
    fs.mkdirSync(sketchDir);
    fs.writeFileSync(path.join(sketchDir, name), src);
    fs.cpSync(path.resolve("..", "core"), path.join(work, "core"), { recursive: true });
    const tp = path.join(work, "t.bin"), dp = path.join(work, "d.bin");
    try {
        execFileSync("java", ["-jar", RARS_JAR, "nc", "a",
            "dump", ".text",                 "Binary", tp,
            "dump", "0x10008000-0x10010000", "Binary", dp,
            path.join(sketchDir, name)],
            { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
        console.log(`✗ ${name}: RARS failed`);
        textBad++; failures.push({name, why: "rars failed"}); continue;
    }
    const rt = fs.readFileSync(tp);
    const rd = fs.existsSync(dp) ? fs.readFileSync(dp) : Buffer.alloc(0);

    // Compare text byte-for-byte.
    const textMatch = r.text.length === rt.length &&
        Buffer.compare(Buffer.from(r.text), rt) === 0;
    // Compare data, ignoring trailing zeros on either side. RARS truncates
    // its dump at a 4 KB page boundary; we extend past it to cover `.space`
    // allocations. Either way, anything past the shorter array must be zero.
    let dataMatch = true;
    const minLen = Math.min(r.data.length, rd.length);
    for (let i = 0; i < minLen; i++)
        if (r.data[i] !== rd[i]) { dataMatch = false; break; }
    if (dataMatch) {
        for (let i = minLen; i < r.data.length; i++)
            if (r.data[i] !== 0) { dataMatch = false; break; }
        for (let i = minLen; i < rd.length; i++)
            if (rd[i] !== 0) { dataMatch = false; break; }
    }

    if (textMatch) textOk++; else { textBad++; failures.push({name, why: "text mismatch"}); }
    if (dataMatch) dataOk++; else { dataBad++; failures.push({name, why: "data mismatch"}); }

    const t = textMatch ? "✓" : "✗";
    const d = dataMatch ? "✓" : "✗";
    console.log(`${t}${d} ${name.padEnd(34)} text ${r.text.length}B  data ${r.data.length}B`);
}

console.log(`\nText: ${textOk}/${sketches.length} ok   Data: ${dataOk}/${sketches.length} ok`);
if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  ${f.name}: ${f.why}`);
    process.exit(1);
}
