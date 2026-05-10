# Creative Loop

Use this reference when Hermes is asked to create, iterate, or curate BRUT-V
visual work.

## Protocol

1. Call `get_atelier_context` with the current `sessionId`, request, and style
   memory.
2. Generate or edit a complete BRUT-V sketch.
3. Call `render_and_save_sketch`.
4. Inspect the PNG and metadata.
5. Critique the result against the user request and style memory.
6. Iterate with `parentRunId` if there is a concrete improvement to make.
7. Return the image/run id and concise next options.

## Telegram Reply Shape

Keep regular atelier replies short:

- rendered image;
- `sessionId` and `runId`;
- one-sentence critique;
- next commands such as `iterer`, `expliquer`, `variante`, `sauver`.

Do not paste full source unless requested.

For the short `/sketch` command, use image-only delivery on success:

```text
MEDIA:/root/brut-v/mcp/brut-v/atelier-runs/<sessionId>/<runId>/render.png
```

Rules for Telegram media delivery:

- use the absolute PNG path, never the relative MCP path;
- call `render_and_save_sketch` with `includeImageContent: false` when using a
  final `MEDIA:` line, otherwise Telegram may receive duplicate images;
- include exactly one `MEDIA:` line for a successful normal `/sketch`;
- omit visible `sessionId`, `runId`, paths, and diagnostics unless the user asks
  for details or the render fails.

## Style Memory

Use Hermes memory for durable preferences. After explicit feedback, use
`extract-brutv-style-memory` to produce memory candidates. Store only recurring
or clearly stated preferences, not one-off prompt details.

## Tool Notes

- Use `render_and_save_sketch` for candidates that should be preserved.
- Use `get_atelier_context` or `get_agent_run` before editing a prior run.
- Pass `parentRunId` for every iteration.
- Tag failed but useful attempts with `failed-validation`, `runtime-error`, or
  `blank`.
