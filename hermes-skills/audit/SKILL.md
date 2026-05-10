---
name: audit
description: Review a BRUT-V sketch for validation, runtime, RARS compatibility, macro usage, register discipline, and likely visual issues. Use when the user invokes /audit or asks for a code review.
version: 0.1.0
author: BRUT-V maintainers
license: MIT
metadata:
  hermes:
    tags: [BRUT-V, Audit, Code Review, RISC-V, MCP]
---
# BRUT-V Audit Command

This skill reviews a saved or pasted BRUT-V sketch with a code-review and
teaching stance.

## Command Shape

```text
/audit
/audit last
/audit telegram-sketch-20260510 render-2026-05-10-172633620-dfd2f559
/audit verifie la compatibilite RARS
```

If no run is specified, audit the latest saved atelier run.

## Workflow

1. Resolve the target run with `list_agent_runs` if needed.
2. Retrieve source with `get_agent_run(includeSource: true,
   includeImageContent: false)`.
3. Call `validate_sketch` on the source.
4. Use `get_macro_reference` for any suspicious or central macro.
5. Review these areas:
   - assembler validation and diagnostics;
   - missing `ret` in callable procedures;
   - invalid label/immediate usage such as `li t0, label`;
   - state kept in clobber-prone `t*`, `ft*`, `a*`, or `fa*` registers;
   - missing or incorrect `ANIMATE draw` for animation;
   - loops that may hit the runtime step limit;
   - RARS compatibility risks;
   - visual risks such as blank output, off-canvas coordinates, or invisible
     foreground/background contrast.

## Output Style

Lead with findings ordered by severity. Use this shape:

```text
Findings
1. High: ...
2. Medium: ...

No blocking issues found.

Notes
...
```

When there are no serious issues, say that clearly and mention remaining test
or trace limitations.

Do not rewrite the sketch unless the user asks. Do not edit repo source files.
