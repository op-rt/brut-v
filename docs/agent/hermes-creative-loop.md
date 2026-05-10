# Hermes Creative Loop

This document defines how a Hermes agent should operate BRUT-V as a living
atelier. The MCP server provides tools and storage; Hermes provides creative
judgment, style memory, and conversation.

## Loop Contract

Use this loop for creative requests:

1. Gather context with `get_atelier_context`.
2. Generate a complete BRUT-V sketch or edit the selected parent sketch.
3. Render and persist the candidate with `render_and_save_sketch`.
4. Inspect the returned PNG, validation, runtime, console output, and image
   metadata.
5. Critique the result against the user request and Hermes style memory.
6. Iterate with `parentRunId` only when the critique implies a concrete code
   change.
7. Return the selected image/run id and the next useful actions.

Do not stop after text generation. A creative candidate is not complete until it
has been rendered or a concrete runtime blocker has been reported.

## Tool Sequence

For a new session:

```text
get_atelier_context(sessionId, request, styleMemory, limit=8)
render_and_save_sketch(source, sessionId, prompt=request, styleMemory, tags)
```

For an iteration:

```text
get_atelier_context(sessionId, runId=parentRunId, includeSource=true, includeImageContent=true)
render_and_save_sketch(source, sessionId, parentRunId, prompt=request, styleMemory, tags)
```

For review:

```text
list_agent_runs(sessionId)
get_agent_run(sessionId, runId, includeSource=true, includeImageContent=true)
```

## Session And Run IDs

Use stable `sessionId` values for a creative thread. Good ids are short, ASCII,
and descriptive, for example:

```text
telegram-2026-05-10-noise-totem
voice-2026-05-10-cube-study
kanban-2026-05-10-black-white-field
```

Each rendered candidate gets a `runId`. When iterating, always pass
`parentRunId` so the lineage remains visible.

## Critique Discipline

Critique the image before editing. A useful critique names concrete traits:

- composition: balance, scale, figure/ground, empty space;
- motion: speed, rhythm, frame-to-frame continuity;
- texture: density, noise, stroke, raster quality;
- palette: contrast, background, accent restraint;
- BRUT-V fit: macro idioms, RARS compatibility, register discipline.

Avoid generic praise. Turn each critique into one actionable change or stop.

## Failure Handling

If validation fails, use diagnostics and macro references before changing the
visual idea.

If runtime fails or hits the step limit, simplify control flow, check missing
`ret`, and inspect loops.

If the image is blank or nearly blank, check canvas setup, background/fill order,
coordinate range, color contrast, and whether animation stopped before a useful
frame.

Save failed attempts only when they are useful for diagnosis. Tag them
`failed-validation`, `runtime-error`, or `blank`.

## Telegram Mode

Regular Telegram atelier replies should be compact:

- send or attach the PNG when available;
- include `sessionId` and `runId`;
- include one sentence of critique;
- offer two or three commands such as `iterer`, `expliquer`, `variante`,
  `sauver`, or `plus minimal`.

Do not paste full source in Telegram unless the user asks.

For the short `/sketch` skill, use image-only delivery on success. The final
assistant response should contain exactly one media directive and no other
visible text:

```text
MEDIA:/root/brut-v/mcp/brut-v/atelier-runs/<sessionId>/<runId>/render.png
```

When using this `MEDIA:` path, call `render_and_save_sketch` with
`includeImageContent: false` and `includePngBase64: false` so the gateway does
not deliver both the MCP image content and the local PNG file. Show metadata
only for details mode or failures.

## Style Memory

Use Hermes private memory for durable taste:

- preferred density, contrast, palette, rhythm, geometry, and motion;
- repeated rejections;
- selected runs and why they worked;
- coding constraints such as RARS compatibility or register discipline.

Use the `extract-brutv-style-memory` prompt after explicit feedback such as
"garde cette direction", "trop decoratif", "plus austere", or "je prefere cette
version".

## Kanban Mode

For multi-agent Hermes workflows:

- generator agents create candidates;
- renderer agents call `render_and_save_sketch`;
- critic agents inspect images and metadata;
- verifier agents check BRUT-V/RARS risks;
- curator agents select runs and propose style-memory updates.

All agents should write to the same `sessionId` and use `parentRunId` for
lineage.
