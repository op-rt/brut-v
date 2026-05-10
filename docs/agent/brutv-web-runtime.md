# BRUT-V Web Runtime For Agents

This file explains how the browser version runs sketches and where an agent could integrate.

## Static App Flow

1. User selects or edits a sketch.
2. `assembler.js` assembles source into text/data bytes.
3. `rv32if.js` loads text/data into VM memory.
4. VM executes `__start` from the core.
5. Core calls `setup`.
6. If a draw callback is registered, VM continues animation frames.
7. Canvas framebuffer is copied to the browser canvas.
8. Debug output and errors are shown in the console panel.

## Core Auto Import

The web assembler imports `core.s` automatically before user sketches unless the sketch explicitly includes it.

This means web examples should normally start with:

```asm
.text
setup:
    ...
```

not:

```asm
.include "../core/core.s"
```

RARS still needs explicit includes, so test scripts that compare with RARS may inject includes for RARS only.

## Generated Files

`core-fs.js` embeds the source files from `../core/`.

Generate with:

```powershell
python web-static\build\build_core_fs.py
```

`sketches-fs.js` embeds selected sketches from `../sketches/`.

Generate with:

```powershell
python web-static\build\build_sketches_fs.py
```

## Runtime Error Behavior

The assembler reports source-level errors where possible.

Examples:

- unknown instruction
- wrong operand type
- labels passed to immediates such as `li t0, tau`
- unresolved symbols
- malformed directives

The VM reports simulator errors such as unknown opcode or invalid memory behavior.

Always prefer fixing the source sketch rather than hiding runtime errors.

## Animation Rendering

The VM supports frame-boundary rendering. For animated sketches, the UI renders after `frame_count` increments, not halfway through `draw`.

This avoids partially drawn frames.

## Console Output

The web page has a console/message area below the canvas.

Debug macros write there:

```asm
PRINT_REG s0
PRINT_HEX s0
PRINT_REGF fs0
PRINT_HEXF fs0
```

## Potential Agent Hook Surface

A browser-aware agent can benefit from a stable JavaScript hook such as:

```js
window.BRUTV_AGENT = {
  listSketches,
  getSource,
  setSource,
  assemble,
  run,
  stop,
  getConsole,
  getCanvasImageData
};
```

This does not exist as a formal API yet. It is a recommended future integration layer.

## Potential Hermes Integration Surface

Best practical options:

1. **Project context files**: `HERMES.md` and `docs/agent/*.md`.
2. **Hermes skill**: a `SKILL.md` with references and examples.
3. **MCP server**: expose Brut-V operations as tools.
4. **Browser hook**: expose `window.BRUTV_AGENT` for browser-control agents.
5. **API bridge**: have the page call Hermes API server when explicitly configured by the user.

## MCP Server

The first local stdio MCP server lives in `web-static/mcp/brut-v/`.

Current tools:

- `list_docs`
- `read_doc`
- `search_docs`
- `list_sketches`
- `get_sketch`
- `validate_sketch`
- `validate_existing_sketch`
- `get_macro_reference`

Current prompts:

- `create-brutv-sketch`
- `debug-brutv-sketch`
- `explain-brutv-macro`
- `port-processing-to-brutv`

Future write/browser-control tools could include:

- `set_sketch`
- `run_static`
- `run_frames`
- `get_console`
- `render_png`
- `save_sketch`

Security rule: do not expose arbitrary filesystem write access through a browser hook. Keep write operations scoped to sketches or explicit user-approved files.
