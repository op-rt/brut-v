# Hermes Telegram Skills

This document defines the portable slash-command layer for using BRUT-V from a
Telegram-connected Hermes agent.

## Install Surface

Install the skills from this repository into the active Hermes skills directory:

```text
hermes-skills/brut-v
hermes-skills/sketch
hermes-skills/source
hermes-skills/explain
hermes-skills/audit
hermes-skills/professor
```

On a Hostinger Hermes container the active skills directory may be
`/opt/data/skills/software-development/`. On a regular Hermes install it may be
`~/.hermes/skills/`. Keep the tracked copies in `hermes-skills/` as the source
of truth, then sync or symlink them into the active Hermes skills directory.

## Commands

```text
/sketch <drawing brief>
/sketch --details <drawing brief>
/source [last|sessionId [runId]]
/explain [last|sessionId [runId]] [question]
/audit [last|sessionId [runId]]
/professor [last|sessionId [runId]] <question>
```

## `/sketch`

Use `/sketch` for image-first creation. The user should be able to write:

```text
/sketch cree une grille de cercles 4x4 noirs rayon 80 pixels
```

The agent should use `get_atelier_context`, generate a BRUT-V sketch, then call
`audit_sketch_constraints` for briefs with geometry, tangent, radius,
draw-order, label, or selected/unselected styling constraints. Repair
high-severity findings before calling `render_and_save_sketch` with
`includeImageContent: false` and `includePngBase64: false`.

If the brief asks for an algorithm, the algorithm belongs in the sketch. Do not
use Python or another external tool to choose random elements, sort them, rank
them, or compute paths. Use external tools only for operational work such as
installing, testing, or inspecting files. A request such as "select 12 circles
randomly and calculate a shortest path" should produce RISC-V code that calls
BRUT-V random macros, stores selection arrays, compares distances, and writes
ranks at runtime.

For path prompts, prefer a named heuristic rather than a false exact claim. A
good default for 12 selected grid points is: nearest-neighbor initial route,
then a bounded 2-opt style swap pass over the `order` array using squared center
distances.

For label prompts, use `ITEXT_SIZE 1` for small text and center labels by
setting `ITEXT_ALIGN CENTER, CENTER` before `TEXT`. Do not use large text scales
or fixed offsets for one- and two-digit rank labels.

Before sending the final `MEDIA:` response, inspect the generated source for the
requested visual constraints. For selected/unselected circles, require a branch
from the `selected` state with `ISTROKE BLACK` for selected circles and
`ISTROKE GREY` for unselected circles before each `CIRCLE`. For white circles,
set `IFILL WHITE` or `NO_FILL` before the circle pass, then switch to
`IFILL BLACK` only for rank labels or other filled black marks. Reject and
rerender sketches that redraw all circles with the same final stroke.

For labels inside circles, require `ITEXT_SIZE 1`,
`ITEXT_ALIGN CENTER, CENTER`, and `TEXT` at the actual center coordinates. Do
not accept hand-offset text positions such as `centerX - 3`; the alignment
macro exists so one- and two-digit labels are centered as whole strings. If a
brief says "number them 112" while selecting 12 items, treat it as `1-12`.

For tangent or arc prompts, preserve the user's geometric radius. If the prompt
says `r=50`, "same r", or "no shrinking", the tangent and arc construction must
use the same radius as the displayed `CIRCLE`; do not silently use an inset
helper radius to avoid intersections. Reject sources that contain a smaller
tangent radius, `r - stroke`, `inner radius`, or similar shrinkage unless the
user explicitly asked for inset geometry. Include a source comment such as
`# RADIUS_INVARIANT: DRAWN_CIRCLE_R == TANGENT_ARC_R == 50` so the MCP audit can
verify the invariant before rendering. Also state and implement the boundary
condition: each tangent point must satisfy `(px-cx)^2 + (py-cy)^2 == R^2`
within the sketch's integer or fixed-point approximation.
For nontrivial tangent prompts, load the tangent geometry reference before
writing the sketch.

For layering prompts, remember that BRUT-V draws immediately: later drawing is
visually on top. If the user asks for the final black filled polygon on top of
the white circles, the source must draw the grid/circles first, then set black
fill and draw the polygon after the circle pass. Reject sources that draw the
filled polygon before the grid, or redraw the white circles after the overlay.

On success, the final response should contain exactly one line:

```text
MEDIA:/root/brut-v/mcp/brut-v/atelier-runs/<sessionId>/<runId>/render.png
```

This produces one native Telegram image attachment and hides technical metadata
from the normal user flow.

## Professor Commands

`/source`, `/explain`, `/audit`, and `/professor` operate on saved atelier runs.
They should resolve `last` through `list_agent_runs`, retrieve source through
`get_agent_run`, and use `validate_sketch`, `get_macro_reference`, `read_doc`,
or `search_docs` only as needed.

These skills must not modify repo sketches. They can explain, review, and teach
from saved atelier source. Exact execution tracing is future MCP work; until
`trace_sketch` exists, register traces should be described as conceptual
walkthroughs.

## Failure Handling

If `/sketch` fails, return concise visible diagnostics instead of a silent
message. Include the validation/runtime problem and the `sessionId`/`runId` if
known. For professor commands, lead with the direct answer, then cite the code
or macro behavior that supports it.
