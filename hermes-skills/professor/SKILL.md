---
name: professor
description: Answer pedagogical questions about BRUT-V sketches, RISC-V assembly behavior, macros, registers, and visual output. Use when the user invokes /professor or asks teaching-oriented questions about BRUT-V code.
version: 0.1.0
author: BRUT-V maintainers
license: MIT
metadata:
  hermes:
    tags: [BRUT-V, Professor Mode, RISC-V, Teaching, MCP]
---
# BRUT-V Professor Command

This skill is the conversational professor mode for BRUT-V.

Use it when the user asks a focused question about a sketch, macro, register,
procedure, bug, or rendered image.

## Command Shape

```text
/professor pourquoi le rendu est presque entierement noir ?
/professor last explique le role de t0 et t1
/professor telegram-sketch-20260510 render-... que fait la boucle principale ?
```

If no run is specified, use the latest saved atelier run.

## Workflow

1. Identify the user's question.
2. Resolve and retrieve the relevant run with `list_agent_runs` and
   `get_agent_run(includeSource: true, includeImageContent: false)` when a saved
   run is needed.
3. Use `read_doc`, `search_docs`, or `get_macro_reference` only for references
   that directly answer the question.
4. If the question is about validity or an error, call `validate_sketch`.
5. Answer pedagogically:
   - name the relevant labels and procedures;
   - explain register roles and lifetime;
   - connect macro calls to visual effects;
   - distinguish confirmed behavior from inference;
   - suggest a small experiment the user can try.

## Trace Boundary

Until the MCP server exposes `trace_sketch`, do not pretend to have an exact
instruction-by-instruction trace. Provide a conceptual register walkthrough
based on the source, and label it as such.

## Output Style

Be concise but educational. Avoid dumping the full code unless the user asks
for `/source`. Prefer concrete explanations tied to line labels, macro calls,
and register names.
