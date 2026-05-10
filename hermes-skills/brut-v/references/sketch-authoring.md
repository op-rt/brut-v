# BRUT-V Sketch Authoring Reference

This reference explains how to produce sketches that compile and run in the BRUT-V web editor.

## Minimal Sketch

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ret
```

Do not add `.include "../core/core.s"` for web sketches. The assembler imports the core automatically.

Always end `setup` and `draw` with `ret`. Without `ret`, execution falls through into unrelated memory or data and can produce simulator errors even if the visible drawing appears correct.

## Data And Code

Use `.data` for persistent constants, strings, and buffers:

```asm
.data
radius: .float 80.0
msg:    .asciz "Hello"

.text
setup:
    ISIZE 512, 512
    ret
```

Load labels with `la`, then load the value:

```asm
la   t0, radius
flw  fs0, 0(t0)
```

Use `li` only for immediate constants:

```asm
li   t0, TAU
fmv.w.x fs0, t0
```

## Registers

Integer registers:

- `t0` to `t6`: temporary scratch values.
- `s0` to `s11`: saved/persistent sketch state.
- `a0` to `a7`: arguments and return values, frequently clobbered by routines.

Float registers:

- `ft0` to `ft11`: temporary float scratch values.
- `fs0` to `fs11`: saved/persistent float state.
- `fa0` to `fa7`: float arguments and return values.

Practical rule: use `s*` and `fs*` for values that survive macro calls or loop iterations; use temporary and argument registers only for short local work.

## Immediate And Register Macros

Immediate macros usually start with `I` and take literal values:

```asm
IBACKGROUND WHITE
IFILL BLACK
ICIRCLE 256, 256, 80
```

Register macros take registers:

```asm
li   s0, 256
li   s1, 256
li   s2, 80
CIRCLE s0, s1, s2
```

Use immediate macros when values are static. Use register macros when values are computed, randomized, animated, or loaded from memory.

## Float Constants

Uppercase constants such as `PI`, `HALF_PI`, `QUARTER_PI`, and `TAU` are integer bit patterns for IEEE-754 float values. Use them with immediate float macros or `li` plus `fmv.w.x`:

```asm
IROTATE QUARTER_PI

li      t0, TAU
fmv.w.x fs0, t0
```

Lowercase labels such as `pi`, `half_pi`, `quarter_pi`, and `tau` are memory addresses containing `.float` values. Load them with `la` and `flw`:

```asm
la   t0, tau
flw  fs0, 0(t0)
```

Do not write `li t0, tau`.

## Animation

Register a draw callback in `setup`:

```asm
.text
setup:
    ISIZE 512, 512
    ANIMATE draw
    ret

draw:
    IBACKGROUND WHITE
    # update and draw frame
    ret
```

Use `FRAMECOUNT dest` to read the current frame count.
The second `.text` before `draw:` is redundant unless the sketch switches to `.data` or another section after `setup`.

## Random

Integer random:

```asm
IRANDOM s0, 0, 512
```

Float random:

```asm
IRANDOMF fs0, 0x00000000, 0x3f800000   # [0.0, 1.0)
```

Register-based float random:

```asm
RANDOMF fs0, fs1, fs2
```

Random color:

```asm
RANDOM24 a0
FILL a0
```

Use saved registers for random values that must survive subsequent macro calls.

## Algorithmic Briefs

When a user asks a sketch to choose, shuffle, sort, rank, pathfind, simulate, or
calculate, implement that logic in RISC-V assembly. Do not precompute the final
creative state with Python, JavaScript, shell tools, or offline reasoning.

Allowed static data:

- user-specified constants such as grid coordinates, radius values, color
  values, label strings, and array sizes;
- lookup tables that are part of the rendering technique.

Not allowed unless the user asks for a fixed composition:

- hardcoded random selections;
- hardcoded shuffled order;
- hardcoded path or ranking that the prompt asked the sketch to calculate;
- a comment claiming a calculation happened when the source only contains the
  final result.

For a request like "select 12 circles from a 4x4 grid and rank a path", the
sketch should allocate arrays such as `selected`, `visited`, `order`, and
`ranks`, use `IRANDOM` until exactly 12 unique indices are selected, compute a
bounded path order with RISC-V loops, and draw from those computed arrays. If
the user asks for path improvement, run a bounded 2-opt style swap pass over the
`order` array using squared center-point distances.

If the exact algorithm is too large for a sketch, implement and name a bounded
approximation. Do not silently replace runtime logic with precomputed data.

Use named procedures for complex sketches instead of one long unrolled `setup`.
For centered rank labels inside circles, use `ITEXT_SIZE 1`,
`ITEXT_ALIGN CENTER, CENTER`, and `TEXT`.
For selected/unselected styling, branch per element and set `ISTROKE BLACK` or
`ISTROKE GREY` inside that branch before drawing the circle.
For white circles, set `IFILL WHITE` or `NO_FILL` before the circle pass, then
switch to `IFILL BLACK` before rank labels. Do not redraw every circle with one
final black stroke after branching. Rank labels should be placed at the actual
circle center coordinates; do not use manual x/y offsets to fake centering.
The canvas is immediate-mode: later drawing appears on top. If a brief asks for
a final black filled polygon on top of the circles, draw the circles first and
draw the filled polygon after them. For tangent and arc geometry around circles,
reuse the visible circle radius exactly unless the user asks for inset geometry;
`r=50` with "no shrinking" means tangent and arc points use radius 50, not a
smaller helper radius. Add an auditable comment such as
`# RADIUS_INVARIANT: DRAWN_CIRCLE_R == TANGENT_ARC_R == 50` and use the same
constant or register for the visible circle and tangent/arc construction. Each
tangent point must be on that boundary, so its squared distance from the center
is `R*R` in the sketch's integer or fixed-point approximation.

## Shape Construction

Manual shape:

```asm
BEGINSHAPE
IVERTEX 100, 100
IVERTEX 200, 100
IVERTEX 150, 200
ENDSHAPE 1
```

`ENDSHAPE 1` closes the shape. `ENDSHAPE 0` leaves it open.

Buffer-based polygon:

```asm
.data
pts:
    .word 100, 100
    .word 200, 100
    .word 150, 200
pts_end:

.text
setup:
    la   t0, pts
    la   t1, pts_end
    POLYGON t0, t1
    ret
```

Use `POLYGON` or `POLYLINE` when coordinates already live in a memory buffer.

## Common Pitfalls

- Missing `ret` at the end of `setup` or `draw`.
- Holding persistent state in `a*` registers.
- Assuming `t*` registers survive every macro.
- Passing negative width or height to rectangle macros.
- Using decimal float literals where raw IEEE-754 bits are expected.
- Using `li` with labels instead of `la`.
- Editing generated files without changing their source files.
