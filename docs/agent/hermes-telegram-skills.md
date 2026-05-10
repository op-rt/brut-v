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
`render_and_save_sketch` with `includeImageContent: false` and
`includePngBase64: false`.

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
