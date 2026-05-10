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

## Algorithmic Integrity

The sketch must implement the user's algorithmic request in BRUT-V assembly.
Do not use Python, JavaScript, shell tools, or offline reasoning to precompute
creative state that the user asked the sketch to calculate.

This is especially important for briefs that say:

- randomly choose, shuffle, sort, rank, pathfind, simulate, distribute, pack, or
  calculate;
- shortest path, nearest neighbor, distance field, grid selection, stochastic
  layout, cellular automata, particle system, or generative rules.

For those briefs:

- random choices must be produced in the sketch with `IRANDOM`, `RANDOM`,
  `IRANDOMF`, `RANDOMF`, or `RANDOM24`;
- sorting, ranking, nearest-neighbor walks, and distance comparisons must be
  implemented with RISC-V loops, arrays, and integer or float arithmetic;
- tables may contain user-specified constants such as grid coordinates, label
  strings, or fixed palette values;
- tables must not contain the final random selection, final path order, final
  ranks, or other computed result unless the user explicitly requests a fixed
  static composition.

If a complex algorithm is too large, implement a clear bounded approximation in
assembly and name it in details mode. For example, use a nearest-neighbor path
heuristic rather than claiming an exact traveling-salesman optimum.

## Complex Brief Quality Bar

For grid-selection/path/ranking prompts, generate structured assembly, not a
long unrolled drawing script.

Prefer named procedures such as:

- `init_grid`
- `select_unique_random`
- `build_initial_path`
- `improve_path_2opt`
- `draw_path`
- `draw_circles`
- `draw_ranks`

Use arrays for `xs`, `ys`, `selected`, `visited`, `order`, and `ranks`. Keep
loops bounded with literal counts such as 16 points, 12 selected points, and a
small fixed number of 2-opt passes.

When the user asks for "shortest path" over more than a few points, do not claim
an exact optimum unless the sketch actually searches the full solution space.
Use a nearest-neighbor initial path plus bounded 2-opt style swaps, and describe
it as a 2-opt heuristic in details mode.

Respect visual constraints exactly:

- selected circles with black stroke;
- unselected circles with grey stroke;
- white circle fill when requested;
- set stroke color and stroke weight inside the selected/unselected branch;
- draw unselected and selected states from the `selected` array, never from a
  hardcoded visual pass.

For labels inside circles:

- "small characters" means `ITEXT_SIZE 1` unless the user explicitly asks for
  larger text;
- use `ITEXT_ALIGN CENTER, CENTER` before `TEXT` to center labels in the circle;
- for two-digit labels, measure and center the whole string, do not place digits
  manually;
- draw labels after circles and choose a fill color that remains legible.

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
