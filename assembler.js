// =============================================================================
// BRUT-V — Pure-JS RISC-V assembler (RV32IMF subset)
// -----------------------------------------------------------------------------
// Entry point: assemble(source, opts) → { text, data, dataBase, errors, warnings }
//
// Pipeline:
//   1. preprocess(source) — resolve .include, strip comments, expand .macro,
//      apply .eqv substitutions. Output: flat list of "expanded lines" with
//      file/line provenance for error reporting.
//   2. layout(lines) — first pass: walk lines tracking the current section
//      (.text / .data) and PC, recording every label → address binding.
//   3. encode(lines, symbols) — second pass: emit machine code for every
//      instruction (resolving %hi/%lo and label-relative jumps), and emit
//      raw bytes for every data directive.
//
// This file implements the complete browser assembler pipeline used by the
// static BRUT-V app.
// =============================================================================

import { CORE_FILES } from "./core-fs.js";

// ─── public API ─────────────────────────────────────────────────────────────

export function assemble(source, opts = {}) {
    const errors = [];
    const warnings = [];

    let lines;
    try {
        lines = preprocess(source, {
            mainName: opts.mainName ?? "sketch.asm",
            resolveInclude: opts.resolveInclude ?? defaultResolveInclude,
            autoIncludeCore: opts.autoIncludeCore !== false,
        });
    } catch (e) {
        errors.push(e.message ?? String(e));
        return { text: new Uint8Array(0), data: new Uint8Array(0), dataBase: 0, errors, warnings };
    }

    let layoutResult, encoded;
    try {
        layoutResult = layout(lines);
        encoded = encode(layoutResult);
    } catch (e) {
        errors.push(e.message ?? String(e));
        return {
            text: new Uint8Array(0), data: new Uint8Array(0),
            dataBase: TEXT_BASE, errors, warnings, lines,
        };
    }

    return {
        text:     encoded.text,
        data:     encoded.data,
        dataBase: encoded.dataBase,
        textBase: TEXT_BASE,
        symbols:  layoutResult.symbols,    // useful for debugging
        errors,
        warnings,
        lines,                              // kept for diagnostic UIs
    };
}

// Default resolver: look up `.include "<path>"` by basename in the embedded
// core/ filesystem. Sketches use paths like `../core/core.s` — we ignore the
// directory part because every core file lives in the same flat namespace.
function defaultResolveInclude(rawPath) {
    const base = rawPath.replace(/^.*[\\/]/, "");
    if (!(base in CORE_FILES))
        throw new Error(`include not found: ${rawPath} (looked up "${base}")`);
    return { name: base, source: CORE_FILES[base] };
}

// ─── stage 1: preprocess ────────────────────────────────────────────────────
//
// Output format: array of { file, lineNo, text }
//   - text is the expanded source line, comments stripped, .eqv applied,
//     macros fully expanded. One element per emitted line.
//   - file/lineNo point to the *original* file/line so error messages stay
//     useful even after macro expansion.
//
// Preprocessor state is kept in a single object (`pp`) that's threaded through
// the recursion (file → file via .include, macro → macro via expansion).

function preprocess(source, opts) {
    const pp = {
        eqv:    new Map(),    // .eqv NAME VALUE       — token substitutions
        macros: new Map(),    // "NAME/arity" → MacroDef
        // Set of names that have at least one .macro definition; used to
        // distinguish macro invocations from regular instructions when the
        // arity is wrong (so we can produce a useful error instead of a
        // mysterious "unknown instruction").
        macroNames: new Set(),

        out:        [],       // accumulated output lines
        includeStack: [],     // detect circular includes
        resolveInclude: opts.resolveInclude,
    };

    if (opts.autoIncludeCore && !hasCoreInclude(source)) {
        const resolved = pp.resolveInclude("../core/core.s");
        processFile(pp, resolved.name, resolved.source);
    }
    processFile(pp, opts.mainName, source);

    // Apply .eqv substitutions to every emitted line. Macros and includes are
    // already expanded, so this is just a token-level find-and-replace.
    for (const line of pp.out)
        line.text = applyEqv(line.text, pp.eqv);

    return pp.out;
}

function hasCoreInclude(source) {
    for (const rawLine of source.split(/\r?\n/)) {
        const line = stripComment(rawLine);
        const match = line.match(/^\s*\.include\s+"([^"]+)"\s*$/);
        if (!match) continue;
        const base = match[1].replace(/^.*[\\/]/, "");
        if (base === "core.s") return true;
    }
    return false;
}

// ── per-file driver ────────────────────────────────────────────────────────

function processFile(pp, fileName, source) {
    if (pp.includeStack.includes(fileName))
        throw new Error(`circular include: ${[...pp.includeStack, fileName].join(" → ")}`);
    pp.includeStack.push(fileName);

    const rawLines = source.split(/\r?\n/);
    let macroDef = null;     // when non-null we are collecting a .macro body

    for (let i = 0; i < rawLines.length; i++) {
        const lineNo = i + 1;
        const stripped = stripComment(rawLines[i]);
        if (stripped.trim() === "") continue;

        // Inside a .macro body, store the line raw and skip the rest.
        if (macroDef) {
            const head = firstToken(stripped);
            if (head === ".end_macro") {
                finaliseMacro(pp, macroDef);
                macroDef = null;
            } else {
                macroDef.body.push({ file: fileName, lineNo, text: stripped });
            }
            continue;
        }

        // Outside macros: peel off any leading `LABEL:` chunks, emit them as
        // standalone label lines, then process whatever follows. This makes
        // the common `setup: ISIZE 128, 128` pattern work — without this we
        // would hand `ISIZE 128, 128` to the encoder verbatim.
        let rest = stripped;
        while (true) {
            const m = rest.match(/^\s*([A-Za-z_][\w]*)\s*:\s*(.*)$/);
            if (!m) break;
            pp.out.push({ file: fileName, lineNo, text: `${m[1]}:` });
            rest = m[2];
        }
        if (rest.trim() === "") continue;
        const head = firstToken(rest);

        // Top-level directives that mutate preprocessor state.
        if (head === ".include") {
            const path = parseStringArg(rest);
            const resolved = pp.resolveInclude(path);
            processFile(pp, resolved.name, resolved.source);
            continue;
        }
        if (head === ".eqv") {
            // .eqv NAME VALUE  (VALUE may contain spaces, e.g. expressions).
            // Accept both `NAME VALUE` and `NAME, VALUE` — RARS allows either.
            const m = rest.match(/^\s*\.eqv\s+([A-Za-z_][\w]*)\s*[,\s]\s*(.+?)\s*$/);
            if (!m) throw new Error(`${fileName}:${lineNo}: malformed .eqv`);
            pp.eqv.set(m[1], m[2]);
            continue;
        }
        if (head === ".macro") {
            // .macro NAME [%p1 [%p2 ...]]
            const m = rest.match(/^\s*\.macro\s+([A-Za-z_][\w]*)\s*(.*)$/);
            if (!m) throw new Error(`${fileName}:${lineNo}: malformed .macro`);
            const name = m[1];
            const params = parseMacroParams(m[2], fileName, lineNo);
            macroDef = { name, params, body: [], file: fileName, lineNo };
            continue;
        }
        if (head === ".end_macro") {
            throw new Error(`${fileName}:${lineNo}: stray .end_macro`);
        }

        // Macro invocation? Look at the head in our table.
        if (head && pp.macroNames.has(head)) {
            const args = parseMacroArgs(rest, head);
            const key  = `${head}/${args.length}`;
            const def  = pp.macros.get(key);
            if (!def)
                throw new Error(`${fileName}:${lineNo}: macro ${head} has no overload taking ${args.length} args`);
            expandMacro(pp, def, args, { file: fileName, lineNo });
            continue;
        }

        // Plain line — emit verbatim.
        pp.out.push({ file: fileName, lineNo, text: rest });
    }

    if (macroDef)
        throw new Error(`${fileName}: unterminated .macro ${macroDef.name} (started at line ${macroDef.lineNo})`);

    pp.includeStack.pop();
}

// ── macros ─────────────────────────────────────────────────────────────────

function finaliseMacro(pp, def) {
    const key = `${def.name}/${def.params.length}`;
    if (pp.macros.has(key))
        throw new Error(`${def.file}:${def.lineNo}: macro ${def.name} with ${def.params.length} arg(s) already defined`);
    pp.macros.set(key, def);
    pp.macroNames.add(def.name);
}

function expandMacro(pp, def, args, callSite) {
    // Build a substitution map: %paramName → argText (already trimmed).
    const subst = new Map();
    for (let i = 0; i < def.params.length; i++)
        subst.set(def.params[i], args[i]);

    for (const bodyLine of def.body) {
        const expanded = substituteMacroParams(bodyLine.text, subst);
        // We could have nested macro calls inside the body — recurse via the
        // same per-file driver. To keep file/line provenance pointing at the
        // *macro definition*, we feed a one-line "synthetic file" through
        // processFile.
        const head = firstToken(expanded);
        if (head && pp.macroNames.has(head)) {
            const innerArgs = parseMacroArgs(expanded, head);
            const innerDef  = pp.macros.get(`${head}/${innerArgs.length}`);
            if (!innerDef)
                throw new Error(`${bodyLine.file}:${bodyLine.lineNo}: macro ${head} has no overload taking ${innerArgs.length} args (called from ${callSite.file}:${callSite.lineNo})`);
            expandMacro(pp, innerDef, innerArgs, callSite);
        } else {
            pp.out.push({
                file: callSite.file,
                lineNo: callSite.lineNo,
                text: expanded,
            });
        }
    }
}

// `.macro NAME %p1 %p2 %p3` — params are whitespace-separated, each starts
// with `%`. Returns the param names *without* the leading `%`.
function parseMacroParams(rest, fileName, lineNo) {
    const out = [];
    const tokens = rest.trim().split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
        if (!tok.startsWith("%"))
            throw new Error(`${fileName}:${lineNo}: macro parameter must start with %, got "${tok}"`);
        const name = tok.slice(1);
        if (!/^[A-Za-z_]\w*$/.test(name))
            throw new Error(`${fileName}:${lineNo}: invalid macro parameter "${tok}"`);
        out.push(name);
    }
    return out;
}

// Macro invocation: split args after the macro name. RARS uses comma-separated
// args; we accept either commas OR whitespace as separators (so `BACKGROUND a0`
// works the same as `IRECT s7, s5, s6, s3`).
//
// `head` is the already-extracted macro name; we strip everything up to and
// including it, then split the rest.
function parseMacroArgs(line, head) {
    const idx = line.indexOf(head);
    const tail = line.slice(idx + head.length);
    const trimmed = tail.trim();
    if (trimmed === "") return [];
    // Comma-separated if a comma is present; else whitespace-separated.
    if (trimmed.includes(",")) {
        return trimmed.split(",").map(s => s.trim()).filter(s => s.length);
    }
    return trimmed.split(/\s+/).filter(Boolean);
}

// Substitute %param tokens in a macro body line. We require word-boundaries
// on both sides so e.g. `%x` doesn't match inside `%xyz`. Order matters: we
// substitute longer parameter names first to avoid `%a` clobbering `%abc`.
function substituteMacroParams(text, subst) {
    const params = [...subst.keys()].sort((a, b) => b.length - a.length);
    for (const p of params) {
        const re = new RegExp(`%${escapeRe(p)}\\b`, "g");
        text = text.replace(re, subst.get(p));
    }
    return text;
}

// ── .eqv substitution ──────────────────────────────────────────────────────
//
// Substitutions can refer to each other. We resolve the substitution map
// first (so each value is fully expanded), then apply it to every line.
// We cap recursion depth to catch silly cycles.

function applyEqv(text, eqvMap) {
    if (eqvMap.size === 0) return text;
    // Replace every word in the line that matches an .eqv key, but DON'T
    // touch the contents of string literals (e.g. `lbl_hpi: .asciz "HALF_PI"`
    // must keep the literal text intact even if `HALF_PI` is .eqv'd).
    let out = "";
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (c === '"') {
            // Skim to matching close quote, copy verbatim.
            let j = i + 1;
            while (j < text.length && text[j] !== '"') {
                if (text[j] === "\\" && j + 1 < text.length) j++;
                j++;
            }
            out += text.slice(i, Math.min(j + 1, text.length));
            i = j + 1;
            continue;
        }
        if (c === "'") {
            // Char literal — skip similarly.
            let j = i + 1;
            while (j < text.length && text[j] !== "'") {
                if (text[j] === "\\" && j + 1 < text.length) j++;
                j++;
            }
            out += text.slice(i, Math.min(j + 1, text.length));
            i = j + 1;
            continue;
        }
        // Match an identifier and substitute if it's an .eqv key.
        if (/[A-Za-z_]/.test(c)) {
            let j = i + 1;
            while (j < text.length && /\w/.test(text[j])) j++;
            const word = text.slice(i, j);
            out += eqvMap.has(word) ? resolveEqv(word, eqvMap, new Set()) : word;
            i = j;
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

function resolveEqv(name, eqvMap, seen) {
    if (!eqvMap.has(name)) return name;
    if (seen.has(name))
        throw new Error(`circular .eqv reference involving "${name}"`);
    seen.add(name);
    const raw = eqvMap.get(name);
    // Recursively resolve any nested .eqv references in the value.
    const expanded = raw.replace(/\b[A-Za-z_]\w*\b/g, (w) =>
        eqvMap.has(w) ? resolveEqv(w, eqvMap, seen) : w);
    seen.delete(name);
    return expanded;
}

// ─── tiny helpers ───────────────────────────────────────────────────────────

function stripComment(line) {
    // Strip `#…` to end of line. We don't need to handle `#` inside string
    // literals at this stage — only `.asciz "..."` lines have strings, and
    // they're rare enough that we'll handle that as a one-off when the data
    // emitter parses `.asciz`.
    const idx = line.indexOf("#");
    if (idx === -1) return line.replace(/\s+$/, "");
    // BUT: if the # is inside a "quoted string", keep it.
    let inStr = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === "\\" && inStr) { i++; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (c === "#" && !inStr) return line.slice(0, i).replace(/\s+$/, "");
    }
    return line.replace(/\s+$/, "");
}

function firstToken(line) {
    const m = line.match(/^\s*([^\s,]+)/);
    return m ? m[1] : "";
}

function parseStringArg(line) {
    const m = line.match(/"((?:[^"\\]|\\.)*)"/);
    if (!m) throw new Error(`expected quoted string in: ${line}`);
    // Unescape simple sequences: \n \t \\ \" \0
    return m[1].replace(/\\(.)/g, (_, c) =>
        ({ n: "\n", t: "\t", "0": "\0", "\\": "\\", '"': '"' }[c] ?? c));
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// =============================================================================
// stage 2: layout (pass 1)
// =============================================================================
//
// We walk every preprocessed line, classify it (label / directive / instruction),
// assign addresses, and stash a normalised "item" record for the encoder.
//
// The trickiest part is pseudo-instruction sizing. For example `li` may compile
// to one `addi` (12-bit immediate fits) or two instructions (`lui` + `addi`).
// We decide *here*, in pass 1, based on what we know about the immediate at
// this point (literal vs symbol). Once decided, the address layout is locked
// and pass 2 just emits whatever pass 1 promised.

const TEXT_BASE         = 0x00400000;
const DATA_BASE_DEFAULT = 0x10010000;

function layout(lines) {
    const ctx = {
        section:   "text",
        textPC:    TEXT_BASE,
        dataPC:    null,           // unset until first .data directive
        dataBase:  null,           // first address ever placed in .data
        symbols:   new Map(),
        items:     [],             // [{kind, pc, section, ...}]
        // Labels are bound at the start of whatever directive/instruction
        // follows them. If that directive is .float or .word it may auto-
        // align first, and the label must follow the alignment — otherwise
        // `val_1_5: .float 1.5` would point at the byte before val_1_5.
        // We keep the queue across lines because the preprocessor sometimes
        // splits `LABEL: directive` into two physical lines.
        pendingLabels: [],
    };

    for (const line of lines)
        processLine(ctx, line);
    // Any labels still pending at EOF: bind them at the current PC. This is
    // unusual but harmless (e.g. a trailing `end:` with nothing after).
    for (const name of ctx.pendingLabels)
        defineLabel(ctx, name, { file: "<eof>", lineNo: 0 });
    ctx.pendingLabels.length = 0;

    if (ctx.dataBase === null) {
        ctx.dataBase = DATA_BASE_DEFAULT;
        ctx.dataPC   = DATA_BASE_DEFAULT;
    }
    return ctx;
}

function processLine(ctx, line) {
    let text = line.text.trim();
    if (text === "") return;

    // A line may start with `LABEL:` followed by more content. We push the
    // labels onto ctx.pendingLabels and only bind them once we know the
    // address at which the *following* directive will actually emit data —
    // critical for auto-aligning directives like `.float`/`.word`.
    while (true) {
        const m = text.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
        if (!m) break;
        ctx.pendingLabels.push(m[1]);
        text = m[2].trim();
    }
    function flushLabels() {
        for (const name of ctx.pendingLabels) defineLabel(ctx, name, line);
        ctx.pendingLabels.length = 0;
    }
    // Label-only line: leave the pending list for the next directive to flush.
    if (text === "") return;

    // Section / layout directives.
    if (text.startsWith(".")) {
        const head = firstToken(text);
        switch (head) {
            case ".text":
                // A label that appears just before `.text` belongs to the
                // *previous* section (e.g. `core_data_end:` ending the .data
                // segment in core/data.s). Flush BEFORE switching.
                flushLabels();
                ctx.section = "text";
                return;
            case ".data": {
                flushLabels();          // same reasoning as .text above
                ctx.section = "data";
                const rest = text.slice(head.length).trim();
                if (rest !== "") {
                    const addr = parseLiteralInt(rest);
                    if (addr === null) err(line, `invalid .data address: ${rest}`);
                    if (ctx.dataBase === null) {
                        ctx.dataBase = addr;
                        ctx.dataPC   = addr;
                    } else {
                        if (addr < ctx.dataPC)
                            err(line, `.data ${hex(addr)} would move backwards (current PC: ${hex(ctx.dataPC)})`);
                        const gap = addr - ctx.dataPC;
                        if (gap > 0) {
                            ctx.items.push({ kind: "data_space", pc: ctx.dataPC, section: "data", size: gap, line });
                            ctx.dataPC = addr;
                        }
                    }
                } else if (ctx.dataBase === null) {
                    ctx.dataBase = DATA_BASE_DEFAULT;
                    ctx.dataPC   = DATA_BASE_DEFAULT;
                }
                return;
            }
            case ".globl":
                // No layout effect, no flush — labels keep waiting for the
                // next emitting directive.
                return;
            case ".align": {
                const rest = text.slice(head.length).trim();
                const n = parseLiteralInt(rest);
                if (n === null) err(line, `invalid .align: ${rest}`);
                const boundary = 1 << n;
                if (ctx.section === "text") {
                    const padded = align(ctx.textPC, boundary);
                    if (padded > ctx.textPC) {
                        const nops = (padded - ctx.textPC) >>> 2;
                        for (let i = 0; i < nops; i++) {
                            ctx.items.push({
                                kind: "inst", pc: ctx.textPC + i*4, section: "text",
                                mnemonic: "nop", operands: [], line, isPad: true,
                            });
                        }
                        ctx.textPC = padded;
                    }
                } else {
                    requireDataInit(ctx, line);
                    autoAlign(ctx, boundary, line);
                }
                flushLabels();
                return;
            }
            case ".word":
                requireDataInit(ctx, line);
                autoAlign(ctx, 4, line);
                flushLabels();                    // bind labels AT aligned PC
                emitDataValues(ctx, line, text.slice(head.length), 4, "word");
                return;
            case ".float":
                requireDataInit(ctx, line);
                autoAlign(ctx, 4, line);
                flushLabels();
                emitDataValues(ctx, line, text.slice(head.length), 4, "float");
                return;
            case ".half":
                requireDataInit(ctx, line);
                autoAlign(ctx, 2, line);
                flushLabels();
                emitDataValues(ctx, line, text.slice(head.length), 2, "half");
                return;
            case ".byte":
                requireDataInit(ctx, line);
                flushLabels();
                emitDataValues(ctx, line, text.slice(head.length), 1, "byte");
                return;
            case ".space": {
                requireDataInit(ctx, line);
                flushLabels();
                const rest = text.slice(head.length).trim();
                const n = parseLiteralInt(rest);
                if (n === null || n < 0) err(line, `invalid .space size: ${rest}`);
                ctx.items.push({ kind: "data_space", pc: ctx.dataPC, section: "data", size: n, line });
                ctx.dataPC += n;
                return;
            }
            case ".asciz":
            case ".string":
            case ".asciiz": {
                requireDataInit(ctx, line);
                flushLabels();
                const s = parseStringArg(text);
                const bytes = encodeUtf8(s);
                ctx.items.push({
                    kind: "data_bytes", pc: ctx.dataPC, section: "data",
                    bytes: [...bytes, 0], line,
                });
                ctx.dataPC += bytes.length + 1;
                return;
            }
        }
        err(line, `unknown directive: ${head}`);
    }

    // Plain instruction line — bind any pending labels first.
    flushLabels();

    // Otherwise: an instruction. Pseudo-instructions may expand to multiple
    // real instructions. We expand them up-front so addressing is exact.
    if (ctx.section !== "text")
        err(line, `instruction outside .text: ${text}`);

    const { mnemonic, rest } = splitMnemonic(text);
    const operands = splitOperands(rest);
    const expanded = expandPseudo(mnemonic, operands, line);
    for (const ins of expanded) {
        ctx.items.push({
            kind: "inst", pc: ctx.textPC, section: "text",
            mnemonic: ins.mnemonic, operands: ins.operands, line,
        });
        ctx.textPC += 4;
    }
}

function defineLabel(ctx, name, line) {
    if (ctx.symbols.has(name))
        err(line, `duplicate label: ${name}`);
    const pc = ctx.section === "text" ? ctx.textPC
             : (requireDataInit(ctx, line), ctx.dataPC);
    ctx.symbols.set(name, pc);
}

function requireDataInit(ctx, line) {
    if (ctx.dataBase === null) {
        // No explicit `.data <addr>` seen yet — fall back to default.
        ctx.dataBase = DATA_BASE_DEFAULT;
        ctx.dataPC   = DATA_BASE_DEFAULT;
    }
}

// Insert zero padding so dataPC reaches the next `boundary`-aligned address.
// RARS does this implicitly before .word/.float/.half so users don't have to
// write `.align 2` after a string. We mirror that to stay byte-compatible.
function autoAlign(ctx, boundary, line) {
    const padded = align(ctx.dataPC, boundary);
    if (padded > ctx.dataPC) {
        ctx.items.push({
            kind: "data_space", pc: ctx.dataPC, section: "data",
            size: padded - ctx.dataPC, line,
        });
        ctx.dataPC = padded;
    }
}

// .word / .float / .byte: comma-separated list of values.
function emitDataValues(ctx, line, rest, sizeEach, kind) {
    const parts = splitCSV(rest);
    if (parts.length === 0) return;
    const values = parts.map(p => p.trim()).filter(p => p.length);
    ctx.items.push({
        kind: "data_values", pc: ctx.dataPC, section: "data",
        sizeEach, valueKind: kind, values, line,
    });
    ctx.dataPC += sizeEach * values.length;
}

// =============================================================================
// pseudo-instruction expansion
// =============================================================================
//
// Expansion is deterministic in sizing — we never produce different counts in
// pass 1 vs pass 2. For pseudos whose size depends on the immediate, we look
// at the *literal* if possible; for symbol references we always emit the long
// form.

function expandPseudo(mnemonic, operands, line) {
    const m = mnemonic.toLowerCase();

    // ─ trivial 1-instruction pseudos ─
    if (m === "nop")     return [I("addi", ["x0", "x0", "0"])];
    // RARS encodes `mv rd, rs` as `add rd, x0, rs` (R-type) rather than the
    // more common `addi rd, rs, 0`. Matching RARS keeps the bytes identical.
    if (m === "mv")      return [I("add", [operands[0], "x0", operands[1]])];
    if (m === "not")     return [I("xori", [operands[0], operands[1], "-1"])];
    if (m === "neg")     return [I("sub",  [operands[0], "x0", operands[1]])];
    if (m === "seqz")    return [I("sltiu",[operands[0], operands[1], "1"])];
    if (m === "snez")    return [I("sltu", [operands[0], "x0", operands[1]])];
    if (m === "sltz")    return [I("slt",  [operands[0], operands[1], "x0"])];
    if (m === "sgtz")    return [I("slt",  [operands[0], "x0", operands[1]])];

    // ─ branches ─
    if (m === "beqz")    return [I("beq", [operands[0], "x0", operands[1]])];
    if (m === "bnez")    return [I("bne", [operands[0], "x0", operands[1]])];
    if (m === "blez")    return [I("bge", ["x0", operands[0], operands[1]])];
    if (m === "bgez")    return [I("bge", [operands[0], "x0", operands[1]])];
    if (m === "bltz")    return [I("blt", [operands[0], "x0", operands[1]])];
    if (m === "bgtz")    return [I("blt", ["x0", operands[0], operands[1]])];
    if (m === "bgt")     return [I("blt", [operands[1], operands[0], operands[2]])];
    if (m === "ble")     return [I("bge", [operands[1], operands[0], operands[2]])];
    if (m === "bgtu")    return [I("bltu",[operands[1], operands[0], operands[2]])];
    if (m === "bleu")    return [I("bgeu",[operands[1], operands[0], operands[2]])];

    // ─ jumps ─
    if (m === "j")       return [I("jal", ["x0", operands[0]])];
    if (m === "jal" && operands.length === 1)
                          return [I("jal", ["ra", operands[0]])];
    if (m === "jr")      return [I("jalr", ["x0", operands[0], "0"])];
    if (m === "jalr" && operands.length === 1)
                          return [I("jalr", ["ra", operands[0], "0"])];
    if (m === "ret")     return [I("jalr", ["x0", "ra", "0"])];

    // ─ call / tail (always long form: auipc + jalr) ─
    if (m === "call") {
        const target = operands.length === 2 ? operands[1] : operands[0];
        const linkReg = operands.length === 2 ? operands[0] : "ra";
        return [
            I("auipc",  ["x6", `%pcrel_hi(${target})`]),  // x6 = t1
            I("jalr",   [linkReg, "x6", `%pcrel_lo_inst(${target})`]),
        ];
    }
    if (m === "tail") {
        return [
            I("auipc",  ["x6", `%pcrel_hi(${operands[0]})`]),
            I("jalr",   ["x0", "x6", `%pcrel_lo_inst(${operands[0]})`]),
        ];
    }

    // ─ li ─
    if (m === "li") {
        const [rd, immStr] = operands;
        const imm = parseLiteralInt(immStr);
        if (imm !== null && fits12Signed(imm)) {
            return [I("addi", [rd, "x0", String(imm | 0)])];
        }
        // long form: lui + addi using the %hi/%lo of a literal value.
        // We can't use the assembler's %hi(symbol) because the operand isn't
        // a symbol — it's a literal. We embed the value directly.
        return [
            I("lui",  [rd, `%hi_imm(${immStr})`]),
            I("addi", [rd, rd, `%lo_imm(${immStr})`]),
        ];
    }

    // ─ la ─
    if (m === "la") {
        return [
            I("auipc", [operands[0], `%pcrel_hi(${operands[1]})`]),
            I("addi",  [operands[0], operands[0], `%pcrel_lo_inst(${operands[1]})`]),
        ];
    }

    // ─ float pseudos ─
    if (m === "fmv.s")   return [I("fsgnj.s",  [operands[0], operands[1], operands[1]])];
    if (m === "fneg.s")  return [I("fsgnjn.s", [operands[0], operands[1], operands[1]])];
    if (m === "fabs.s")  return [I("fsgnjx.s", [operands[0], operands[1], operands[1]])];

    // Not a pseudo — pass through as a real instruction.
    return [I(m, operands)];
}

function I(mnemonic, operands) { return { mnemonic, operands }; }

// =============================================================================
// stage 3: encode (pass 2)
// =============================================================================

function encode(ctx) {
    // First derive layout sizes.
    let textEndPC = TEXT_BASE;
    for (const it of ctx.items) {
        if (it.section !== "text") continue;
        const end = it.pc + (it.kind === "inst" ? 4 : 0);
        if (end > textEndPC) textEndPC = end;
    }
    const textBytes = new Uint8Array(textEndPC - TEXT_BASE);

    let dataEndPC = ctx.dataPC ?? ctx.dataBase ?? DATA_BASE_DEFAULT;
    let dataBase  = ctx.dataBase ?? dataEndPC;
    const dataBytes = new Uint8Array(Math.max(0, dataEndPC - dataBase));

    for (const it of ctx.items) {
        if (it.kind === "inst")
            writeWord(textBytes, it.pc - TEXT_BASE, encodeInst(it, ctx));
        else if (it.kind === "data_values")
            writeDataValues(dataBytes, it.pc - dataBase, it, ctx);
        else if (it.kind === "data_bytes")
            for (let i = 0; i < it.bytes.length; i++)
                dataBytes[(it.pc - dataBase) + i] = it.bytes[i] & 0xFF;
        else if (it.kind === "data_space")
            ; // already zero-initialised
    }

    return { text: textBytes, data: dataBytes, dataBase };
}

function writeWord(buf, off, word) {
    buf[off    ] =  word        & 0xFF;
    buf[off + 1] = (word >>> 8 ) & 0xFF;
    buf[off + 2] = (word >>> 16) & 0xFF;
    buf[off + 3] = (word >>> 24) & 0xFF;
}

function writeDataValues(buf, off, it, ctx) {
    for (let i = 0; i < it.values.length; i++) {
        const raw = it.values[i];
        let v;
        if (it.valueKind === "float") v = floatToBits(parseFloatLiteral(raw, it.line));
        else                          v = evalIntExpr(raw, ctx, it.line) | 0;
        if (it.sizeEach === 1) {
            buf[off + i] = v & 0xFF;
        } else if (it.sizeEach === 2) {
            buf[off + i*2    ] =  v        & 0xFF;
            buf[off + i*2 + 1] = (v >>> 8) & 0xFF;
        } else if (it.sizeEach === 4) {
            writeWord(buf, off + i * 4, v);
        } else {
            err(it.line, `unsupported data sizeEach=${it.sizeEach}`);
        }
    }
}

// ─── instruction encoding ─────────────────────────────────────────────────

function encodeInst(it, ctx) {
    const op = INSTS.get(it.mnemonic);
    if (!op) err(it.line, `unknown instruction: ${it.mnemonic}`);
    return op.encode(it.operands, it, ctx);
}

// ─── helpers used by encoders ─────────────────────────────────────────────

function reg(name, line) {
    const r = X_REGS.get(name);
    if (r === undefined) err(line, `not an integer register: ${name}`);
    return r;
}
function freg(name, line) {
    const r = F_REGS.get(name);
    if (r === undefined) err(line, `not a float register: ${name}`);
    return r;
}

// Build register tables.
const X_REGS = new Map();
{
    for (let i = 0; i < 32; i++) X_REGS.set(`x${i}`, i);
    const abi = ["zero","ra","sp","gp","tp","t0","t1","t2",
                 "s0","s1","a0","a1","a2","a3","a4","a5",
                 "a6","a7","s2","s3","s4","s5","s6","s7",
                 "s8","s9","s10","s11","t3","t4","t5","t6"];
    abi.forEach((n, i) => X_REGS.set(n, i));
    X_REGS.set("fp", 8); // alias for s0
}
const F_REGS = new Map();
{
    for (let i = 0; i < 32; i++) F_REGS.set(`f${i}`, i);
    const abi = ["ft0","ft1","ft2","ft3","ft4","ft5","ft6","ft7",
                 "fs0","fs1","fa0","fa1","fa2","fa3","fa4","fa5",
                 "fa6","fa7","fs2","fs3","fs4","fs5","fs6","fs7",
                 "fs8","fs9","fs10","fs11","ft8","ft9","ft10","ft11"];
    abi.forEach((n, i) => F_REGS.set(n, i));
}

// ─── numeric expression / immediate evaluation ─────────────────────────────
//
// We support a tiny expression grammar: integer literals, identifiers (looked
// up in `ctx.symbols`), unary +/-, and arithmetic + - * / & | ^ << >>. Plus
// the relocation operators %hi(...) %lo(...) %pcrel_hi(...) %pcrel_lo_inst(...)
// %hi_imm(...) %lo_imm(...) — these are parsed at the top level by the
// individual instruction encoders (because their semantics depend on context:
// %hi attaches to a U-type, %lo to an I- or S-type, etc.).

function evalIntExpr(text, ctx, line, opts = {}) {
    const t = text.trim();
    const allowSymbols = opts.allowSymbols !== false;
    // Direct symbol or literal fast-path.
    const lit = parseLiteralInt(t);
    if (lit !== null) return lit | 0;
    const sym = ctx.symbols.get(t);
    if (sym !== undefined) {
        if (!allowSymbols) operandTypeErr(line, t);
        return sym | 0;
    }
    // Otherwise, full expression parser.
    const v = parseExpr(t, ctx, line, opts);
    return v | 0;
}

function evalImmediateExpr(text, ctx, line) {
    return evalIntExpr(text, ctx, line, { allowSymbols: false });
}

function parseLiteralInt(t) {
    if (t === undefined || t === null) return null;
    const s = String(t).trim();
    if (s === "") return null;
    // Char literals: 'A', '\n', '\\', '\0'
    const cm = s.match(/^'(\\.|[^'\\])'$/);
    if (cm) {
        const c = cm[1];
        if (c.length === 1) return c.charCodeAt(0);
        const esc = c[1];
        const map = { n:10, t:9, r:13, "0":0, "\\":92, "'":39, '"':34 };
        return esc in map ? map[esc] : c.charCodeAt(1);
    }
    // Sign prefix.
    const sign = s.startsWith("-") ? -1 : 1;
    const body = s.replace(/^[-+]/, "");
    if (/^0x[0-9a-f]+$/i.test(body)) return sign * parseInt(body.slice(2), 16);
    if (/^0b[01]+$/i.test(body))     return sign * parseInt(body.slice(2), 2);
    if (/^0[0-7]+$/.test(body))      return sign * parseInt(body, 8);
    if (/^[0-9]+$/.test(body))       return sign * parseInt(body, 10);
    return null;
}

function parseFloatLiteral(t, line) {
    const s = String(t).trim().replace(/[fF]$/, "");
    const v = Number(s);
    if (Number.isNaN(v)) err(line, `invalid float literal: ${t}`);
    return v;
}

function floatToBits(f) {
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = f;
    return new Uint32Array(buf)[0] | 0;
}

// Tiny recursive-descent expression parser for things like `BASE + 4` or
// `LEN-1`. Everything is integer-only and 32-bit.
function parseExpr(text, ctx, line, opts = {}) {
    const allowSymbols = opts.allowSymbols !== false;
    const tk = tokeniseExpr(text);
    let i = 0;
    function peek() { return tk[i]; }
    function eat()  { return tk[i++]; }
    function parsePrimary() {
        const t = eat();
        if (!t) err(line, `unexpected end of expression: ${text}`);
        if (t === "(") { const v = parseSum(); if (eat() !== ")") err(line, `unbalanced parens in: ${text}`); return v; }
        if (t === "-") return -parsePrimary() | 0;
        if (t === "+") return  parsePrimary() | 0;
        const lit = parseLiteralInt(t);
        if (lit !== null) return lit | 0;
        if (ctx.symbols.has(t)) {
            if (!allowSymbols) operandTypeErr(line, t);
            return ctx.symbols.get(t) | 0;
        }
        err(line, `undefined symbol: ${t} (in expression: ${text})`);
    }
    function parseMul() {
        let v = parsePrimary();
        while (peek() === "*" || peek() === "/" || peek() === "<<" || peek() === ">>") {
            const op = eat(); const r = parsePrimary();
            v = op === "*"  ? Math.imul(v, r)
              : op === "/"  ? (v / r) | 0
              : op === "<<" ? (v << r)
              :               (v >> r);
        }
        return v;
    }
    function parseSum() {
        let v = parseMul();
        while (peek() === "+" || peek() === "-" || peek() === "&" || peek() === "|" || peek() === "^") {
            const op = eat(); const r = parseMul();
            v = op === "+" ? (v + r) | 0
              : op === "-" ? (v - r) | 0
              : op === "&" ? (v & r)
              : op === "|" ? (v | r)
              :              (v ^ r);
        }
        return v;
    }
    const v = parseSum();
    if (peek() !== undefined) err(line, `trailing junk in expression: ${text}`);
    return v;
}

function tokeniseExpr(text) {
    const tk = []; let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === "<" && text[i+1] === "<") { tk.push("<<"); i += 2; continue; }
        if (c === ">" && text[i+1] === ">") { tk.push(">>"); i += 2; continue; }
        if ("+-*/&|^()".includes(c)) { tk.push(c); i++; continue; }
        // identifier / number
        let j = i;
        while (j < text.length && /[A-Za-z0-9_$.']/.test(text[j])) {
            // Allow `'A'` style char literals: include matching close-quote.
            if (text[j] === "'") {
                j++;
                while (j < text.length && text[j] !== "'") { if (text[j] === "\\") j++; j++; }
                j++;
                break;
            }
            // Allow hex prefix `0x...`
            if (text[j] === "x" && text.slice(i, j) === "0") { j++; continue; }
            j++;
        }
        if (j === i) i++; else { tk.push(text.slice(i, j)); i = j; }
    }
    return tk;
}

// ─── relocation operators ──────────────────────────────────────────────────
//
// In operand text we may see:
//   %hi(symbol)        — upper 20 bits of an absolute address (symbol)
//   %lo(symbol)        — lower 12 bits, sign-extended-aware
//   %hi_imm(<int>)     — same, but operand is a numeric expression
//   %lo_imm(<int>)
//   %pcrel_hi(symbol)  — for auipc, distance from current PC
//   %pcrel_lo_inst(symbol)
//                     — for the I/S inst paired with the above auipc; we
//                       resolve `symbol` to the address of the auipc rather
//                       than recomputing pcrel here, then add the symbol off.
//
// All return the 12-bit (lo) or 20-bit (hi) integer needed for the slot.

function resolveOperand(text, kind, ctx, it) {
    // Returns a number for the relevant immediate slot.
    const t = text.trim();
    const m = t.match(/^%(hi|lo|hi_imm|lo_imm|pcrel_hi|pcrel_lo_inst)\((.*)\)$/);
    if (m) {
        const op = m[1], inner = m[2].trim();
        if (op === "hi" || op === "lo") {
            const addr = (ctx.symbols.has(inner) ? ctx.symbols.get(inner)
                          : evalIntExpr(inner, ctx, it.line)) | 0;
            return op === "hi" ? hi20(addr) : lo12(addr);
        }
        if (op === "hi_imm" || op === "lo_imm") {
            const addr = evalImmediateExpr(inner, ctx, it.line) | 0;
            return op === "hi_imm" ? hi20(addr) : lo12(addr);
        }
        if (op === "pcrel_hi") {
            const target = (ctx.symbols.has(inner) ? ctx.symbols.get(inner)
                            : evalIntExpr(inner, ctx, it.line)) | 0;
            const delta = (target - it.pc) | 0;
            return hi20(delta);
        }
        if (op === "pcrel_lo_inst") {
            // Used by call/la: delta from the *paired auipc* (the instruction
            // before this one) to the target. Since we always emit the auipc
            // immediately before, its PC is `it.pc - 4`.
            const target = (ctx.symbols.has(inner) ? ctx.symbols.get(inner)
                            : evalIntExpr(inner, ctx, it.line)) | 0;
            const delta = (target - (it.pc - 4)) | 0;
            return lo12(delta);
        }
    }
    // No relocation operator → plain int expression / symbol.
    if (kind === "branch" || kind === "jal") {
        const target = ctx.symbols.has(t) ? ctx.symbols.get(t)
                       : evalIntExpr(t, ctx, it.line);
        return ((target | 0) - it.pc) | 0;
    }
    return evalImmediateExpr(t, ctx, it.line);
}

function hi20(v) {
    // %hi rounds up so that the paired %lo (sign-extended) reconstructs v.
    return ((v + 0x800) >>> 12) & 0xFFFFF;
}
function lo12(v) {
    // 12-bit sign-extended.
    let x = v & 0xFFF;
    if (x & 0x800) x |= 0xFFFFF000;
    return x | 0;
}

function fits12Signed(v) { return v >= -2048 && v <= 2047; }
function fits20Signed(v) { return v >= -(1 << 19) && v < (1 << 19); }

// ─── instruction table ─────────────────────────────────────────────────────
//
// Every entry encodes a single "real" instruction (post-pseudo expansion).
// The `encode` callback receives the operand strings and the layout context,
// and returns a 32-bit unsigned word.

const INSTS = new Map();

function defR(name, opcode, funct3, funct7) {
    INSTS.set(name, { encode(ops, it, ctx) {
        const rd  = reg(ops[0], it.line);
        const rs1 = reg(ops[1], it.line);
        const rs2 = reg(ops[2], it.line);
        return rType(opcode, rd, funct3, rs1, rs2, funct7);
    }});
}
function defI(name, opcode, funct3) {
    INSTS.set(name, { encode(ops, it, ctx) {
        const rd  = reg(ops[0], it.line);
        const rs1 = reg(ops[1], it.line);
        const imm = resolveOperand(ops[2], "imm", ctx, it);
        return iType(opcode, rd, funct3, rs1, imm);
    }});
}
function defShift(name, opcode, funct3, funct7) {
    INSTS.set(name, { encode(ops, it, ctx) {
        const rd  = reg(ops[0], it.line);
        const rs1 = reg(ops[1], it.line);
        const sh  = evalImmediateExpr(ops[2], ctx, it.line) & 0x1F;
        return ((funct7 << 25) | (sh << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | opcode) >>> 0;
    }});
}
function defLoad(name, opcode, funct3) {
    INSTS.set(name, { encode(ops, it, ctx) {
        const rd  = reg(ops[0], it.line);
        // Accept `lw rd, off(rs1)` OR `lw rd, sym` (we only do off(rs1) here;
        // the `lw rd, sym` form is a pseudo we don't need yet).
        const m = ops[1].match(/^(.+)\((\w+)\)$/);
        if (!m) err(it.line, `expected off(rs) form: ${ops[1]}`);
        const rs1 = reg(m[2], it.line);
        const imm = resolveOperand(m[1], "imm", ctx, it);
        return iType(opcode, rd, funct3, rs1, imm);
    }});
}
function defStore(name, opcode, funct3) {
    INSTS.set(name, { encode(ops, it, ctx) {
        const rs2 = reg(ops[0], it.line);
        const m = ops[1].match(/^(.+)\((\w+)\)$/);
        if (!m) err(it.line, `expected off(rs) form: ${ops[1]}`);
        const rs1 = reg(m[2], it.line);
        const imm = resolveOperand(m[1], "imm", ctx, it);
        return sType(opcode, funct3, rs1, rs2, imm);
    }});
}
function defBranch(name, funct3) {
    INSTS.set(name, { encode(ops, it, ctx) {
        const rs1 = reg(ops[0], it.line);
        const rs2 = reg(ops[1], it.line);
        const off = resolveOperand(ops[2], "branch", ctx, it);
        if ((off & 1) !== 0) err(it.line, `branch offset must be even: ${off}`);
        return bType(0x63, funct3, rs1, rs2, off);
    }});
}

function rType(op, rd, f3, rs1, rs2, f7) {
    return ((f7 << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op) >>> 0;
}
function iType(op, rd, f3, rs1, imm) {
    return (((imm & 0xFFF) << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op) >>> 0;
}
function sType(op, f3, rs1, rs2, imm) {
    const i = imm & 0xFFF;
    return (((i >>> 5) & 0x7F) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | ((i & 0x1F) << 7) | op;
}
function bType(op, f3, rs1, rs2, imm) {
    // imm is the byte-offset; encoded in B-format bit ordering.
    const i = imm | 0;
    const b12   = (i >> 12) & 1;
    const b10_5 = (i >>  5) & 0x3F;
    const b4_1  = (i >>  1) & 0xF;
    const b11   = (i >> 11) & 1;
    return ((b12 << 31) | (b10_5 << 25) | (rs2 << 20) | (rs1 << 15)
          | (f3 << 12) | (b4_1 << 8) | (b11 << 7) | op) >>> 0;
}
function uType(op, rd, imm20) {
    return (((imm20 & 0xFFFFF) << 12) | (rd << 7) | op) >>> 0;
}
function jType(op, rd, imm) {
    const i = imm | 0;
    const b20    = (i >> 20) & 1;
    const b10_1  = (i >>  1) & 0x3FF;
    const b11    = (i >> 11) & 1;
    const b19_12 = (i >> 12) & 0xFF;
    return ((b20 << 31) | (b10_1 << 21) | (b11 << 20) | (b19_12 << 12) | (rd << 7) | op) >>> 0;
}

// ── RV32I ──
defR("add",  0x33, 0x0, 0x00);
defR("sub",  0x33, 0x0, 0x20);
defR("sll",  0x33, 0x1, 0x00);
defR("slt",  0x33, 0x2, 0x00);
defR("sltu", 0x33, 0x3, 0x00);
defR("xor",  0x33, 0x4, 0x00);
defR("srl",  0x33, 0x5, 0x00);
defR("sra",  0x33, 0x5, 0x20);
defR("or",   0x33, 0x6, 0x00);
defR("and",  0x33, 0x7, 0x00);

defI("addi",  0x13, 0x0);
defI("slti",  0x13, 0x2);
defI("sltiu", 0x13, 0x3);
defI("xori",  0x13, 0x4);
defI("ori",   0x13, 0x6);
defI("andi",  0x13, 0x7);
defI("jalr",  0x67, 0x0);
defShift("slli", 0x13, 0x1, 0x00);
defShift("srli", 0x13, 0x5, 0x00);
defShift("srai", 0x13, 0x5, 0x20);

defLoad("lb",  0x03, 0x0);
defLoad("lh",  0x03, 0x1);
defLoad("lw",  0x03, 0x2);
defLoad("lbu", 0x03, 0x4);
defLoad("lhu", 0x03, 0x5);

defStore("sb", 0x23, 0x0);
defStore("sh", 0x23, 0x1);
defStore("sw", 0x23, 0x2);

defBranch("beq",  0x0);
defBranch("bne",  0x1);
defBranch("blt",  0x4);
defBranch("bge",  0x5);
defBranch("bltu", 0x6);
defBranch("bgeu", 0x7);

INSTS.set("lui", { encode(ops, it, ctx) {
    const rd = reg(ops[0], it.line);
    const imm = resolveOperand(ops[1], "imm20", ctx, it);
    return uType(0x37, rd, imm);
}});
INSTS.set("auipc", { encode(ops, it, ctx) {
    const rd = reg(ops[0], it.line);
    const imm = resolveOperand(ops[1], "imm20", ctx, it);
    return uType(0x17, rd, imm);
}});
INSTS.set("jal", { encode(ops, it, ctx) {
    const rd = reg(ops[0], it.line);
    const off = resolveOperand(ops[1], "jal", ctx, it);
    return jType(0x6F, rd, off);
}});

// FENCE and ECALL/EBREAK
INSTS.set("ecall",  { encode() { return 0x00000073; }});
INSTS.set("ebreak", { encode() { return 0x00100073; }});
INSTS.set("fence",  { encode() { return 0x0FF0000F; }});  // fence iorw, iorw

// ── RV32M ──
defR("mul",    0x33, 0x0, 0x01);
defR("mulh",   0x33, 0x1, 0x01);
defR("mulhsu", 0x33, 0x2, 0x01);
defR("mulhu",  0x33, 0x3, 0x01);
defR("div",    0x33, 0x4, 0x01);
defR("divu",   0x33, 0x5, 0x01);
defR("rem",    0x33, 0x6, 0x01);
defR("remu",   0x33, 0x7, 0x01);

// ── RV32F ──
// Format is mostly R-type but with funct3 = rounding mode (rm). RARS — like
// most assemblers — defaults to DYN (0x7) when rm is omitted. An explicit rm
// can appear as the LAST operand on float arithmetic and conversion lines:
//   fadd.s ft0, ft1, ft2          → rm = dyn
//   fadd.s ft0, ft1, ft2, rne     → rm = round to nearest even
//   fcvt.w.s a0, fa0, rtz         → rm = round toward zero
const ROUND_MODES = new Map([
    ["rne", 0x0], ["rtz", 0x1], ["rdn", 0x2],
    ["rup", 0x3], ["rmm", 0x4], ["dyn", 0x7],
]);
function takeRm(ops, defaultRm = 0x7) {
    if (ops.length === 0) return { ops, rm: defaultRm };
    const last = ops[ops.length - 1].toLowerCase();
    if (ROUND_MODES.has(last))
        return { ops: ops.slice(0, -1), rm: ROUND_MODES.get(last) };
    return { ops, rm: defaultRm };
}

function defF_R(name, funct7, f3FixedOrNull = null) {
    INSTS.set(name, { encode(ops, it, ctx) {
        let rm = f3FixedOrNull;
        if (rm === null) ({ ops, rm } = takeRm(ops));
        const rd  = freg(ops[0], it.line);
        const rs1 = freg(ops[1], it.line);
        const rs2 = freg(ops[2], it.line);
        return rType(0x53, rd, rm, rs1, rs2, funct7);
    }});
}
function defF_R_fixed_rs2(name, funct7, rs2_fixed, f3FixedOrNull = null) {
    INSTS.set(name, { encode(ops, it, ctx) {
        let rm = f3FixedOrNull;
        if (rm === null) ({ ops, rm } = takeRm(ops));
        const rd  = freg(ops[0], it.line);
        const rs1 = freg(ops[1], it.line);
        return rType(0x53, rd, rm, rs1, rs2_fixed, funct7);
    }});
}

defF_R("fadd.s", 0x00);
defF_R("fsub.s", 0x04);
defF_R("fmul.s", 0x08);
defF_R("fdiv.s", 0x0C);
defF_R("fmin.s", 0x14, 0x0);
defF_R("fmax.s", 0x14, 0x1);
defF_R("fsgnj.s",  0x10, 0x0);
defF_R("fsgnjn.s", 0x10, 0x1);
defF_R("fsgnjx.s", 0x10, 0x2);
defF_R_fixed_rs2("fsqrt.s", 0x2C, 0);

// fcvt.* — int<->float conversions. funct7 + rs2 encode the variant; funct3
// is the rounding mode (defaults to dyn=0x7, parsed from the optional last
// operand otherwise). RARS-compatible.
INSTS.set("fcvt.w.s",  { encode(ops, it) { const r = takeRm(ops); return rType(0x53, reg(r.ops[0], it.line), r.rm, freg(r.ops[1], it.line), 0, 0x60); }});
INSTS.set("fcvt.wu.s", { encode(ops, it) { const r = takeRm(ops); return rType(0x53, reg(r.ops[0], it.line), r.rm, freg(r.ops[1], it.line), 1, 0x60); }});
INSTS.set("fcvt.s.w",  { encode(ops, it) { const r = takeRm(ops); return rType(0x53, freg(r.ops[0], it.line), r.rm, reg(r.ops[1], it.line), 0, 0x68); }});
INSTS.set("fcvt.s.wu", { encode(ops, it) { const r = takeRm(ops); return rType(0x53, freg(r.ops[0], it.line), r.rm, reg(r.ops[1], it.line), 1, 0x68); }});

// fmv.x.w / fmv.w.x — bit-cast between int and float regs.
INSTS.set("fmv.x.w", { encode: (ops, it) => rType(0x53, reg(ops[0], it.line),  0x0, freg(ops[1], it.line), 0, 0x70) });
INSTS.set("fmv.w.x", { encode: (ops, it) => rType(0x53, freg(ops[0], it.line), 0x0, reg(ops[1], it.line),  0, 0x78) });

// Compares — feq.s/flt.s/fle.s, write to int register.
INSTS.set("feq.s", { encode: (ops, it) => rType(0x53, reg(ops[0], it.line), 0x2, freg(ops[1], it.line), freg(ops[2], it.line), 0x50) });
INSTS.set("flt.s", { encode: (ops, it) => rType(0x53, reg(ops[0], it.line), 0x1, freg(ops[1], it.line), freg(ops[2], it.line), 0x50) });
INSTS.set("fle.s", { encode: (ops, it) => rType(0x53, reg(ops[0], it.line), 0x0, freg(ops[1], it.line), freg(ops[2], it.line), 0x50) });

// fclass.s — write classification to int reg.
INSTS.set("fclass.s", { encode: (ops, it) => rType(0x53, reg(ops[0], it.line), 0x1, freg(ops[1], it.line), 0, 0x70) });

// flw / fsw — float load/store.
INSTS.set("flw", { encode(ops, it, ctx) {
    const rd = freg(ops[0], it.line);
    const m  = ops[1].match(/^(.+)\((\w+)\)$/);
    if (!m) err(it.line, `expected off(rs) form: ${ops[1]}`);
    const rs1 = reg(m[2], it.line);
    const imm = resolveOperand(m[1], "imm", ctx, it);
    return iType(0x07, rd, 0x2, rs1, imm);
}});
INSTS.set("fsw", { encode(ops, it, ctx) {
    const rs2 = freg(ops[0], it.line);
    const m   = ops[1].match(/^(.+)\((\w+)\)$/);
    if (!m) err(it.line, `expected off(rs) form: ${ops[1]}`);
    const rs1 = reg(m[2], it.line);
    const imm = resolveOperand(m[1], "imm", ctx, it);
    return sType(0x27, 0x2, rs1, rs2, imm);
}});

// Fused multiply-add forms (R4-type). Opcode varies.
function defFma(name, opcode) {
    INSTS.set(name, { encode(ops, it, ctx) {
        const rd  = freg(ops[0], it.line);
        const rs1 = freg(ops[1], it.line);
        const rs2 = freg(ops[2], it.line);
        const rs3 = freg(ops[3], it.line);
        const fmt = 0; // single-precision
        const f3  = 0x7;
        return ((rs3 << 27) | (fmt << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | opcode) >>> 0;
    }});
}
defFma("fmadd.s",  0x43);
defFma("fmsub.s",  0x47);
defFma("fnmsub.s", 0x4B);
defFma("fnmadd.s", 0x4F);

// =============================================================================
// misc helpers
// =============================================================================

function err(line, msg) {
    if (line) throw new Error(`${line.file}:${line.lineNo}: ${msg}`);
    throw new Error(msg);
}
function operandTypeErr(line, operand) {
    if (!line) throw new Error(`"${operand}": operand is of incorrect type`);
    const column = operandColumn(line.text, operand);
    if (column !== null)
        throw new Error(`${line.file}:${line.lineNo}:${column}: "${operand}": operand is of incorrect type`);
    throw new Error(`${line.file}:${line.lineNo}: "${operand}": operand is of incorrect type`);
}
function operandColumn(text, operand) {
    const idx = String(text ?? "").indexOf(operand);
    return idx === -1 ? null : idx + 1;
}
function hex(n) { return "0x" + (n >>> 0).toString(16).padStart(8, "0"); }
function align(addr, n) { return (addr + n - 1) & ~(n - 1); }
function encodeUtf8(s) { return new TextEncoder().encode(s); }

function splitMnemonic(text) {
    const m = text.match(/^\s*(\S+)\s*(.*)$/);
    let mnemonic = m[1];
    // RARS tolerates a stray comma right after the mnemonic — e.g. the typo
    // `addi, s2, t0, 256` in sketch_5_Text.asm. Strip it so we agree.
    if (mnemonic.endsWith(",")) mnemonic = mnemonic.slice(0, -1);
    return { mnemonic, rest: m[2] };
}

// Split operands respecting parentheses (e.g. `12(sp)` is one operand even
// though it has no comma inside). Handles `%hi(symbol)` etc. similarly.
function splitOperands(rest) {
    const out = [];
    let depth = 0, start = 0, hasContent = false;
    for (let i = 0; i < rest.length; i++) {
        const c = rest[i];
        if (c === "(") depth++;
        else if (c === ")") depth--;
        else if (c === "," && depth === 0) {
            const tok = rest.slice(start, i).trim();
            if (tok.length) out.push(tok);
            start = i + 1;
            hasContent = false;
            continue;
        }
        if (!/\s/.test(c)) hasContent = true;
    }
    const tail = rest.slice(start).trim();
    if (tail.length) out.push(tail);
    return out;
}

// Comma-separated split for data directives. Same as splitOperands but
// preserves quoted strings if any (for .asciz, though we usually parse those
// via parseStringArg before reaching here).
function splitCSV(rest) {
    return splitOperands(rest);
}

// ─── exposed for unit testing ───────────────────────────────────────────────
