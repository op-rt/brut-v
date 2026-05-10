# BRUT-V MCP Server

Local stdio MCP server for BRUT-V. It is the stable entry point for Hermes
agents that need BRUT-V documentation, sketches, validation, and workflow
prompts.

It exposes:

- BRUT-V agent documentation as MCP resources.
- Bundled sketches as MCP resources.
- Tools to list/read/search docs and sketches.
- Tools to validate sketch source with the browser assembler.
- A tool to render a sketch through the headless BRUT-V runtime and return a PNG capture.
- Prompts for sketch creation, debugging, macro explanation, and Processing-to-BRUT-V translation.
- Prompts for the living atelier and professor-mode workflows.

This version is still non-writing. It can validate and render, but it does not
edit files, regenerate generated files, or publish sketches.

## Install

From this directory:

```powershell
npm install
```

## Run

```powershell
npm start
```

or:

```powershell
node server.mjs
```

## Hermes Configuration

Use this server as a local stdio MCP server. The command should point to this
package's `server.mjs`:

```json
{
  "command": "node",
  "args": ["C:/Users/Louis/Downloads/BRUT-V/web-static/mcp/brut-v/server.mjs"]
}
```

Use the same server from a Telegram-connected Hermes agent. The bot should call
the same MCP tools as the local Hermes agent rather than reimplementing BRUT-V
logic.

For a remote Hermes agent, expose this server only through an explicit bridge or
deployment configuration. Do not grant unrestricted filesystem access to the
BRUT-V workspace.

## Current Tool Boundary

Allowed today:

- list/read/search BRUT-V agent documentation;
- list/read source and embedded sketches;
- validate arbitrary sketch source with the browser assembler;
- validate existing sketches;
- render a provided or existing sketch to PNG with bounded frames and steps;
- read macro reference material;
- provide prompts for creative, debug, porting, atelier, and professor workflows.

Not exposed yet:

- file writes;
- generated file regeneration;
- test execution;
- publishing.

## Security Rules

- Future write tools must be scoped to explicit sketch or draft directories.
- Future runtime tools must be bounded by frame count, instruction count,
  timeout, and output size.
- Future regeneration/test tools must be explicit and auditable.
- Never hand-edit `core-fs.js` or `sketches-fs.js`; regenerate them from source.
- Telegram and voice commands should map to the same constrained MCP tools.

## Notes

The server is non-writing. It does not regenerate `core-fs.js` or
`sketches-fs.js`, and it does not edit files.
