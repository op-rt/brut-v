---
name: explain
description: Explain a BRUT-V sketch line by line from a saved atelier run or pasted assembly source. Use when the user invokes /explain or asks how a BRUT-V sketch works.
version: 0.1.0
author: BRUT-V maintainers
license: MIT
metadata:
  hermes:
    tags: [BRUT-V, Professor Mode, RISC-V, Explanation, MCP]
---
# BRUT-V Explain Command

This skill is the line-by-line professor mode for BRUT-V sketches.

## Command Shape

```text
/explain
/explain last
/explain telegram-sketch-20260510 render-2026-05-10-172633620-dfd2f559
/explain pourquoi t0 est utilise ici ?
```

If no target run is specified, explain the latest saved atelier run.

## Workflow

1. Resolve the run with `list_agent_runs` when needed.
2. Retrieve source with `get_agent_run(includeSource: true,
   includeImageContent: false)`.
3. Load macro context with `get_macro_reference` when a macro is central to the
   explanation.
4. Optionally call `validate_sketch` if the source has not already been
   validated or if the user asks about an error.
5. Explain the sketch in teaching order:
   - global structure and visual intent;
   - `.data`, constants, labels, and state;
   - `main`, `setup`, `draw`, and helper procedures;
   - macro calls and their Processing-like meaning;
   - register roles and which values must survive macro calls;
   - how low-level operations become the final image.

## Output Style

Keep Telegram answers readable. Start with a short overview, then explain the
important lines or blocks. Do not paste the whole source unless the user asks
for `/source`.

For a line-by-line request, use compact bullets:

```text
L12: li t0, 4
Charge la constante 4 dans t0; ici elle sert de compteur de colonnes.
```

If the user asks for a register trace, provide a conceptual walkthrough only and
state that exact bounded tracing will be available after the future
`trace_sketch` MCP tool.
