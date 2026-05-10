# BRUT-V Architecture For Agents

BRUT-V is a browser-runnable creative coding framework built around a small RISC-V assembly environment. The web app gives the user an editor, assembler, virtual machine, canvas, console, examples, and documentation.

## Repository Boundary

`web-static/` is the Git repository and deployable static site.

The parent workspace contains source inputs used to generate embedded browser files:

- `../core/*.s`: source-of-truth BRUT-V core assembly.
- `../sketches/*.asm`: source-of-truth example sketches.
- `../web-test/*.mjs`: development tests and debugging tools.

Generated web files:

- `web-static/core-fs.js` is generated from `../core/*.s`.
- `web-static/sketches-fs.js` is generated from selected `../sketches/*.asm`.

Do not manually edit generated files unless explicitly asked to patch generated output only.

## Browser Runtime Components

- `index.html`: single-page app. Owns editor setup, canvas rendering, docs routing, console output, sketch selection, run/stop flow.
- `assembler.js`: pure JavaScript assembler. Handles preprocessing, `.include`, `.eqv`, macro expansion, labels, layout, instruction/data encoding, and diagnostics.
- `rv32if.js`: VM for the subset used by BRUT-V. Executes text/data, handles ecalls, canvas memory, debug output, animation frame boundaries.
- `core-fs.js`: embedded assembly core files. Used by the assembler include resolver.
- `sketches-fs.js`: embedded sketches and display names. Used by the sidebar.
- `docs/*.md`: Markdown source loaded by the docs UI.
- `docs/index.html`: documentation app shell and syntax highlighter.
- `hermes-skills/brut-v/`: Hermes skill packaging BRUT-V workflows and references.
- `mcp/brut-v/`: local stdio MCP server for documentation, sketch access, validation tools, and prompts.

## Assembly Core Structure

The core entrypoint is `../core/core.s`.

It includes:

- `config.s`: constants, colors, float bit constants, framebuffer constants.
- `macros.s`: public macro API.
- `data.s`: core-owned data, drawing state, font/noise/runtime state.
- `canvas.s`: canvas and framebuffer helpers.
- `random.s`: random integer and random float routines.
- `math.s`: trig, interpolation, distance, noise, log, mapping.
- `attributes.s`: fill, stroke, text size, stroke weight, caps.
- `transform.s`: current transform matrix, translate, rotate, scale, stack.
- `primitives.s`: point, line, rect, circle, ellipse, arc, triangle, polygon fill.
- `paths.s`: shape construction helpers.
- `font.s`, `text.s`: bitmap font and text rendering.

## Execution Model

A sketch normally defines `setup:`. BRUT-V calls `setup` once from core startup.

If `setup` calls `ANIMATE draw`, the core enters the animation loop:

1. Call registered `draw`.
2. Increment `frame_count`.
3. Repeat while looping is enabled.

If no draw callback is registered, execution exits after `setup`.

Every sketch function must end with `ret`; otherwise the VM keeps executing following memory and can eventually fail with an unknown opcode.

## Generation Workflow

When core changes:

```powershell
python web-static\build\build_core_fs.py
```

When sketches change:

```powershell
python web-static\build\build_sketches_fs.py
```

When docs markdown changes, no generation is usually required because `docs/index.html` fetches the Markdown files directly.

## Test Workflow

Run:

```powershell
node web-test\test_preproc.mjs
node web-test\test_e2e.mjs
```

`test_preproc.mjs` checks macro expansion and assembler behavior.

`test_e2e.mjs` assembles and runs representative sketches through the VM.

RARS comparison tools exist in `web-test/` but may require Java and explicit local RARS setup.
