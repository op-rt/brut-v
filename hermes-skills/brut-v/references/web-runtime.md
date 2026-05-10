# BRUT-V Web Runtime Reference

Use this reference when the task involves the browser app, canvas interaction, diagnostics, generated files, or possible agent hooks.

## Static App

The web version is a static app. It does not require a server-side runtime:

- `index.html` contains the UI, editor, docs panels, canvas, console, and orchestration code.
- `assembler.js` parses, preprocesses, expands macros, assembles, and reports diagnostics.
- `rv32if.js` executes the assembled RV32I/F program.
- `core-fs.js` and `sketches-fs.js` embed generated files into the browser bundle.

## Sketch Execution

Sketches normally define `setup`. Animated sketches also define `draw` and call `ANIMATE draw` from `setup`.
If `setup` and `draw` are contiguous code labels, a second `.text` before `draw:` is not required; section directives stay active until another section is selected.

Execution flow:

1. The editor source is assembled.
2. The core is automatically available.
3. The VM calls `setup`.
4. If a draw callback was registered, the runtime repeatedly calls `draw`.
5. The framebuffer is painted to the canvas after each frame.

## Console And Debug Output

Debug macros write to the web console/message area:

- `PRINT_REG`: decimal integer.
- `PRINT_HEX`: hexadecimal integer.
- `PRINT_REGF`: decimal float.
- `PRINT_HEXF`: hexadecimal float bit pattern.

Use these macros when a generated sketch needs to expose intermediate values.

## Diagnostics

The web assembler should reject common assembly mistakes, including invalid label/immediate usage. For example:

```asm
li   t0, tau
```

should be rejected because `tau` is a label address. Correct forms are:

```asm
la   t0, tau
flw  fs0, 0(t0)
```

or:

```asm
li      t0, TAU
fmv.w.x fs0, t0
```

## Agent Interaction Modes

Hermes can interact with BRUT-V in several ways, depending on available tools:

- If local filesystem access is available, edit source files and regenerate generated web files.
- If browser automation is available, load the static page and paste generated source into the editor.
- If a future stable JS hook exists, prefer that hook over DOM scraping.
- If no execution tool is available, output a complete sketch and explain how to paste it into the web editor.

Do not assume a stable global JavaScript API unless it is visible in `index.html` or documented by the repo.

## Suggested Future Hook

A minimal future hook for agents could expose a small global object:

```js
window.brutvAgent = {
  setSketch(source) {},
  run() {},
  stop() {},
  getConsoleText() {},
  getDiagnostics() {},
  getCurrentSketch() {}
}
```

If such a hook is implemented later, the skill should be updated to prefer it for Hermes browser control.

## Local Server

To test the static site locally, serve `web-static` with any static file server. Example from the workspace root:

```powershell
python -m http.server 8123 -d web-static
```

Then open:

```text
http://127.0.0.1:8123/
```
