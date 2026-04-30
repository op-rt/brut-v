// Dump the first 30 lines of expanded `pattern.asm` so we can eyeball it.
import { assemble } from "../assembler.js";
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(path.resolve("..", "sketches", "pattern.asm"), "utf8");
const r = assemble(src, { mainName: "pattern.asm" });
if (r.errors.length) { console.error(r.errors); process.exit(1); }

const setupIdx = r.lines.findIndex(l => /^\s*setup\s*:/.test(l.text));
const start    = Math.max(0, setupIdx);
console.log(`Total expanded lines: ${r.lines.length}\n`);
console.log(`Showing 30 lines from setup: (line ${start})\n`);
for (const l of r.lines.slice(start, start + 30))
    console.log(`${l.file.padEnd(16)} ${String(l.lineNo).padStart(4)}: ${l.text}`);
