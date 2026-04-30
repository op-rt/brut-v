// End-to-end smoke test: drive the JS assembler + the JS simulator the same
// way the browser will. We assemble recursive_grid.asm, load it into the VM, and
// run until __exit (or until we hit a sane step ceiling). At the end we
// inspect the framebuffer to make sure something was actually drawn.

import { assemble } from "../assembler.js";
import { RV32IF }   from "../rv32if.js";
import { SKETCH_FILES } from "../sketches-fs.js";

function check(label, cond, detail = "") {
    const tag = cond ? "PASS" : "FAIL";
    console.log(`[${tag}] ${label}${detail ? "  — " + detail : ""}`);
    if (!cond) process.exitCode = 1;
}

function runSketch(name, maxSteps = 5_000_000) {
    const src = SKETCH_FILES[name];
    if (!src) throw new Error(`no such sketch: ${name}`);

    const r = assemble(src, { mainName: name });
    check(`${name}: assemble ok`, r.errors.length === 0, r.errors.join("|"));
    if (r.errors.length) return null;

    const sim = new RV32IF();
    sim.load(r.text, r.data);

    let exited = false, errored = null;
    sim.onExit  = () => { exited = true; };
    sim.onError = (msg) => { errored = msg; };

    // Step manually instead of runAsync. The simulator signals exit by
    // setting `this.running = false` (typically from an `exit` ecall).
    sim.running = true;
    let steps = 0;
    try {
        while (sim.running && steps < maxSteps && !exited && !errored) {
            sim.step();
            steps++;
        }
    } catch (e) {
        errored = e.message ?? String(e);
    }

    return { sim, exited, errored, steps, text: r.text, data: r.data };
}

// ── 1. The default starter sketch must run to exit and draw a checkerboard.
{
    const res = runSketch("recursive_grid.asm");
    if (res) {
        check("recursive_grid.asm: ran to __exit", res.exited && !res.errored,
              res.errored ? `error: ${res.errored}` : `steps: ${res.steps}`);

        // The framebuffer at 0x10010000 (= BUF_DATA + 0x10000) should have
        // BOTH black and white pixels after the checkerboard renders.
        const fb = res.sim.getFramebuffer(512, 512);
        let blacks = 0, whites = 0;
        for (let i = 0; i < fb.length; i += 4) {
            const r = fb[i], g = fb[i+1], b = fb[i+2];
            if (r === 0   && g === 0   && b === 0)   blacks++;
            if (r === 255 && g === 255 && b === 255) whites++;
        }
        check("recursive_grid.asm: framebuffer has black pixels",  blacks > 1000, `count=${blacks}`);
        check("recursive_grid.asm: framebuffer has white pixels",  whites > 1000, `count=${whites}`);
    }
}

// ── 2. A few other sketches must at least not crash ────────────────────────
const PROBES = ["arc.asm", "primitives.asm", "polygon_manual.asm"];
for (const name of PROBES) {
    const res = runSketch(name, 10_000_000);
    if (res)
        check(`${name}: runs without simulator error`, !res.errored,
              `exited=${res.exited} steps=${res.steps} ${res.errored ?? ""}`);
}

console.log(`\nDone. exit code: ${process.exitCode ?? 0}`);
