---
name: brut-v
description: Generate, edit, explain, and debug BRUT-V sketches and web-runtime changes. Use when working with the BRUT-V creative-coding framework, RISC-V assembly sketches, Processing-style macros, core macros, generated web-static files, agent documentation, or browser canvas interaction.
version: 0.1.0
author: BRUT-V maintainers
license: MIT
metadata:
  hermes:
    tags: [Creative Coding, RISC-V, Assembly, Canvas, Web, Agent Integration]
---
# BRUT-V

Use this skill to write or modify BRUT-V sketches, explain framework behavior, update macros and examples, or reason about the static web runtime.

BRUT-V is a creative coding framework where visual sketches are written in a compact RISC-V assembly dialect using Processing-like macros.

## Load References

- For repository layout and generated-file rules, load `skill_view("brut-v", "references/architecture.md")`.
- For writing valid sketches, load `skill_view("brut-v", "references/sketch-authoring.md")`.
- For available macros and naming conventions, load `skill_view("brut-v", "references/macro-api.md")`.
- For browser/runtime/canvas integration, load `skill_view("brut-v", "references/web-runtime.md")`.
- For copyable sketch patterns, load `skill_view("brut-v", "references/examples.md")`.
- For Hermes atelier, Telegram, memory, MCP, and professor-mode direction, load `skill_view("brut-v", "references/hermes-integration.md")`.
- For the generate-render-critique-iterate loop, load `skill_view("brut-v", "references/creative-loop.md")`.

## Default Workflow

1. Classify the task: sketch authoring, macro/core change, web-runtime change, documentation change, or debugging.
2. Load only the reference files needed for that task.
3. If editing a local BRUT-V checkout, respect source-of-truth boundaries: core edits go in `core/*.s`, sketch edits go in `sketches/*.asm`, and generated web files are regenerated.
4. Prefer immediate macros for static literal values and register macros for computed, animated, loaded, or random values.
5. Preserve the simple Processing-style mental model: `setup` configures once, `draw` animates when registered.
6. Always verify that sketches end their callable procedures with `ret`.

## Hermes Workflows

For a creative atelier request, generate a sketch, validate it through the BRUT-V MCP server when available, then iterate from diagnostics or render feedback. Reuse the user's persistent style memory when choosing composition, palette, motion, density, and constraints.

For a professor-mode request, explain the sketch in terms of concrete RISC-V behavior: labels, procedures, registers, memory, macro expansion, control flow, and the visual effect of the code. Prefer teaching the user how to reason about the sketch over merely giving a fixed answer.

When MCP atelier tools are available, do not treat source generation as the end
of a creative task. Render and save candidates with `render_and_save_sketch`,
use `parentRunId` for iterations, and report the selected `sessionId`/`runId`.

## Critical Rules

- Do not add `.include "../core/core.s"` to web sketches. The web assembler imports the core automatically.
- Do not hand-edit `web-static/core-fs.js` or `web-static/sketches-fs.js`; regenerate them from source files.
- Use `la` for labels and `li` for immediate constants. `li t0, tau` is invalid because `tau` is a label address.
- Use `s*` and `fs*` registers for state that must survive macro calls.
- Use `t*`, `ft*`, `a*`, and `fa*` only for short-lived scratch or arguments unless the macro contract says otherwise.
- Immediate float arguments are raw IEEE-754 bit patterns, not decimal float literals.

## Verification

When working in the full BRUT-V workspace, run from the workspace root:

```powershell
node web-test\test_preproc.mjs
node web-test\test_e2e.mjs
```

After editing core or sketch sources, regenerate first:

```powershell
python web-static\build\build_core_fs.py
python web-static\build\build_sketches_fs.py
```

If no local checkout or test runner is available, still check these invariants manually: no missing `ret`, no invalid `li label`, no accidental generated-file-only edit, no stale `.include "../core/core.s"`, and no persistent state held only in clobber-prone registers.
