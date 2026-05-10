import { assemble } from "./assembler.js";
import { RV32IF } from "./rv32if.js";

export const AGENT_CANVAS_WIDTH = 512;
export const AGENT_CANVAS_HEIGHT = 512;
export const AGENT_MAX_FRAMES = 240;
export const AGENT_MAX_STEPS = 200_000_000;
export const AGENT_DEFAULT_MAX_STEPS = 20_000_000;

export function isAnimatedAssembly(result) {
    return (result.lines ?? []).some(line =>
        line.file !== "core.s" && /\bcall\s+register_draw\b/.test(line.text)
    );
}

export function summarizeAssembly(result) {
    return {
        ok: result.errors.length === 0,
        errors: result.errors,
        warnings: result.warnings ?? [],
        textBytes: result.text?.length ?? 0,
        dataBytes: result.data?.length ?? 0,
        dataBase: result.dataBase,
        textBase: result.textBase,
        expandedLineCount: result.lines?.length ?? 0,
        animated: isAnimatedAssembly(result),
        symbols: result.symbols ? Object.fromEntries([...result.symbols.entries()].slice(0, 200)) : {},
    };
}

export function clampRenderOptions(options = {}) {
    return {
        mainName: String(options.mainName ?? "sketch.asm"),
        autoIncludeCore: options.autoIncludeCore !== false,
        width: AGENT_CANVAS_WIDTH,
        height: AGENT_CANVAS_HEIGHT,
        frames: clampInt(options.frames ?? 1, 1, AGENT_MAX_FRAMES),
        maxSteps: clampInt(options.maxSteps ?? AGENT_DEFAULT_MAX_STEPS, 1, AGENT_MAX_STEPS),
    };
}

export function renderSketchSource(source, options = {}) {
    const opts = clampRenderOptions(options);
    const result = assemble(String(source ?? ""), {
        mainName: opts.mainName,
        autoIncludeCore: opts.autoIncludeCore,
    });
    const validation = summarizeAssembly(result);

    if (!validation.ok) {
        return {
            ok: false,
            stage: "assemble",
            validation,
            runtime: null,
            console: [],
            image: null,
            rgba: null,
        };
    }

    const sim = new RV32IF();
    const consoleLines = [];
    let runtimeError = null;

    sim.onConsole = (kind, text) => {
        consoleLines.push({ kind, text: String(text) });
    };
    sim.onError = msg => {
        runtimeError = String(msg);
    };

    sim.load(result.text, result.data);

    const animated = validation.animated;
    const frameCounterAddr = result.symbols?.get?.("frame_count");
    sim.watchFrameCounter(animated && frameCounterAddr != null ? frameCounterAddr : null);

    const runtime = runBounded(sim, {
        animated,
        targetFrames: opts.frames,
        maxSteps: opts.maxSteps,
    });

    if (runtimeError && !runtime.error) runtime.error = runtimeError;
    const rgba = sim.getFramebuffer(opts.width, opts.height);
    const image = analyzeRgba(rgba, opts.width, opts.height);

    const ok = !runtime.error && runtime.reason !== "step-limit";
    return {
        ok,
        stage: ok ? "render" : "runtime",
        validation,
        runtime,
        console: consoleLines,
        image,
        rgba,
    };
}

function runBounded(sim, { animated, targetFrames, maxSteps }) {
    const runtime = {
        animated,
        requestedFrames: animated ? targetFrames : 0,
        framesRendered: 0,
        steps: 0,
        reason: "exit",
        error: null,
    };

    sim.running = true;
    try {
        while (sim.running && runtime.steps < maxSteps) {
            sim.step();
            runtime.steps++;

            if (animated && sim.consumeFrameBoundary()) {
                runtime.framesRendered++;
                if (runtime.framesRendered >= targetFrames) {
                    runtime.reason = "frame-target";
                    sim.running = false;
                    break;
                }
            }
        }
    } catch (error) {
        sim.running = false;
        runtime.reason = "error";
        runtime.error = error.message ?? String(error);
    }

    if (sim.running && runtime.steps >= maxSteps) {
        sim.running = false;
        runtime.reason = "step-limit";
        runtime.error = `Step limit reached after ${runtime.steps} instructions.`;
    }

    return runtime;
}

function analyzeRgba(rgba, width, height) {
    const first = colorKey(rgba, 0);
    let changedPixels = 0;
    let nonTransparentPixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let rTotal = 0;
    let gTotal = 0;
    let bTotal = 0;
    const sampledColors = new Set();

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = rgba[i + 0];
            const g = rgba[i + 1];
            const b = rgba[i + 2];
            const a = rgba[i + 3];
            rTotal += r;
            gTotal += g;
            bTotal += b;
            if (a !== 0) nonTransparentPixels++;
            if (sampledColors.size < 256 && ((x + y) % 17 === 0))
                sampledColors.add(`${r},${g},${b},${a}`);
            if (colorKey(rgba, i) === first) continue;
            changedPixels++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    const pixels = width * height;
    return {
        width,
        height,
        blank: changedPixels === 0,
        background: first,
        changedPixels,
        changedRatio: pixels ? changedPixels / pixels : 0,
        nonTransparentPixels,
        averageRgb: [
            Math.round(rTotal / pixels),
            Math.round(gTotal / pixels),
            Math.round(bTotal / pixels),
        ],
        sampledColorCount: sampledColors.size,
        changedBounds: changedPixels === 0 ? null : { minX, minY, maxX, maxY },
    };
}

function colorKey(rgba, i) {
    return `#${hex(rgba[i + 0])}${hex(rgba[i + 1])}${hex(rgba[i + 2])}${hex(rgba[i + 3])}`;
}

function hex(value) {
    return value.toString(16).padStart(2, "0");
}

function clampInt(value, min, max) {
    const n = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : min;
    return Math.max(min, Math.min(max, n));
}
