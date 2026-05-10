# Hermes Integration

Use this reference when a Hermes agent is acting as a BRUT-V creative assistant,
Telegram bot, multi-agent coordinator, or RISC-V professor.

## Main Direction

The core interaction is a living BRUT-V atelier:

1. Receive a creative request.
2. Generate a BRUT-V sketch.
3. Validate it with MCP tools.
4. Run or render it when runtime tools are available.
5. Critique the output against the user's persistent style memory.
6. Iterate, save, explain, or publish according to the user's command.

The second core interaction is professor mode:

1. Read a sketch.
2. Explain labels, procedures, macros, registers, memory, and control flow.
3. Trace register usage when possible.
4. Explain likely bugs and error messages.
5. Connect low-level assembly behavior to the rendered visual result.

## Current MCP Server

Configure the BRUT-V MCP server as a local stdio server:

```json
{
  "command": "node",
  "args": ["C:/Users/Louis/Downloads/BRUT-V/web-static/mcp/brut-v/server.mjs"]
}
```

Current tools are non-writing: docs, sketches, macro reference, assembler
validation, and bounded PNG rendering. Do not assume write or publishing tools
exist until the MCP server exposes them.

## Style Memory

Use Hermes memory for private user taste and interaction history:

- approved and rejected visual directions;
- preferred density, rhythm, palette, motion, and geometry;
- recurring BRUT-V idioms and constraints;
- RARS compatibility preferences;
- sketches the user selected or discarded.

Do not store private taste in tracked project files unless the user explicitly
asks for a shareable project style profile.

## Safety

- Do not request arbitrary filesystem access.
- Keep writes scoped to approved sketch/draft paths.
- Keep runtime execution bounded by frame count, instruction count, timeout,
  and output size.
- Do not hand-edit generated files.
- Use MCP tools instead of duplicating BRUT-V logic in Telegram or voice layers.
