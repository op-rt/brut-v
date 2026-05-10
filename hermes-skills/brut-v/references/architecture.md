# BRUT-V Architecture Reference

BRUT-V has two relevant layers:

- The full workspace contains the source-of-truth core, source sketches, tests, and the static web repo.
- `web-static` is the Git repository and the deployable static site.

## Important Paths

Full workspace:

- `core/*.s`: source-of-truth BRUT-V core and macro implementation.
- `sketches/*.asm`: source-of-truth examples and bundled sketches.
- `web-test/`: development, conformance, and debugging tools.
- `web-static/`: static web app repository.

Inside `web-static`:

- `index.html`: UI, editor, canvas, docs, console, and sketch runner.
- `assembler.js`: assembler, preprocessing, macro expansion, layout, encoding, and diagnostics.
- `rv32if.js`: browser-side RV32I/F virtual machine.
- `core-fs.js`: generated embedded core filesystem.
- `sketches-fs.js`: generated embedded sketch filesystem.
- `build/build_core_fs.py`: regenerates `core-fs.js` from `../core`.
- `build/build_sketches_fs.py`: regenerates `sketches-fs.js` from selected `../sketches`.
- `docs/agent/`: web-hosted agent documentation.
- `hermes-skills/brut-v/`: portable Hermes skill for BRUT-V tasks.

## Generated File Boundary

Never patch generated files as the only source of a change:

- Change core behavior in `core/*.s`, then regenerate `web-static/core-fs.js`.
- Change bundled sketches in `sketches/*.asm`, then regenerate `web-static/sketches-fs.js`.
- Change runtime/editor behavior directly in `web-static/index.html`, `web-static/assembler.js`, or `web-static/rv32if.js`.

Generated file edits are acceptable only as the output of the build scripts.

## Runtime Model

The static site runs entirely in the browser:

1. The editor provides assembly source.
2. The assembler preprocesses it, automatically imports the core, expands macros, resolves labels, and emits machine code/data.
3. The RV32I/F VM executes `setup`.
4. If the sketch registers a draw callback, the VM repeatedly calls `draw`.
5. Core routines draw into the canvas framebuffer.
6. Debug macros write to the console/message area below the canvas.

## Core Organization

The core is split across assembly files for clarity. Typical areas are:

- Canvas and framebuffer setup.
- Drawing attributes such as fill, stroke, stroke weight, and stroke cap.
- Primitive drawing such as point, line, rectangle, circle, ellipse, triangle, arc.
- Shape construction with `BEGINSHAPE`, `VERTEX`, `IVERTEX`, and `ENDSHAPE`.
- Buffer-based paths with `POLYGON` and `POLYLINE`.
- Math, trigonometry, random, and noise helpers.
- Text rendering.
- Runtime helpers such as `ANIMATE`, `FRAMECOUNT`, `LOOP`, `NOLOOP`, and debug print macros.

## Test Workflow

Use the web tests after changes that affect assembling, preprocessing, runtime behavior, macro expansion, or bundled examples:

```powershell
node web-test\test_preproc.mjs
node web-test\test_e2e.mjs
```

For core changes:

```powershell
python web-static\build\build_core_fs.py
node web-test\test_preproc.mjs
node web-test\test_e2e.mjs
```

For sketch changes:

```powershell
python web-static\build\build_sketches_fs.py
node web-test\test_e2e.mjs
```
