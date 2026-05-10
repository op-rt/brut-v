---
name: sketch
description: Short Telegram command for generating a BRUT-V render from a drawing brief. Use when the user invokes /sketch or asks for an immediate BRUT-V image from concise visual instructions.
version: 0.1.0
author: BRUT-V maintainers
license: MIT
metadata:
  hermes:
    tags: [BRUT-V, Telegram, Creative Coding, Rendering, MCP]
---
# BRUT-V Sketch Command

This skill is the short-form Telegram entry point for the BRUT-V living atelier.
It turns a compact drawing brief into one rendered image.

## Command Shape

Expected use:

```text
/sketch cree une grille de cercles 4x4 noirs rayon 80 pixels
/sketch dessine une spirale carree blanche sur fond noir
/sketch animation minimaliste de lignes verticales qui balayent une grille
```

The text after `/sketch` is the creative brief. Do not ask the user to mention
BRUT-V, MCP, session ids, run ids, or media delivery.

## Default Behavior

1. Treat the user message as a BRUT-V drawing request.
2. Use the configured `brut_v` MCP server.
3. Build a stable session id such as `telegram-sketch-YYYYMMDD`.
4. Call `get_atelier_context` with the session id and brief.
5. Generate a complete BRUT-V sketch using the BRUT-V macro conventions.
6. If the brief does not request motion, prefer a static sketch and `frames: 1`.
7. If the brief asks for animation, use `ANIMATE draw` correctly and render 18
   to 24 frames.
8. Call `render_and_save_sketch` with:
   - `includeImageContent: false`
   - `includePngBase64: false`
   - the generated `sessionId`
   - the original brief in `prompt`
9. If validation or rendering fails, correct the sketch once and render again.
10. Build the absolute PNG path:

```text
/root/brut-v/mcp/brut-v/atelier-runs/<sessionId>/<runId>/render.png
```

11. Verify that the PNG exists.
12. If the render is OK, reply with exactly one media line and no other text:

```text
MEDIA:/root/brut-v/mcp/brut-v/atelier-runs/<sessionId>/<runId>/render.png
```

## Telegram Output Rules

For a successful normal `/sketch` request, the final visible Telegram result
should be only the native image attachment.

- Do not say `Done`.
- Do not show `sessionId`, `runId`, file paths, or diagnostics.
- Do not include more than one `MEDIA:` line.
- Do not return both MCP image content and a `MEDIA:` path. Use
  `includeImageContent: false` when calling `render_and_save_sketch`.
- Do not use a relative path in `MEDIA:`.

## Details Mode

If the user includes `--details`, `details`, `diagnostic`, `runId`, `source`, or
`chemin`, keep the image attachment but also include concise metadata:

```text
sessionId: telegram-sketch-YYYYMMDD
runId: render-...
diagnostic: ...
MEDIA:/root/brut-v/mcp/brut-v/atelier-runs/<sessionId>/<runId>/render.png
```

## Failure Mode

Only provide visible technical text when rendering fails or the PNG does not
exist. Include the validation/runtime issue, the attempted `sessionId` and
`runId` if known, and one concrete next action.
