# BRUT-V Agent Context

This repository is the static web version of BRUT-V, a creative coding framework for writing visual sketches in a compact RISC-V assembly dialect.

Use this file as the first orientation layer. Load the more specific files in `docs/agent/` only when the task needs them.

## What This Repo Contains

- `index.html`: browser UI, editor, canvas, console, sketch runner.
- `assembler.js`: JavaScript assembler with preprocessing, macro expansion, layout, encoding, diagnostics.
- `rv32if.js`: JavaScript RV32I/F virtual machine used by the browser.
- `agent-runtime.js`: shared bounded render/metadata helper used by agents and MCP.
- `core-fs.js`: generated embedded copy of `../core/*.s`.
- `sketches-fs.js`: generated embedded copy of selected `../sketches/*.asm`.
- `docs/`: user-facing documentation shown by the static site.
- `build/`: generation scripts for embedded core and sketch file systems.
- `hermes-skills/brut-v/`: portable Hermes skill for BRUT-V sketch generation, debugging, and runtime work.
- `hermes-skills/sketch/`: short `/sketch` Telegram command for image-only BRUT-V renders.
- `hermes-skills/source/`, `explain/`, `audit/`, `professor/`: professor-mode commands for retrieving, explaining, reviewing, and discussing saved sketches.
- `mcp/brut-v/`: local stdio MCP server exposing BRUT-V docs, sketches, validation tools, and prompts.
- `mcp/brut-v/atelier-runs/`: ignored local run store for agent-generated sketches, PNG renders, and metadata.
  The MCP server writes only to this controlled directory for atelier drafts.

The source-of-truth assembly framework lives one directory above this repo:

- `../core/`: original BRUT-V core sources.
- `../sketches/`: original sketch sources.
- `../web-test/`: development/debug/test tools, intentionally outside `web-static`.

## Agent Documentation

- `docs/agent/brutv-architecture.md`: project architecture and generated-file boundaries.
- `docs/agent/brutv-sketch-authoring.md`: how to write valid BRUT-V sketches.
- `docs/agent/brutv-macros.md`: macro conventions and high-value macro map.
- `docs/agent/brutv-web-runtime.md`: browser runtime, assembler, VM, canvas, console.
- `docs/agent/brutv-examples.md`: canonical sketch patterns to copy from.
- `docs/agent/hermes-integration.md`: Hermes integration surface, security model, and product direction.
- `docs/agent/hermes-creative-loop.md`: generate, render, critique, iterate workflow for Hermes and Telegram.
- `docs/agent/hermes-telegram-skills.md`: portable Telegram slash skills for the living atelier and professor mode.
- `hermes-skills/brut-v/SKILL.md`: installable Hermes skill entry point.
- `mcp/brut-v/server.mjs`: MCP server entry point for clients that support Model Context Protocol.

## Critical Rules

- Do not edit `core-fs.js` or `sketches-fs.js` by hand. Regenerate them.
- Core changes belong in `../core/*.s`, then run `python web-static/build/build_core_fs.py`.
- Sketch changes belong in `../sketches/*.asm`, then run `python web-static/build/build_sketches_fs.py`.
- Agent atelier drafts belong in ignored `mcp/brut-v/atelier-runs/`, not in shipped examples.
- Web-static is the Git repository. The parent directory is a broader workspace, not the repo.
- Sketches do not need `.include "../core/core.s"` in the web editor; the assembler imports `core.s` automatically.
- Keep examples simple, explicit, and close to Processing concepts where possible.

## Hermes Product Direction

The main product goal is a living BRUT-V atelier available from Hermes agents,
including a Telegram-connected Hermes bot. Hermes should be able to generate
sketches, call BRUT-V MCP tools, validate code, drive the runtime, retrieve a
render, critique it against a persistent style memory, and iterate.

The operational creative loop is: `get_atelier_context` -> generate or edit
source -> `render_and_save_sketch` -> inspect PNG and metadata -> critique
against the request/style memory -> iterate with `parentRunId` or report the
selected run.

The second major goal is professor mode. Hermes should help the user build
RISC-V skill by explaining sketches line by line, tracing register usage,
surfacing likely bugs, and connecting low-level instructions to the visual
output.

The current Telegram command surface is `/sketch`, `/source`, `/explain`,
`/audit`, and `/professor`. Exact instruction tracing remains future MCP work;
until then, professor commands should label register traces as conceptual
walkthroughs.

Recent Hermes capabilities such as durable multi-agent Kanban, subagent
delegation, memory, skills, MCP, automations, messaging, and voice should be
used to strengthen those two workflows rather than replace the user's creative
and pedagogical control.

## Verification Commands

Run from the parent workspace root:

```powershell
node web-test\test_preproc.mjs
node web-test\test_e2e.mjs
```

If core or sketches changed, regenerate first:

```powershell
python web-static\build\build_core_fs.py
python web-static\build\build_sketches_fs.py
```
