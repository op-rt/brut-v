#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";

import { assemble } from "../../assembler.js";
import { renderSketchSource } from "../../agent-runtime.js";
import { SKETCH_FILES, SKETCH_NAMES } from "../../sketches-fs.js";
import { encodePngRgba } from "./png.mjs";

const serverFile = fileURLToPath(import.meta.url);
const serverDir = path.dirname(serverFile);
const webStaticRoot = path.resolve(serverDir, "../..");
const workspaceRoot = path.resolve(webStaticRoot, "..");
const sketchesRoot = path.join(workspaceRoot, "sketches");

const DOC_RESOURCES = [
    {
        key: "brut-v-hermes",
        uri: "brut-v://docs/HERMES.md",
        title: "BRUT-V Agent Context",
        description: "Top-level orientation file for agents working with BRUT-V.",
        relativePath: "HERMES.md",
    },
    {
        key: "brut-v-agent-architecture",
        uri: "brut-v://docs/agent/architecture",
        title: "BRUT-V Architecture",
        description: "Project boundaries, generated-file rules, runtime model, and test workflow.",
        relativePath: "docs/agent/brutv-architecture.md",
    },
    {
        key: "brut-v-agent-sketch-authoring",
        uri: "brut-v://docs/agent/sketch-authoring",
        title: "BRUT-V Sketch Authoring",
        description: "How to write valid BRUT-V sketches for the web editor.",
        relativePath: "docs/agent/brutv-sketch-authoring.md",
    },
    {
        key: "brut-v-agent-macros",
        uri: "brut-v://docs/agent/macros",
        title: "BRUT-V Macro Guide",
        description: "Compact map of the public BRUT-V macro API.",
        relativePath: "docs/agent/brutv-macros.md",
    },
    {
        key: "brut-v-agent-web-runtime",
        uri: "brut-v://docs/agent/web-runtime",
        title: "BRUT-V Web Runtime",
        description: "Browser runtime, assembler, VM, canvas, console, and agent integration notes.",
        relativePath: "docs/agent/brutv-web-runtime.md",
    },
    {
        key: "brut-v-agent-examples",
        uri: "brut-v://docs/agent/examples",
        title: "BRUT-V Agent Examples",
        description: "Canonical sketch patterns to adapt.",
        relativePath: "docs/agent/brutv-examples.md",
    },
    {
        key: "brut-v-hermes-integration",
        uri: "brut-v://docs/agent/hermes-integration",
        title: "BRUT-V Hermes Integration",
        description: "Hermes integration surface, security model, atelier, Telegram, memory, and professor-mode direction.",
        relativePath: "docs/agent/hermes-integration.md",
    },
    {
        key: "brut-v-hermes-skill",
        uri: "brut-v://hermes/skill",
        title: "BRUT-V Hermes Skill",
        description: "Installable Hermes skill entry point for BRUT-V.",
        relativePath: "hermes-skills/brut-v/SKILL.md",
    },
    {
        key: "brut-v-hermes-skill-sketch-authoring",
        uri: "brut-v://hermes/skill/references/sketch-authoring",
        title: "BRUT-V Hermes Skill Sketch Authoring Reference",
        description: "Hermes skill reference for writing BRUT-V sketches.",
        relativePath: "hermes-skills/brut-v/references/sketch-authoring.md",
    },
    {
        key: "brut-v-hermes-skill-macro-api",
        uri: "brut-v://hermes/skill/references/macro-api",
        title: "BRUT-V Hermes Skill Macro API Reference",
        description: "Hermes skill reference for BRUT-V macro usage.",
        relativePath: "hermes-skills/brut-v/references/macro-api.md",
    },
    {
        key: "brut-v-hermes-skill-examples",
        uri: "brut-v://hermes/skill/references/examples",
        title: "BRUT-V Hermes Skill Examples",
        description: "Copyable BRUT-V sketch examples for Hermes.",
        relativePath: "hermes-skills/brut-v/references/examples.md",
    },
    {
        key: "brut-v-hermes-skill-integration",
        uri: "brut-v://hermes/skill/references/hermes-integration",
        title: "BRUT-V Hermes Skill Integration Reference",
        description: "Portable skill reference for atelier, Telegram, memory, MCP, and professor-mode workflows.",
        relativePath: "hermes-skills/brut-v/references/hermes-integration.md",
    },
];

const server = new McpServer({
    name: "brut-v",
    version: "0.1.0",
});

function resolveInside(base, relativePath) {
    const resolved = path.resolve(base, relativePath);
    const rel = path.relative(base, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel))
        throw new Error(`Path escapes base directory: ${relativePath}`);
    return resolved;
}

async function readWebStatic(relativePath) {
    return fs.readFile(resolveInside(webStaticRoot, relativePath), "utf8");
}

function textResult(text) {
    return { content: [{ type: "text", text }] };
}

function jsonResult(value) {
    return {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
        structuredContent: value,
    };
}

function renderResult(value, pngBase64, includePngBase64 = false) {
    const summary = includePngBase64 ? { ...value, pngBase64 } : value;
    return {
        content: [
            { type: "text", text: JSON.stringify(summary, null, 2) },
            { type: "image", data: pngBase64, mimeType: "image/png" },
        ],
        structuredContent: summary,
        isError: !value.ok,
    };
}

function errorResult(message, extra = {}) {
    const output = { ok: false, error: message, ...extra };
    return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
        isError: true,
    };
}

function resourceDescription(resource) {
    return {
        uri: resource.uri,
        name: resource.key,
        title: resource.title,
        description: resource.description,
        mimeType: "text/markdown",
    };
}

function normalizeSketchName(input) {
    const raw = String(input ?? "").trim().replaceAll("\\", "/");
    const base = path.posix.basename(raw);
    if (!base || base === "." || base === "..")
        return null;

    const candidates = base.endsWith(".asm") || base.endsWith(".s")
        ? [base]
        : [base, `${base}.asm`, `${base}.s`];

    for (const candidate of candidates)
        if (SKETCH_NAMES.includes(candidate))
            return candidate;

    return candidates[0];
}

async function listDiskSketchNames() {
    try {
        const entries = await fs.readdir(sketchesRoot, { withFileTypes: true });
        return entries
            .filter(entry => entry.isFile() && /\.(asm|s)$/i.test(entry.name))
            .map(entry => entry.name)
            .sort((a, b) => a.localeCompare(b));
    } catch {
        return [];
    }
}

async function readDiskSketch(name) {
    const normalized = normalizeSketchName(name);
    if (!normalized)
        throw new Error(`Invalid sketch name: ${name}`);
    const sketchPath = resolveInside(sketchesRoot, normalized);
    return fs.readFile(sketchPath, "utf8");
}

async function readSketch(name, source = "auto") {
    const normalized = normalizeSketchName(name);
    if (!normalized)
        throw new Error(`Invalid sketch name: ${name}`);

    if (source === "embedded") {
        if (!(normalized in SKETCH_FILES))
            throw new Error(`Sketch is not embedded in web-static: ${normalized}`);
        return { name: normalized, source: "embedded", text: SKETCH_FILES[normalized] };
    }

    if (source === "disk") {
        return { name: normalized, source: "disk", text: await readDiskSketch(normalized) };
    }

    try {
        return { name: normalized, source: "disk", text: await readDiskSketch(normalized) };
    } catch {
        if (normalized in SKETCH_FILES)
            return { name: normalized, source: "embedded", text: SKETCH_FILES[normalized] };
        throw new Error(`Sketch not found: ${normalized}`);
    }
}

function validateSource(source, mainName = "sketch.asm", autoIncludeCore = true) {
    const result = assemble(source, { mainName, autoIncludeCore });
    return {
        ok: result.errors.length === 0,
        errors: result.errors,
        warnings: result.warnings ?? [],
        textBytes: result.text?.length ?? 0,
        dataBytes: result.data?.length ?? 0,
        dataBase: result.dataBase,
        textBase: result.textBase,
        expandedLineCount: result.lines?.length ?? 0,
        symbols: result.symbols ? Object.fromEntries([...result.symbols.entries()].slice(0, 200)) : {},
    };
}

function searchText(text, query, maxMatches = 20) {
    const q = query.toLowerCase();
    const lines = text.split(/\r?\n/);
    const matches = [];

    for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
        if (!lines[i].toLowerCase().includes(q))
            continue;
        matches.push({
            line: i + 1,
            text: lines[i],
        });
    }

    return matches;
}

for (const doc of DOC_RESOURCES) {
    server.registerResource(
        doc.key,
        doc.uri,
        {
            title: doc.title,
            description: doc.description,
            mimeType: "text/markdown",
        },
        async uri => ({
            contents: [{
                uri: uri.href,
                mimeType: "text/markdown",
                text: await readWebStatic(doc.relativePath),
            }],
        }),
    );
}

server.registerResource(
    "brut-v-sketch",
    new ResourceTemplate("brut-v://sketches/{name}", {
        list: async () => ({
            resources: SKETCH_NAMES.map(name => ({
                uri: `brut-v://sketches/${encodeURIComponent(name)}`,
                name,
                title: name,
                description: "Embedded BRUT-V sketch source.",
                mimeType: "text/x-riscv-asm",
            })),
        }),
    }),
    {
        title: "BRUT-V Sketch",
        description: "Embedded BRUT-V sketch source by file name.",
        mimeType: "text/x-riscv-asm",
    },
    async (uri, { name }) => {
        const sketch = await readSketch(decodeURIComponent(String(name)), "embedded");
        return {
            contents: [{
                uri: uri.href,
                mimeType: "text/x-riscv-asm",
                text: sketch.text,
            }],
        };
    },
);

server.registerTool(
    "list_docs",
    {
        title: "List BRUT-V Docs",
        description: "List MCP documentation resources exposed by the BRUT-V server.",
        outputSchema: {
            resources: z.array(z.object({
                uri: z.string(),
                name: z.string(),
                title: z.string(),
                description: z.string(),
                mimeType: z.string(),
            })),
        },
    },
    async () => jsonResult({ resources: DOC_RESOURCES.map(resourceDescription) }),
);

server.registerTool(
    "read_doc",
    {
        title: "Read BRUT-V Doc",
        description: "Read a BRUT-V documentation resource by key or URI.",
        inputSchema: {
            nameOrUri: z.string().describe("Resource key, URI, or title fragment."),
        },
    },
    async ({ nameOrUri }) => {
        const needle = nameOrUri.trim().toLowerCase();
        const doc = DOC_RESOURCES.find(item =>
            item.key.toLowerCase() === needle ||
            item.uri.toLowerCase() === needle ||
            item.title.toLowerCase().includes(needle));

        if (!doc)
            return errorResult(`Unknown BRUT-V doc resource: ${nameOrUri}`);

        return textResult(await readWebStatic(doc.relativePath));
    },
);

server.registerTool(
    "search_docs",
    {
        title: "Search BRUT-V Docs",
        description: "Search exposed BRUT-V documentation resources for a literal query.",
        inputSchema: {
            query: z.string().min(1),
            maxMatches: z.number().int().min(1).max(100).optional(),
        },
    },
    async ({ query, maxMatches = 30 }) => {
        const results = [];

        for (const doc of DOC_RESOURCES) {
            const text = await readWebStatic(doc.relativePath);
            const matches = searchText(text, query, maxMatches);
            if (matches.length)
                results.push({ resource: resourceDescription(doc), matches });
        }

        return jsonResult({ query, results });
    },
);

server.registerTool(
    "list_sketches",
    {
        title: "List BRUT-V Sketches",
        description: "List embedded web sketches and source sketches available on disk.",
        outputSchema: {
            embedded: z.array(z.string()),
            disk: z.array(z.string()),
        },
    },
    async () => jsonResult({
        embedded: [...SKETCH_NAMES].sort((a, b) => a.localeCompare(b)),
        disk: await listDiskSketchNames(),
    }),
);

server.registerTool(
    "get_sketch",
    {
        title: "Get BRUT-V Sketch",
        description: "Read a BRUT-V sketch from source disk files or embedded web-static sketches.",
        inputSchema: {
            name: z.string(),
            source: z.enum(["auto", "disk", "embedded"]).optional(),
        },
    },
    async ({ name, source = "auto" }) => {
        try {
            const sketch = await readSketch(name, source);
            return jsonResult(sketch);
        } catch (error) {
            return errorResult(error.message);
        }
    },
);

server.registerTool(
    "validate_sketch",
    {
        title: "Validate BRUT-V Sketch",
        description: "Assemble a sketch with the browser assembler and return diagnostics.",
        inputSchema: {
            source: z.string().describe("BRUT-V assembly source."),
            mainName: z.string().optional().describe("Virtual file name used in diagnostics."),
            autoIncludeCore: z.boolean().optional().describe("Whether to auto-import core.s. Defaults to true."),
        },
    },
    async ({ source, mainName = "sketch.asm", autoIncludeCore = true }) =>
        jsonResult(validateSource(source, mainName, autoIncludeCore)),
);

server.registerTool(
    "validate_existing_sketch",
    {
        title: "Validate Existing BRUT-V Sketch",
        description: "Read an existing sketch and assemble it with the browser assembler.",
        inputSchema: {
            name: z.string(),
            source: z.enum(["auto", "disk", "embedded"]).optional(),
        },
    },
    async ({ name, source = "auto" }) => {
        try {
            const sketch = await readSketch(name, source);
            return jsonResult({
                name: sketch.name,
                source: sketch.source,
                validation: validateSource(sketch.text, sketch.name, true),
            });
        } catch (error) {
            return errorResult(error.message);
        }
    },
);

server.registerTool(
    "get_macro_reference",
    {
        title: "Get BRUT-V Macro Reference",
        description: "Return the BRUT-V macro reference, optionally filtered by a literal query.",
        inputSchema: {
            query: z.string().optional(),
        },
    },
    async ({ query }) => {
        const text = await readWebStatic("docs/agent/brutv-macros.md");
        if (!query)
            return textResult(text);

        return jsonResult({
            query,
            matches: searchText(text, query, 50),
        });
    },
);

server.registerTool(
    "render_sketch",
    {
        title: "Render BRUT-V Sketch",
        description: "Assemble and execute a BRUT-V sketch in the headless runtime, then return a PNG capture.",
        inputSchema: {
            source: z.string().optional().describe("BRUT-V assembly source. If omitted, provide name."),
            name: z.string().optional().describe("Existing sketch name or virtual filename for diagnostics."),
            sourceMode: z.enum(["auto", "disk", "embedded"]).optional().describe("Where to read name from when source is omitted."),
            frames: z.number().int().min(1).max(240).optional().describe("Animated frame count to run before capture. Defaults to 1."),
            maxSteps: z.number().int().min(1).max(200_000_000).optional().describe("Maximum instruction count before aborting."),
            autoIncludeCore: z.boolean().optional().describe("Whether to auto-import core.s. Defaults to true."),
            includePngBase64: z.boolean().optional().describe("Also include PNG base64 in structuredContent. The image content is always returned."),
        },
    },
    async ({
        source,
        name,
        sourceMode = "auto",
        frames = 1,
        maxSteps,
        autoIncludeCore = true,
        includePngBase64 = false,
    }) => {
        try {
            let sketchSource = source;
            let mainName = name ?? "sketch.asm";
            let sketchSourceKind = "provided";

            if (sketchSource == null) {
                if (!name)
                    return errorResult("render_sketch requires either source or name.");
                const sketch = await readSketch(name, sourceMode);
                sketchSource = sketch.text;
                mainName = sketch.name;
                sketchSourceKind = sketch.source;
            }

            const result = renderSketchSource(sketchSource, {
                mainName,
                frames,
                maxSteps,
                autoIncludeCore,
            });

            if (!result.rgba) {
                const failure = {
                    ok: false,
                    name: mainName,
                    source: sketchSourceKind,
                    stage: result.stage,
                    validation: result.validation,
                    runtime: result.runtime,
                    console: result.console,
                    image: result.image,
                };
                return {
                    content: [{ type: "text", text: JSON.stringify(failure, null, 2) }],
                    structuredContent: failure,
                    isError: true,
                };
            }

            const png = encodePngRgba(result.rgba, result.image.width, result.image.height);
            const pngBase64 = png.toString("base64");
            const { rgba, ...summary } = result;
            return renderResult({
                ...summary,
                name: mainName,
                source: sketchSourceKind,
                image: {
                    ...result.image,
                    mimeType: "image/png",
                    byteLength: png.length,
                },
            }, pngBase64, includePngBase64);
        } catch (error) {
            return errorResult(error.message);
        }
    },
);

server.registerPrompt(
    "create-brutv-sketch",
    {
        title: "Create BRUT-V Sketch",
        description: "Generate a complete BRUT-V sketch from a natural-language request.",
        argsSchema: {
            request: z.string(),
        },
    },
    ({ request }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: [
                    "Create a complete BRUT-V web sketch for this request:",
                    request,
                    "",
                    "Use the brut-v skill or MCP resources if available.",
                    "Do not include `.include \"../core/core.s\"`.",
                    "Prefer immediate macros for static literal values.",
                    "End every setup/draw procedure with ret.",
                    "Return only the sketch source unless explanation is requested.",
                ].join("\n"),
            },
        }],
    }),
);

server.registerPrompt(
    "debug-brutv-sketch",
    {
        title: "Debug BRUT-V Sketch",
        description: "Debug a BRUT-V sketch using assembler diagnostics and framework conventions.",
        argsSchema: {
            sketch: z.string(),
            problem: z.string().optional(),
        },
    },
    ({ sketch, problem = "The sketch does not behave as expected." }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: [
                    "Debug this BRUT-V sketch.",
                    `Problem: ${problem}`,
                    "",
                    "Check for missing ret, invalid li/label usage, clobbered registers, stale include lines, and immediate/register macro misuse.",
                    "",
                    "Sketch:",
                    "```asm",
                    sketch,
                    "```",
                ].join("\n"),
            },
        }],
    }),
);

server.registerPrompt(
    "explain-brutv-macro",
    {
        title: "Explain BRUT-V Macro",
        description: "Explain how a BRUT-V macro should be used.",
        argsSchema: {
            macro: z.string(),
        },
    },
    ({ macro }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: [
                    `Explain the BRUT-V macro ${macro}.`,
                    "Include register/immediate variants, expected argument types, clobbering risks if known, and a minimal example.",
                ].join("\n"),
            },
        }],
    }),
);

server.registerPrompt(
    "port-processing-to-brutv",
    {
        title: "Port Processing Sketch To BRUT-V",
        description: "Translate a simple Processing-style sketch idea or code fragment to BRUT-V.",
        argsSchema: {
            processing: z.string(),
        },
    },
    ({ processing }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: [
                    "Port this Processing-style sketch or idea to BRUT-V.",
                    "Preserve the visual intent, but use BRUT-V idioms and simple RISC-V assembly.",
                    "",
                    "Processing source or description:",
                    "```",
                    processing,
                    "```",
                ].join("\n"),
            },
        }],
    }),
);

server.registerPrompt(
    "start-brutv-atelier-session",
    {
        title: "Start BRUT-V Atelier Session",
        description: "Structure a Hermes creative iteration session for BRUT-V.",
        argsSchema: {
            request: z.string(),
            styleMemory: z.string().optional(),
        },
    },
    ({ request, styleMemory = "No explicit style memory was provided." }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: [
                    "Start a BRUT-V living atelier session.",
                    "",
                    "Creative request:",
                    request,
                    "",
                    "Available style memory:",
                    styleMemory,
                    "",
                    "Workflow:",
                    "1. Generate one complete BRUT-V sketch.",
                    "2. Validate it with BRUT-V MCP tools if available.",
                    "3. If render/capture tools are available, run it and inspect the image.",
                    "4. Critique the result against the style memory.",
                    "5. Propose the next concrete iteration.",
                    "",
                    "Do not include `.include \"../core/core.s\"` for web sketches.",
                    "End every setup/draw procedure with ret.",
                ].join("\n"),
            },
        }],
    }),
);

server.registerPrompt(
    "teach-brutv-sketch",
    {
        title: "Teach BRUT-V Sketch",
        description: "Structure a professor-mode explanation of a BRUT-V sketch.",
        argsSchema: {
            sketch: z.string(),
            focus: z.string().optional(),
        },
    },
    ({ sketch, focus = "Explain the sketch line by line and trace important register usage." }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: [
                    "Act as a BRUT-V and RISC-V professor.",
                    `Teaching focus: ${focus}`,
                    "",
                    "Explain labels, procedures, macro usage, register lifetime, memory access, control flow, likely mistakes, and how the code creates the visual result.",
                    "Prefer concrete reasoning over generic assembly advice.",
                    "",
                    "Sketch:",
                    "```asm",
                    sketch,
                    "```",
                ].join("\n"),
            },
        }],
    }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
