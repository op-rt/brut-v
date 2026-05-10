---
name: source
description: Retrieve and send the assembly source for a saved BRUT-V atelier run. Use when the user invokes /source or asks to see the code behind the last BRUT-V render.
version: 0.1.0
author: BRUT-V maintainers
license: MIT
metadata:
  hermes:
    tags: [BRUT-V, Source, Assembly, Telegram, MCP]
---
# BRUT-V Source Command

This skill retrieves the saved `sketch.asm` for a BRUT-V atelier run.

## Command Shape

```text
/source
/source last
/source telegram-sketch-20260510
/source telegram-sketch-20260510 render-2026-05-10-172633620-dfd2f559
```

If the user gives no run id, use the most recent run from `list_agent_runs`.
If the user gives a session id but no run id, use the newest run in that
session.

## Workflow

1. Resolve the target run:
   - call `list_agent_runs(limit=1)` when no session is provided;
   - call `list_agent_runs(sessionId, limit=1)` when only a session is provided;
   - use the provided `runId` directly when available.
2. Call `get_agent_run` with:
   - `includeSource: true`
   - `includeImageContent: false`
   - `includePngBase64: false`
3. Return the source in a fenced `asm` code block.
4. Include only a compact header with `sessionId` and `runId`.

## Output Shape

````text
sessionId: ...
runId: ...

```asm
...
```
````

Do not render again unless the user asks for a fresh image. Do not modify any
repo sketch.
