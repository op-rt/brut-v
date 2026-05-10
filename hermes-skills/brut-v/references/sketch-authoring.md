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
