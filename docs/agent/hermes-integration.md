# Hermes Integration For BRUT-V

This document defines the stable agentic base for connecting BRUT-V to Hermes.
It is intentionally practical: agents should use it to know what exists today,
what is safe to call, and what remains future work.

## Product Goals

BRUT-V x Hermes has two primary workflows.

1. Living atelier: Hermes acts as a creative assistant that can generate a
   BRUT-V sketch, validate it, run it, capture the rendered image, critique the
   result against a persistent style memory, and iterate.
2. Professor mode: Hermes acts as a RISC-V tutor that can explain a sketch line
   by line, trace register usage, identify likely mistakes, and connect assembly
   behavior to visual output.

The atelier should be reachable from any Hermes agent and, as a priority
interaction surface, from the user's Hermes Telegram bot.

## Current Stable Surfaces

- `HERMES.md`: top-level repository orientation for agents.
- `docs/agent/*.md`: focused agent documentation for architecture, sketch
  authoring, macros, runtime behavior, examples, and this Hermes integration.
- `docs/agent/hermes-creative-loop.md`: operational generate, render, critique,
  iterate loop for Hermes and Telegram.
- `hermes-skills/brut-v/`: portable Hermes skill with compact references.
- `hermes-skills/sketch/`: short `/sketch` command that renders an image from a
  drawing brief and sends it through Telegram with a single `MEDIA:` line.
- `hermes-skills/source/`: `/source` command to retrieve saved sketch assembly.
- `hermes-skills/explain/`: `/explain` command for line-by-line professor mode.
- `hermes-skills/audit/`: `/audit` command for review and RARS/runtime risks.
- `hermes-skills/professor/`: `/professor` command for focused teaching Q&A.
- `mcp/brut-v/`: local stdio MCP server exposing docs, sketches, validation,
  rendering, controlled atelier run storage, and workflow prompts.
- `mcp/brut-v/atelier-runs/`: ignored local run store for agent-generated sketches, PNG
  renders, and metadata.

The MCP server now has constrained write access only inside `mcp/brut-v/atelier-runs/`.
It can read docs/sketches, validate sketches, render bounded PNG captures, save
draft sketches, and persist run metadata. It does not edit source-of-truth
sketches, regenerate generated files, or publish sketches.

## MCP Configuration

Local Hermes agents should configure the BRUT-V MCP server as a stdio server:

```json
{
  "command": "node",
  "args": ["C:/Users/Louis/Downloads/BRUT-V/web-static/mcp/brut-v/server.mjs"]
}
```

Use the same MCP server from Telegram-connected Hermes agents. The Telegram bot
should not implement its own BRUT-V logic; it should call the same tools as any
other Hermes agent so behavior stays consistent.

Remote Hermes agents should reach BRUT-V through a deliberately configured
bridge, not through unrestricted filesystem access. The bridge should expose
only the MCP server and future approved runtime endpoints.

## Current MCP Tools

- `list_docs`: list exposed BRUT-V documentation resources.
- `read_doc`: read an exposed documentation resource.
- `search_docs`: search exposed documentation resources.
- `list_sketches`: list embedded web sketches and source sketches on disk.
- `get_sketch`: read a sketch from disk or embedded web-static sources.
- `validate_sketch`: assemble a provided sketch with the browser assembler.
- `validate_existing_sketch`: assemble an existing sketch.
- `get_macro_reference`: return the macro reference, optionally filtered.
- `render_sketch`: assemble, execute, and return a PNG capture for provided or
  existing sketch source.
- `save_agent_sketch`: save a generated sketch and metadata in `mcp/brut-v/atelier-runs/`.
- `render_and_save_sketch`: render a sketch, then save source, PNG, and metadata.
- `list_agent_runs`: list saved atelier attempts.
- `get_agent_run`: retrieve a saved run, with optional source and image content.
- `get_atelier_context`: retrieve recent session history and optionally a
  selected run with source and image for iteration.

## Current MCP Prompts

- `create-brutv-sketch`: generate a complete sketch from a request.
- `debug-brutv-sketch`: debug a sketch using diagnostics and conventions.
- `explain-brutv-macro`: explain a macro and its usage.
- `port-processing-to-brutv`: port a Processing-style idea to BRUT-V.
- `start-brutv-atelier-session`: structure a creative iteration session.
- `run-brutv-creative-loop`: guide Hermes through generate/render/critique/iterate.
- `continue-brutv-iteration`: guide Hermes through a parent-run iteration.
- `extract-brutv-style-memory`: derive durable memory candidates from feedback.
- `teach-brutv-sketch`: structure a professor-mode explanation.

## Telegram Command Surface

The intended short command surface is:

```text
/sketch <drawing brief>
/sketch --details <drawing brief>
/source [last|sessionId [runId]]
/explain [last|sessionId [runId]] [question]
/audit [last|sessionId [runId]]
/professor [last|sessionId [runId]] <question>
```

`/sketch` should be terse. On success, the Telegram-visible reply should be the
native image attachment only, implemented with one final absolute `MEDIA:` path:

```text
MEDIA:/root/brut-v/mcp/brut-v/atelier-runs/<sessionId>/<runId>/render.png
```

Use `render_and_save_sketch(includeImageContent: false)` when sending through
`MEDIA:` to prevent duplicate attachments. Show `sessionId`, `runId`, paths, or
diagnostics only in details mode or failure mode.

For algorithmic drawing briefs, the computation must live in the generated
BRUT-V sketch. Do not use Python, JavaScript, shell tools, or model-side
precomputation to choose random elements, sort, rank, pathfind, or simulate.
External tools may support operations such as install, test, and file
inspection, but not the creative algorithm requested by the user.

For complex `/sketch` prompts, prioritize readable assembly structure: named
procedures, bounded loops, arrays for state, and helper macros such as
`ITEXT_ALIGN CENTER, CENTER`. A visually acceptable render is not sufficient
when the source ignores requested algorithmic behavior or style constraints.

## Security Model

Agents must treat BRUT-V as a constrained creative environment, not as a general
filesystem shell.

- Do not expose arbitrary file reads or writes through MCP.
- Keep write tools scoped to `mcp/brut-v/atelier-runs/` or explicit user-approved paths.
- Keep runtime capture tools bounded by frame count, instruction count, timeout,
  and output size.
- Never hand-edit generated files such as `core-fs.js` or `sketches-fs.js`.
- Regeneration tools must be explicit, named, and auditable.
- Telegram and voice commands should map to the same constrained MCP tools.

## Style Memory

Hermes should maintain a persistent private style memory for the user. It should
record recurring preferences, rejected directions, approved sketches, palette
habits, density, rhythm, composition rules, macro patterns, and constraints such
as RARS compatibility.

Project-level style rules that are safe to share can later live in a tracked
document such as `docs/agent/style-profile.md`. Private taste and personal
interaction history should remain in Hermes memory.

## Atelier Run Store

Saved runs use:

```text
mcp/brut-v/atelier-runs/<sessionId>/<runId>/
  sketch.asm
  render.png
  metadata.json
```

`metadata.json` records the prompt, style-memory excerpt if provided, parent run,
validation result, runtime result, image stats, tags, notes, and relative file
paths. The directory is ignored by Git because it may contain private taste,
prompts, and iterative drafts.

## Future Atelier Tools

The next MCP/runtime layer should add:

- `compare_agent_runs`: compare image metadata and selected renders.
- `promote_agent_run`: copy a selected draft into a deliberate source path.
- `regenerate_sketches_fs`: regenerate embedded sketches only on explicit call.
- `run_tests`: run the relevant BRUT-V test suite.

These tools should call a stable browser/runtime hook rather than scrape DOM
details.

## Browser Runtime Hook

The web app exposes:

```js
window.BRUTV_AGENT = {
  listSketches,
  getSource,
  setSource,
  assemble,
  run,
  render,
  runFrames,
  stop,
  getConsole,
  getCanvasImageData,
  getCanvasPng
};
```

This API now exists on the browser page as `window.BRUTV_AGENT`. It is the
intended contract between BRUT-V, MCP, browser automation, Telegram, voice
commands, and professor mode.

## Future Professor Tools

Professor mode should eventually add:

- `expand_sketch`: return preprocessed source and macro expansion.
- `explain_sketch`: explain source line by line.
- `trace_registers`: trace register changes over a bounded execution window.
- `explain_error`: turn assembler/runtime errors into actionable teaching.
- `explain_visual_effect`: connect assembly behavior to the rendered output.

Register tracing must be bounded by procedure, instruction count, and timeout.

## Multi-Agent Kanban

Hermes Kanban should be used after the render/capture loop exists. Useful roles:

- generator: produce candidate sketches;
- verifier: validate BRUT-V and RARS compatibility where needed;
- renderer: capture images and metadata;
- critic: compare outputs to style memory;
- professor: explain selected versions;
- curator: archive good patterns and consolidate reusable skills.

Suggested columns: `Ideas`, `Generated`, `Validated`, `Rendered`, `Selected`,
`Refined`, `Archived`.

## Stabilization Checklist

The agentic base is considered stable when:

- agent docs are tracked in Git;
- the MCP server starts with `npm run check`;
- Hermes can list docs, tools, and sketches through MCP;
- the skill points to the right references;
- security limits are documented before write/runtime tools are added;
- generated files are not edited by hand.
