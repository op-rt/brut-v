#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
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
const atelierRoot = path.join(serverDir, "atelier-runs");
const ATELIER_METADATA_VERSION = 1;

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

function fileResult(value, imageBase64 = null, includeImageContent = false) {
    const content = [{ type: "text", text: JSON.stringify(value, null, 2) }];
    if (includeImageContent && imageBase64)
        content.push({ type: "image", data: imageBase64, mimeType: "image/png" });
    return {
        content,
        structuredContent: value,
        isError: !value.ok,
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

function sanitizeSegment(input, fallback) {
    const raw = String(input ?? "").trim();
    const normalized = raw
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return normalized || fallback;
}

function newRunId(prefix = "run") {
    const stamp = new Date().toISOString()
        .replaceAll(":", "")
        .replaceAll(".", "")
        .replace("T", "-")
        .replace("Z", "");
    return `${sanitizeSegment(prefix, "run")}-${stamp}-${randomUUID().slice(0, 8)}`;
}

function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags
        .map(tag => String(tag).trim())
        .filter(Boolean)
        .slice(0, 32);
}

function relativeWebPath(absolutePath) {
    return path.relative(webStaticRoot, absolutePath).replaceAll(path.sep, "/");
}

function atelierRunPaths(sessionIdInput, runIdInput) {
    const sessionId = sanitizeSegment(sessionIdInput, "default");
    const runId = sanitizeSegment(runIdInput, newRunId());
    const runDir = resolveInside(atelierRoot, `${sessionId}/${runId}`);
    return {
        sessionId,
        runId,
        runDir,
        sourcePath: path.join(runDir, "sketch.asm"),
        renderPath: path.join(runDir, "render.png"),
        metadataPath: path.join(runDir, "metadata.json"),
    };
}

async function writeJson(filePath, value) {
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function sketchMetadata({
    sessionId,
    runId,
    parentRunId,
    name,
    sourceOrigin,
    prompt,
    styleMemory,
    notes,
    tags,
    files,
    validation,
    render,
}) {
    const now = new Date().toISOString();
    return {
        version: ATELIER_METADATA_VERSION,
        createdAt: now,
        updatedAt: now,
        sessionId,
        runId,
        parentRunId: parentRunId ? sanitizeSegment(parentRunId, "") : null,
        name,
        sourceOrigin,
        prompt: prompt ?? null,
        styleMemory: styleMemory ?? null,
        notes: notes ?? null,
        tags: normalizeTags(tags),
        files,
        validation,
        render,
    };
}

async function saveAtelierRun({
    source,
    name,
    sourceOrigin,
    sessionId,
    runId,
    parentRunId,
    prompt,
    styleMemory,
    notes,
    tags,
    validation,
    render,
    png,
    overwrite = false,
}) {
    const paths = atelierRunPaths(sessionId, runId ?? newRunId(render ? "render" : "sketch"));
    if (!overwrite) {
        try {
            await fs.stat(paths.metadataPath);
            throw new Error(`Atelier run already exists: ${paths.sessionId}/${paths.runId}`);
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
    }
    await fs.mkdir(paths.runDir, { recursive: true });
    await fs.writeFile(paths.sourcePath, source, "utf8");
    if (png) await fs.writeFile(paths.renderPath, png);

    const files = {
        directory: relativeWebPath(paths.runDir),
        source: relativeWebPath(paths.sourcePath),
        metadata: relativeWebPath(paths.metadataPath),
        render: png ? relativeWebPath(paths.renderPath) : null,
    };
    const metadata = sketchMetadata({
        sessionId: paths.sessionId,
        runId: paths.runId,
        parentRunId,
        name,
        sourceOrigin,
        prompt,
        styleMemory,
        notes,
        tags,
        files,
        validation,
        render,
    });
    await writeJson(paths.metadataPath, metadata);
    return metadata;
}

async function listAtelierRunMetadata(sessionIdInput = null, limit = 50) {
    const sessions = [];

    try {
        if (sessionIdInput) {
            const sessionId = sanitizeSegment(sessionIdInput, "default");
            sessions.push({ name: sessionId, path: resolveInside(atelierRoot, sessionId) });
        } else {
            const entries = await fs.readdir(atelierRoot, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory())
                    sessions.push({ name: entry.name, path: resolveInside(atelierRoot, entry.name) });
            }
        }
    } catch {
        return [];
    }

    const runs = [];
    for (const session of sessions) {
        let entries = [];
        try {
            entries = await fs.readdir(session.path, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const metadataPath = resolveInside(atelierRoot, `${session.name}/${entry.name}/metadata.json`);
            try {
                const metadata = await readJson(metadataPath);
                runs.push(summarizeRun(metadata));
            } catch {
                continue;
            }
        }
    }

    return runs
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit);
}

function summarizeRun(metadata) {
    return {
        sessionId: metadata.sessionId,
        runId: metadata.runId,
        parentRunId: metadata.parentRunId,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        name: metadata.name,
        sourceOrigin: metadata.sourceOrigin,
        tags: metadata.tags ?? [],
        prompt: metadata.prompt,
        notes: metadata.notes,
        ok: metadata.render?.ok ?? metadata.validation?.ok ?? false,
        validationOk: metadata.validation?.ok ?? false,
        renderOk: metadata.render?.ok ?? null,
        image: metadata.render?.image ?? null,
        files: metadata.files,
    };
}

async function findAtelierRun(sessionIdInput, runIdInput) {
    const runId = sanitizeSegment(runIdInput, "");
    if (!runId)
        throw new Error("runId is required.");

    if (sessionIdInput) {
        const sessionId = sanitizeSegment(sessionIdInput, "default");
        const runDir = resolveInside(atelierRoot, `${sessionId}/${runId}`);
        return {
            sessionId,
            runId,
            runDir,
            sourcePath: path.join(runDir, "sketch.asm"),
            renderPath: path.join(runDir, "render.png"),
            metadataPath: path.join(runDir, "metadata.json"),
        };
    }

    const matches = [];
    try {
        const sessions = await fs.readdir(atelierRoot, { withFileTypes: true });
        for (const session of sessions) {
            if (!session.isDirectory()) continue;
            const runDir = resolveInside(atelierRoot, `${session.name}/${runId}`);
            try {
                await fs.stat(path.join(runDir, "metadata.json"));
                matches.push({
                    sessionId: session.name,
                    runId,
                    runDir,
                    sourcePath: path.join(runDir, "sketch.asm"),
                    renderPath: path.join(runDir, "render.png"),
                    metadataPath: path.join(runDir, "metadata.json"),
                });
            } catch {
                continue;
            }
        }
    } catch {
        // handled below
    }

    if (matches.length === 0)
        throw new Error(`Unknown atelier run: ${runId}`);
    if (matches.length > 1)
        throw new Error(`Run id is ambiguous; provide sessionId for ${runId}.`);
    return matches[0];
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

server.registerTool(
    "save_agent_sketch",
    {
        title: "Save BRUT-V Atelier Sketch",
        description: "Save a generated BRUT-V sketch into the controlled atelier-runs directory with metadata.",
        inputSchema: {
            source: z.string().describe("BRUT-V assembly source to save."),
            name: z.string().optional().describe("Virtual filename for diagnostics and metadata."),
            sessionId: z.string().optional().describe("Atelier session id. Defaults to default."),
            runId: z.string().optional().describe("Optional run id. If omitted, one is generated."),
            parentRunId: z.string().optional().describe("Optional parent run id for iterations."),
            prompt: z.string().optional().describe("Original creative request or instruction."),
            styleMemory: z.string().optional().describe("Style memory excerpt used for this run."),
            notes: z.string().optional().describe("Agent or user notes."),
            tags: z.array(z.string()).optional().describe("Short tags for later filtering."),
            validate: z.boolean().optional().describe("Validate before saving. Defaults to true."),
            autoIncludeCore: z.boolean().optional().describe("Whether to auto-import core.s during validation. Defaults to true."),
            overwrite: z.boolean().optional().describe("Allow replacing an existing runId. Defaults to false."),
        },
    },
    async ({
        source,
        name = "agent-sketch.asm",
        sessionId = "default",
        runId,
        parentRunId,
        prompt,
        styleMemory,
        notes,
        tags = [],
        validate = true,
        autoIncludeCore = true,
        overwrite = false,
    }) => {
        try {
            const mainName = path.posix.basename(String(name || "agent-sketch.asm"));
            const validation = validate
                ? validateSource(source, mainName, autoIncludeCore)
                : null;
            const metadata = await saveAtelierRun({
                source,
                name: mainName,
                sourceOrigin: "provided",
                sessionId,
                runId,
                parentRunId,
                prompt,
                styleMemory,
                notes,
                tags,
                validation,
                render: null,
                png: null,
                overwrite,
            });

            return jsonResult({
                ok: validation ? validation.ok : true,
                run: summarizeRun(metadata),
                validation,
            });
        } catch (error) {
            return errorResult(error.message);
        }
    },
);

server.registerTool(
    "render_and_save_sketch",
    {
        title: "Render And Save BRUT-V Atelier Sketch",
        description: "Render a BRUT-V sketch, save source/PNG/metadata in atelier-runs, and return the capture.",
        inputSchema: {
            source: z.string().optional().describe("BRUT-V assembly source. If omitted, provide name."),
            name: z.string().optional().describe("Existing sketch name or virtual filename for diagnostics."),
            sourceMode: z.enum(["auto", "disk", "embedded"]).optional().describe("Where to read name from when source is omitted."),
            sessionId: z.string().optional().describe("Atelier session id. Defaults to default."),
            runId: z.string().optional().describe("Optional run id. If omitted, one is generated."),
            parentRunId: z.string().optional().describe("Optional parent run id for iterations."),
            prompt: z.string().optional().describe("Original creative request or instruction."),
            styleMemory: z.string().optional().describe("Style memory excerpt used for this run."),
            notes: z.string().optional().describe("Agent or user notes."),
            tags: z.array(z.string()).optional().describe("Short tags for later filtering."),
            frames: z.number().int().min(1).max(240).optional().describe("Animated frame count to run before capture. Defaults to 1."),
            maxSteps: z.number().int().min(1).max(200_000_000).optional().describe("Maximum instruction count before aborting."),
            autoIncludeCore: z.boolean().optional().describe("Whether to auto-import core.s. Defaults to true."),
            includeImageContent: z.boolean().optional().describe("Return image content in the MCP response. Defaults to true."),
            includePngBase64: z.boolean().optional().describe("Also include PNG base64 in structuredContent. Defaults to false."),
            overwrite: z.boolean().optional().describe("Allow replacing an existing runId. Defaults to false."),
        },
    },
    async ({
        source,
        name,
        sourceMode = "auto",
        sessionId = "default",
        runId,
        parentRunId,
        prompt,
        styleMemory,
        notes,
        tags = [],
        frames = 1,
        maxSteps,
        autoIncludeCore = true,
        includeImageContent = true,
        includePngBase64 = false,
        overwrite = false,
    }) => {
        try {
            let sketchSource = source;
            let mainName = name ?? "agent-sketch.asm";
            let sourceOrigin = "provided";

            if (sketchSource == null) {
                if (!name)
                    return errorResult("render_and_save_sketch requires either source or name.");
                const sketch = await readSketch(name, sourceMode);
                sketchSource = sketch.text;
                mainName = sketch.name;
                sourceOrigin = sketch.source;
            } else {
                mainName = path.posix.basename(String(mainName || "agent-sketch.asm"));
            }

            const result = renderSketchSource(sketchSource, {
                mainName,
                frames,
                maxSteps,
                autoIncludeCore,
            });
            const png = result.rgba
                ? encodePngRgba(result.rgba, result.image.width, result.image.height)
                : null;
            const render = result.rgba
                ? {
                    ok: result.ok,
                    stage: result.stage,
                    runtime: result.runtime,
                    console: result.console,
                    image: {
                        ...result.image,
                        mimeType: "image/png",
                        byteLength: png.length,
                    },
                }
                : {
                    ok: false,
                    stage: result.stage,
                    runtime: result.runtime,
                    console: result.console,
                    image: null,
                };

            const metadata = await saveAtelierRun({
                source: sketchSource,
                name: mainName,
                sourceOrigin,
                sessionId,
                runId,
                parentRunId,
                prompt,
                styleMemory,
                notes,
                tags,
                validation: result.validation,
                render,
                png,
                overwrite,
            });
            const pngBase64 = png ? png.toString("base64") : null;
            const output = {
                ok: result.ok,
                run: summarizeRun(metadata),
                validation: result.validation,
                render,
                ...(includePngBase64 && pngBase64 ? { pngBase64 } : {}),
            };

            return fileResult(output, pngBase64, includeImageContent);
        } catch (error) {
            return errorResult(error.message);
        }
    },
);

server.registerTool(
    "list_agent_runs",
    {
        title: "List BRUT-V Atelier Runs",
        description: "List saved BRUT-V atelier runs from the controlled atelier-runs directory.",
        inputSchema: {
            sessionId: z.string().optional().describe("Optional session id filter."),
            limit: z.number().int().min(1).max(200).optional().describe("Maximum runs to return. Defaults to 50."),
        },
    },
    async ({ sessionId, limit = 50 }) => {
        try {
            return jsonResult({
                ok: true,
                root: relativeWebPath(atelierRoot),
                sessionId: sessionId ? sanitizeSegment(sessionId, "default") : null,
                runs: await listAtelierRunMetadata(sessionId, limit),
            });
        } catch (error) {
            return errorResult(error.message);
        }
    },
);

server.registerTool(
    "get_agent_run",
    {
        title: "Get BRUT-V Atelier Run",
        description: "Read a saved BRUT-V atelier run, with optional sketch source and PNG image content.",
        inputSchema: {
            runId: z.string().describe("Run id to retrieve."),
            sessionId: z.string().optional().describe("Session id. Optional if runId is unique."),
            includeSource: z.boolean().optional().describe("Include saved sketch source. Defaults to true."),
            includeImageContent: z.boolean().optional().describe("Return image content in the MCP response. Defaults to false."),
            includePngBase64: z.boolean().optional().describe("Include PNG base64 in structuredContent. Defaults to false."),
        },
    },
    async ({
        runId,
        sessionId,
        includeSource = true,
        includeImageContent = false,
        includePngBase64 = false,
    }) => {
        try {
            const paths = await findAtelierRun(sessionId, runId);
            const metadata = await readJson(paths.metadataPath);
            const source = includeSource ? await fs.readFile(paths.sourcePath, "utf8") : undefined;
            let pngBase64 = null;
            try {
                pngBase64 = (await fs.readFile(paths.renderPath)).toString("base64");
            } catch {
                pngBase64 = null;
            }

            const output = {
                ok: true,
                run: metadata,
                ...(includeSource ? { source } : {}),
                ...(includePngBase64 && pngBase64 ? { pngBase64 } : {}),
            };
            return fileResult(output, pngBase64, includeImageContent);
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
                    "3. Render it with render_sketch or render_and_save_sketch.",
                    "4. Save promising attempts with sessionId, parentRunId, prompt, notes, and tags.",
                    "5. Critique the result against the style memory.",
                    "6. Propose the next concrete iteration.",
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
