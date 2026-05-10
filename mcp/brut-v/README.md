# BRUT-V MCP Server

Local stdio MCP server for BRUT-V. It is the stable entry point for Hermes
agents that need BRUT-V documentation, sketches, validation, and workflow
prompts.

It exposes:

- BRUT-V agent documentation as MCP resources.
- Bundled sketches as MCP resources.
- Tools to list/read/search docs and sketches.
- Tools to validate sketch source with the browser assembler.
- Prompts for sketch creation, debugging, macro explanation, and Processing-to-BRUT-V translation.
- Prompts for the living atelier and professor-mode workflows.

This first version is intentionally read/validate-only. It does not edit files,
run the browser, capture canvas output, regenerate generated files, or publish
sketches.

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
- read macro reference material;
- provide prompts for creative, debug, porting, atelier, and professor workflows.

Not exposed yet:

- file writes;
- runtime execution;
- browser/canvas capture;
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

The server is read/validate-only in this first version. It does not regenerate `core-fs.js` or `sketches-fs.js`, and it does not edit files.
