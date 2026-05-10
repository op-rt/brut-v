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
        key: "brut-v-agent-tangent-geometry",
        uri: "brut-v://docs/agent/tangent-geometry",
        title: "BRUT-V Tangent Geometry",
        description: "Canonical radius-preserving tangent and arc construction rules for circle-based sketches.",
        relativePath: "docs/agent/brutv-tangent-geometry.md",
    },
    {
        key: "brut-v-hermes-integration",
        uri: "brut-v://docs/agent/hermes-integration",
        title: "BRUT-V Hermes Integration",
        description: "Hermes integration surface, security model, atelier, Telegram, memory, and professor-mode direction.",
        relativePath: "docs/agent/hermes-integration.md",
    },
    {
        key: "brut-v-hermes-creative-loop",
        uri: "brut-v://docs/agent/hermes-creative-loop",
        title: "BRUT-V Hermes Creative Loop",
        description: "Operational loop for Hermes creative iteration, Telegram UX, style memory, and run curation.",
        relativePath: "docs/agent/hermes-creative-loop.md",
    },
    {
        key: "brut-v-hermes-telegram-skills",
        uri: "brut-v://docs/agent/hermes-telegram-skills",
        title: "BRUT-V Hermes Telegram Skills",
        description: "Portable Telegram slash commands for BRUT-V creation, source retrieval, audit, explanation, and professor mode.",
        relativePath: "docs/agent/hermes-telegram-skills.md",
    },
    {
        key: "brut-v-hermes-skill",
        uri: "brut-v://hermes/skill",
        title: "BRUT-V Hermes Skill",
        description: "Installable Hermes skill entry point for BRUT-V.",
        relativePath: "hermes-skills/brut-v/SKILL.md",
    },
    {
        key: "brut-v-hermes-skill-sketch",
        uri: "brut-v://hermes/skill/sketch",
        title: "BRUT-V Sketch Command Skill",
        description: "Short /sketch command for Telegram image-first BRUT-V rendering.",
        relativePath: "hermes-skills/sketch/SKILL.md",
    },
    {
        key: "brut-v-hermes-skill-source",
        uri: "brut-v://hermes/skill/source",
        title: "BRUT-V Source Command Skill",
        description: "Short /source command for retrieving saved BRUT-V atelier sketch source.",
        relativePath: "hermes-skills/source/SKILL.md",
    },
    {
        key: "brut-v-hermes-skill-explain",
        uri: "brut-v://hermes/skill/explain",
        title: "BRUT-V Explain Command Skill",
        description: "Short /explain command for line-by-line BRUT-V professor mode.",
        relativePath: "hermes-skills/explain/SKILL.md",
    },
    {
        key: "brut-v-hermes-skill-audit",
        uri: "brut-v://hermes/skill/audit",
        title: "BRUT-V Audit Command Skill",
        description: "Short /audit command for validation, runtime, RARS, macro, and register review.",
        relativePath: "hermes-skills/audit/SKILL.md",
    },
    {
        key: "brut-v-hermes-skill-professor",
        uri: "brut-v://hermes/skill/professor",
        title: "BRUT-V Professor Command Skill",
        description: "Short /professor command for focused BRUT-V teaching questions.",
        relativePath: "hermes-skills/professor/SKILL.md",
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
        key: "brut-v-hermes-skill-tangent-geometry",
        uri: "brut-v://hermes/skill/references/tangent-geometry",
        title: "BRUT-V Hermes Skill Tangent Geometry",
        description: "Portable tangent-geometry reference for Hermes sketch generation.",
        relativePath: "hermes-skills/brut-v/references/tangent-geometry.md",
    },
    {
        key: "brut-v-hermes-skill-integration",
        uri: "brut-v://hermes/skill/references/hermes-integration",
        title: "BRUT-V Hermes Skill Integration Reference",
        description: "Portable skill reference for atelier, Telegram, memory, MCP, and professor-mode workflows.",
        relativePath: "hermes-skills/brut-v/references/hermes-integration.md",
    },
    {
        key: "brut-v-hermes-skill-creative-loop",
        uri: "brut-v://hermes/skill/references/creative-loop",
        title: "BRUT-V Hermes Skill Creative Loop Reference",
        description: "Portable skill reference for the generate, render, critique, iterate loop.",
        relativePath: "hermes-skills/brut-v/references/creative-loop.md",
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

async function readAtelierRunForContext(paths, includeSource) {
    const metadata = await readJson(paths.metadataPath);
    const source = includeSource ? await fs.readFile(paths.sourcePath, "utf8") : undefined;
    let pngBase64 = null;
    try {
        pngBase64 = (await fs.readFile(paths.renderPath)).toString("base64");
    } catch {
        pngBase64 = null;
    }

    return {
        metadata,
        source,
        pngBase64,
    };
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

function auditSketchConstraints(sourceInput, promptInput = "") {
    const source = String(sourceInput ?? "");
    const prompt = String(promptInput ?? "");
    const lines = source.split(/\r?\n/);
    const promptRadius = extractPromptRadius(prompt);
    const tangentRequested = /\b(tangents?|tangentes?|arcs?|arc)\b/i.test(prompt);
    const sameRadiusRequested = tangentRequested && (
        promptRadius != null ||
        /\b(no\s*shrinking|no\s*shrink|same\s*r|same\s*radius|same\s*rayon|meme\s*rayon|même\s*rayon|drawn\s+circles?|original\s+circles?|cercles?\s+originaux)\b/i.test(prompt)
    );
    const overlayRequested = /\b(on\s+top|above|overlay|dessus|au-dessus|par\s+dessus)\b/i.test(prompt)
        && /\b(fill|filled|polygon|polygone|rempli|remplie|shape|forme)\b/i.test(prompt);
    const findings = [];

    const addFinding = (severity, code, message, evidence = []) => {
        findings.push({ severity, code, message, evidence });
    };

    if (sameRadiusRequested) {
        const radiusText = promptRadius == null ? "the displayed circle radius" : String(promptRadius);
        if (!hasSameRadiusInvariant(source, promptRadius)) {
            addFinding(
                "high",
                "missing-same-radius-invariant",
                `Tangent/arc geometry must prove it uses the same radius as the displayed circles (${radiusText}). Add a single canonical radius and a RADIUS_INVARIANT comment, then use that radius for CIRCLE, tangent points, and arcs.`,
            );
        }
        if (!hasBoundaryInvariant(source)) {
            addFinding(
                "high",
                "missing-tangent-boundary-invariant",
                "Tangent points must be constructed on the displayed circle boundary. Add a clear boundary invariant such as distance squared from center equals R*R, and implement tangent endpoints from that radius instead of an inset helper circle.",
            );
        }

        for (const issue of findShrinkageEvidence(lines, promptRadius)) {
            addFinding(
                "high",
                "tangent-radius-shrunk",
                "Source suggests tangent/arc geometry is using a smaller helper radius even though the prompt requested tangents on the drawn circles.",
                [issue],
            );
        }
        for (const issue of findHardcodedTangentOffsetEvidence(lines, promptRadius)) {
            addFinding(
                "high",
                "hardcoded-inset-tangent-offset",
                "Tangent/arc code uses a hardcoded offset smaller than the requested radius. This contradicts the same-radius invariant even if the comments claim otherwise.",
                [issue],
            );
        }
        for (const issue of findSignOnlyTangentConstructionEvidence(lines)) {
            addFinding(
                "high",
                "sign-only-tangent-construction",
                "Tangent endpoints appear to be built from sign-only offsets instead of a normalized center-to-center perpendicular or equivalent radius-preserving construction.",
                [issue],
            );
        }
    }

    if (overlayRequested) {
        const order = inspectDrawOrder(source);
        if (order.circleLine != null && order.overlayLine != null && order.overlayLine < order.circleLine) {
            addFinding(
                "high",
                "overlay-drawn-before-circles",
                "The final filled overlay appears before the circle pass. In BRUT-V, later drawing appears on top, so draw circles first and the filled polygon/tangent shape last.",
                [
                    { line: order.overlayLine, text: lines[order.overlayLine - 1] ?? "" },
                    { line: order.circleLine, text: lines[order.circleLine - 1] ?? "" },
                ],
            );
        }
        if (order.circleLine == null || order.overlayLine == null) {
            addFinding(
                "medium",
                "draw-order-not-auditable",
                "Could not clearly audit draw order. Use named calls such as call draw_circles followed by call draw_tangent_fill, or draw CIRCLE before the final filled polygon in setup.",
            );
        }
    }

    return {
        ok: !findings.some(finding => finding.severity === "high"),
        promptRadius,
        checks: {
            tangentRequested,
            sameRadiusRequested,
            overlayRequested,
        },
        auditedProcedures: extractTangentProcedureBlocks(lines).map(block => ({
            name: block.name,
            startLine: block.startLine,
            endLine: block.endLine,
        })),
        findings,
    };
}

function extractPromptRadius(prompt) {
    const patterns = [
        /\b(?:r|R)\s*=\s*(\d+)\b/,
        /\bradius\s*(?:=|:)?\s*(\d+)\b/i,
        /\brayon\s*(?:=|:)?\s*(\d+)\b/i,
    ];
    for (const pattern of patterns) {
        const match = prompt.match(pattern);
        if (!match) continue;
        const value = Number.parseInt(match[1], 10);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
}

function hasSameRadiusInvariant(source, radius) {
    const radiusPattern = radius == null ? "\\d+" : String(radius);
    const invariant = new RegExp(`RADIUS_INVARIANT[^\\n]*(?:CIRCLE|DRAWN)[^\\n]*(?:TANGENT|ARC)[^\\n]*${radiusPattern}|RADIUS_INVARIANT[^\\n]*${radiusPattern}[^\\n]*(?:CIRCLE|DRAWN)[^\\n]*(?:TANGENT|ARC)`, "i");
    if (invariant.test(source)) return true;

    if (radius == null) return false;

    const sharedNames = ["R", "RADIUS", "CIRCLE_RADIUS", "DRAWN_RADIUS"];
    for (const name of sharedNames) {
        const eqv = new RegExp(`\\.eqv\\s+${name}\\s+${radius}\\b`, "i");
        const word = new RegExp(`${name}:\\s*\\.word\\s+${radius}\\b`, "i");
        const circleUse = new RegExp(`\\b(?:I?CIRCLE)\\b[^\\n]*\\b${name}\\b`, "i");
        const tangentUse = new RegExp(`\\b(?:tangent|arc|tan|outline)\\b[\\s\\S]*\\b${name}\\b|\\b${name}\\b[\\s\\S]*\\b(?:tangent|arc|tan|outline)\\b`, "i");
        if ((eqv.test(source) || word.test(source)) && circleUse.test(source) && tangentUse.test(source))
            return true;
    }

    return false;
}

function hasBoundaryInvariant(source) {
    return /\b(?:BOUNDARY_INVARIANT|tangent_points?_on_circle_boundary|distance\s+squared\s+from\s+center\s*==\s*R\s*\*\s*R|\(px\s*-\s*cx\)\^2\s*\+\s*\(py\s*-\s*cy\)\^2\s*==\s*R\^2)\b/i.test(source);
}

function findShrinkageEvidence(lines, radius) {
    const issues = [];
    const shrinkPattern = /\b(?:shrink|shrunk|inset|inner\s+radius|helper\s+radius|avoid\s+collision|smaller\s+circle|r\s*-\s*(?:stroke|\d+)|radius\s*-\s*(?:stroke|\d+))\b/i;
    const negativeOffsetPattern = /\baddi\s+\w+\s*,\s*\w+\s*,\s*-\d+\b/i;
    const contextPattern = /\b(?:tangent|tan|arc|outline|radius|helper|inset|shrink)\b/i;

    for (let i = 0; i < lines.length; i++) {
        const text = lines[i];
        const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4)).join("\n");
        if (shrinkPattern.test(text) || (negativeOffsetPattern.test(text) && contextPattern.test(context))) {
            issues.push({ line: i + 1, text });
            continue;
        }

        if (radius != null && contextPattern.test(context)) {
            const numbers = [...text.matchAll(/\b\d+\b/g)].map(match => Number.parseInt(match[0], 10));
            const suspicious = numbers.find(value => value > Math.max(0, radius - 20) && value < radius);
            if (suspicious != null)
                issues.push({ line: i + 1, text });
        }
    }

    return issues.slice(0, 20);
}

function findHardcodedTangentOffsetEvidence(lines, radius) {
    if (radius == null) return [];

    const issues = [];
    const minSuspicious = Math.max(2, Math.floor(radius * 0.5));
    for (const block of extractTangentProcedureBlocks(lines)) {
        for (const entry of block.lines) {
            const li = entry.text.match(/\bli\s+([A-Za-z][\w]*)\s*,\s*(-?\d+)\b/);
            if (li) {
                const value = Math.abs(Number.parseInt(li[2], 10));
                if (value > minSuspicious && value < radius) {
                    issues.push({
                        procedure: block.name,
                        line: entry.line,
                        text: entry.text,
                        radius,
                        literal: value,
                    });
                }
            }

            const addi = entry.text.match(/\baddi\s+([A-Za-z][\w]*)\s*,\s*([A-Za-z][\w]*)\s*,\s*(-?\d+)\b/);
            if (addi) {
                const value = Math.abs(Number.parseInt(addi[3], 10));
                if (value > minSuspicious && value < radius) {
                    issues.push({
                        procedure: block.name,
                        line: entry.line,
                        text: entry.text,
                        radius,
                        literal: value,
                    });
                }
            }
        }
    }

    return issues.slice(0, 20);
}

function findSignOnlyTangentConstructionEvidence(lines) {
    const issues = [];
    for (const block of extractTangentProcedureBlocks(lines)) {
        const text = block.lines.map(entry => entry.text).join("\n");
        if (!/\b(?:bgt|blt|bge|ble)\s+\w+\s*,\s*zero\b/i.test(text))
            continue;
        if (!/\bli\s+\w+\s*,\s*-?\d+\b/i.test(text))
            continue;
        if (hasNormalizationEvidence(text))
            continue;
        issues.push({
            procedure: block.name,
            line: block.startLine,
            text: `${block.name}: sign branches plus literal offsets, with no normalization evidence`,
        });
    }
    return issues;
}

function hasNormalizationEvidence(text) {
    return /\b(?:SQRT|IDIST|DIST|div|divu|fdiv|fsqrt|isqrt|sqrt|normalize|normalise|unit_normal|unit_perp|inv_len|invlen)\b/i.test(text);
}

function extractTangentProcedureBlocks(lines) {
    return extractProcedureBlocks(lines, /(?:tangent|tan|arc|bridge|outline)/i);
}

function extractProcedureBlocks(lines, namePattern) {
    const labels = [];
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^\s*([A-Za-z_][\w]*):\s*(?:#.*)?$/);
        if (!match) continue;
        if (!isTopLevelProcedureLabel(match[1])) continue;
        labels.push({ name: match[1], line: i + 1, index: i });
    }

    const blocks = [];
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        if (!namePattern.test(label.name)) continue;
        const next = labels[i + 1];
        const endIndex = next ? next.index : lines.length;
        blocks.push({
            name: label.name,
            startLine: label.line,
            endLine: endIndex,
            lines: lines.slice(label.index, endIndex).map((text, offset) => ({
                line: label.index + offset + 1,
                text,
            })),
        });
    }
    return blocks;
}

function isTopLevelProcedureLabel(name) {
    return name === "setup" || /^(?:init|clear|choose|select|rank|dist|reverse|two|load|compute|build|draw|render|make|trace|improve)_/.test(name);
}

function inspectDrawOrder(source) {
    const lines = source.split(/\r?\n/);
    const setup = extractSetupBody(lines);
    const searchLines = setup.length ? setup : lines.map((text, index) => ({ text, line: index + 1 }));
    const callPrefix = String.raw`(?:call\s+|jal\s+ra\s*,\s*|jal\s+|j\s+)`;
    const circlePattern = new RegExp(String.raw`\b${callPrefix}draw_(?:grid_)?circles?\b|\bI?CIRCLE\b`, "i");
    const overlayPattern = new RegExp(String.raw`\b${callPrefix}draw_(?:tangent|final|overlay|filled|black|shape|polygon)\w*\b|\bIFILL\s+BLACK\b|\bBEGINSHAPE\b|\bPOLYGON\b`, "i");
    const circle = searchLines.find(entry => circlePattern.test(entry.text));
    const overlay = searchLines.find(entry =>
        overlayPattern.test(entry.text)
    );
    return {
        circleLine: circle?.line ?? null,
        overlayLine: overlay?.line ?? null,
    };
}

function extractSetupBody(lines) {
    const start = lines.findIndex(line => /^\s*setup:\s*(?:#.*)?$/.test(line));
    if (start < 0) return [];

    const body = [];
    for (let i = start + 1; i < lines.length; i++) {
        body.push({ text: lines[i], line: i + 1 });
        if (/^\s*ret\s*(?:#.*)?$/.test(lines[i])) break;
    }
    return body;
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
    "audit_sketch_constraints",
    {
        title: "Audit BRUT-V Sketch Constraints",
        description: "Heuristically audit generated sketch source against the original prompt for geometry, draw-order, and visual constraints before rendering.",
        inputSchema: {
            source: z.string().describe("BRUT-V assembly source to audit."),
            prompt: z.string().optional().describe("Original creative request or drawing brief."),
        },
    },
    async ({ source, prompt = "" }) =>
        jsonResult(auditSketchConstraints(source, prompt)),
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

server.registerTool(
    "get_atelier_context",
    {
        title: "Get BRUT-V Atelier Context",
        description: "Return recent atelier runs and optionally a selected run with source and image content for Hermes iteration.",
        inputSchema: {
            sessionId: z.string().optional().describe("Atelier session id. If omitted, returns recent runs across sessions."),
            runId: z.string().optional().describe("Run id to select. If omitted, selectLatest can choose the newest run."),
            limit: z.number().int().min(1).max(50).optional().describe("Number of recent runs to include. Defaults to 8."),
            selectLatest: z.boolean().optional().describe("Select newest run when runId is omitted. Defaults to false."),
            includeSource: z.boolean().optional().describe("Include selected run source. Defaults to true."),
            includeImageContent: z.boolean().optional().describe("Return selected PNG as MCP image content. Defaults to false."),
            includePngBase64: z.boolean().optional().describe("Include selected PNG base64 in structuredContent. Defaults to false."),
            request: z.string().optional().describe("Current user request or iteration instruction."),
            styleMemory: z.string().optional().describe("Relevant Hermes style memory excerpt."),
        },
    },
    async ({
        sessionId,
        runId,
        limit = 8,
        selectLatest = false,
        includeSource = true,
        includeImageContent = false,
        includePngBase64 = false,
        request,
        styleMemory,
    }) => {
        try {
            const runs = await listAtelierRunMetadata(sessionId, limit);
            let selectedRunId = runId;
            let selectedSessionId = sessionId;

            if (!selectedRunId && selectLatest && runs.length) {
                selectedRunId = runs[0].runId;
                selectedSessionId = runs[0].sessionId;
            }

            let selected = null;
            let pngBase64 = null;
            if (selectedRunId) {
                const paths = await findAtelierRun(selectedSessionId, selectedRunId);
                const run = await readAtelierRunForContext(paths, includeSource);
                pngBase64 = run.pngBase64;
                selected = {
                    metadata: run.metadata,
                    ...(includeSource ? { source: run.source } : {}),
                    ...(includePngBase64 && pngBase64 ? { pngBase64 } : {}),
                };
            }

            const output = {
                ok: true,
                root: relativeWebPath(atelierRoot),
                sessionId: sessionId ? sanitizeSegment(sessionId, "default") : null,
                request: request ?? null,
                styleMemory: styleMemory ?? null,
                recentRuns: runs,
                selected,
                nextActions: [
                    "Generate a BRUT-V sketch if no selected run exists.",
                    "Call audit_sketch_constraints on generated source and request before rendering when the brief contains geometry, draw-order, tangent, radius, label, or style constraints.",
                    "Use render_and_save_sketch for each rendered candidate.",
                    "Use selected.metadata.runId as parentRunId when iterating.",
                    "Critique the render against the request and styleMemory before changing code.",
                    "Return runId, image, concise critique, and the next concrete option to the user.",
                ],
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
    "run-brutv-creative-loop",
    {
        title: "Run BRUT-V Creative Loop",
        description: "Guide Hermes through generate, render, critique, iterate, and save for a BRUT-V atelier session.",
        argsSchema: {
            request: z.string(),
            sessionId: z.string().optional(),
            styleMemory: z.string().optional(),
            interactionMode: z.enum(["agent", "telegram", "voice", "kanban"]).optional(),
            iterationBudget: z.string().optional(),
        },
    },
    ({
        request,
        sessionId = "default",
        styleMemory = "No explicit style memory was provided.",
        interactionMode = "agent",
        iterationBudget = 3,
    }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: [
                    "Run a BRUT-V creative loop as Hermes.",
                    "",
                    `Interaction mode: ${interactionMode}`,
                    `Session id: ${sessionId}`,
                    `Iteration budget: ${iterationBudget}`,
                    "",
                    "Creative request:",
                    request,
                    "",
                    "Style memory:",
                    styleMemory,
                    "",
                    "Protocol:",
                    "1. Call get_atelier_context with the session id, request, styleMemory, limit 8, and selectLatest true.",
                    "2. If there is no suitable selected run, generate a complete BRUT-V sketch from the request.",
                    "3. Call render_and_save_sketch with sessionId, prompt, styleMemory, notes, tags, and parentRunId when iterating from a prior run.",
                    "4. Inspect the returned PNG and image metadata. If assembly/runtime failed, fix the source and render again within budget.",
                    "5. Critique the image against the request and style memory before changing code.",
                    "6. Iterate only when the critique names a concrete change. Save each candidate with parentRunId.",
                    "7. Stop when a candidate is good enough or the budget is exhausted.",
                    "",
                    "Response rules:",
                    "- For Telegram mode, keep the reply short: image, runId, one-sentence critique, and 2-3 next commands.",
                    "- Do not paste the whole source unless the user asks.",
                    "- Mention runId and sessionId so the next turn can continue.",
                    "- If user preference was learned, propose a concise Hermes memory update.",
                    "",
                    "BRUT-V rules:",
                    "- Do not include `.include \"../core/core.s\"` for web sketches.",
                    "- End every setup/draw procedure with ret.",
                    "- Prefer immediate macros for static literals and register macros for computed values.",
                    "- Use saved registers for persistent animation state.",
                ].join("\n"),
            },
        }],
    }),
);

server.registerPrompt(
    "continue-brutv-iteration",
    {
        title: "Continue BRUT-V Iteration",
        description: "Guide Hermes through a concrete iteration from a saved atelier run.",
        argsSchema: {
            sessionId: z.string(),
            parentRunId: z.string(),
            request: z.string(),
            critique: z.string().optional(),
            styleMemory: z.string().optional(),
        },
    },
    ({
        sessionId,
        parentRunId,
        request,
        critique = "No prior critique was provided.",
        styleMemory = "No explicit style memory was provided.",
    }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: [
                    "Continue a BRUT-V atelier iteration from a saved run.",
                    "",
                    `Session id: ${sessionId}`,
                    `Parent run id: ${parentRunId}`,
                    "",
                    "User request:",
                    request,
                    "",
                    "Prior critique:",
                    critique,
                    "",
                    "Style memory:",
                    styleMemory,
                    "",
                    "Protocol:",
                    "1. Call get_atelier_context with sessionId, runId=parentRunId, includeSource true, includeImageContent true, and the request/styleMemory.",
                    "2. Inspect the parent source, render image, validation, runtime, and image metadata.",
                    "3. Modify only what is needed for the requested iteration.",
                    "4. Call render_and_save_sketch with parentRunId set to the parent run id.",
                    "5. If the result fails validation/runtime or is visually worse, fix once before reporting.",
                    "6. Report the new runId, the concrete change, and the next useful option.",
                ].join("\n"),
            },
        }],
    }),
);

server.registerPrompt(
    "extract-brutv-style-memory",
    {
        title: "Extract BRUT-V Style Memory",
        description: "Convert user feedback and selected runs into concise Hermes memory updates.",
        argsSchema: {
            feedback: z.string(),
            currentStyleMemory: z.string().optional(),
            runSummary: z.string().optional(),
        },
    },
    ({
        feedback,
        currentStyleMemory = "No current style memory was provided.",
        runSummary = "No run summary was provided.",
    }) => ({
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: [
                    "Extract BRUT-V style memory updates from this user feedback.",
                    "",
                    "User feedback:",
                    feedback,
                    "",
                    "Current style memory:",
                    currentStyleMemory,
                    "",
                    "Run summary:",
                    runSummary,
                    "",
                    "Return concise memory candidates only when they are durable preferences.",
                    "Separate visual preferences from coding constraints.",
                    "Do not store one-off prompt details as memory.",
                    "If Hermes memory tools are available, save the durable updates there after user confirmation or when the preference is explicit.",
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

export { auditSketchConstraints };

if (path.resolve(process.argv[1] ?? "") === serverFile) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
