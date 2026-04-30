import { assemble } from "../assembler.js";
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2] ?? "sketch_test_trig.asm";
const src = fs.readFileSync(path.join("..", "sketches", target), "utf8");
const r = assemble(src, { mainName: target });
if (r.errors.length) { console.error(r.errors); process.exit(1); }

const syms = [...r.symbols.entries()].sort((a, b) => a[1] - b[1]);
for (const [name, addr] of syms) {
    if (addr >= 0x10000000)
        console.log(`0x${addr.toString(16)}  ${name}`);
}
console.log(`\ntotal data size: ${r.data.length} (0x${r.data.length.toString(16)})`);
console.log(`dataBase: 0x${r.dataBase.toString(16)}`);
