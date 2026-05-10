# BRUT-V Sketch Authoring For Agents

This file explains how to write BRUT-V sketches that compile and run in the web editor.

## Minimal Sketch

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ret
```

Do not add `.include "../core/core.s"` for web sketches. The web assembler imports the core automatically.

Always end `setup` and `draw` with `ret`.

## Basic Structure

Use `.data` for persistent values:

```asm
.data
radius: .float 80.0
msg:    .asciz "Hello"

.text
setup:
    ISIZE 512, 512
    ret
```

Use `.text` for code. Labels such as `setup:`, `draw:`, and loop labels are normal assembly labels.

## Register Conventions

Integer registers:

- `t0`-`t6`: temporary values. Safe for short local calculations.
- `s0`-`s11`: saved/persistent sketch state. Prefer these for values that must survive macro calls.
- `a0`-`a7`: arguments and return values. Many macros and core routines clobber them.

Float registers:

- `ft0`-`ft11`: temporary float calculations.
- `fs0`-`fs11`: persistent float values.
- `fa0`-`fa7`: float arguments and return values. Core routines use these internally.

Practical rule: use `s*` and `fs*` for state; use `t*` and `ft*` for local scratch.

## Immediate And Register Macros

Immediate macros usually start with `I` and take literal values:

```asm
IBACKGROUND WHITE
IFILL BLACK
ICIRCLE 256, 256, 80
```

Register macros take registers:

```asm
li s0, 256
li s1, 256
li s2, 80
CIRCLE s0, s1, s2
```

Use immediate macros when values are static. Use register macros when values are computed, randomized, loaded from memory, or animated.

## Float Immediates

Immediate float macros take raw IEEE-754 bit patterns, not decimal literals.

Examples:

- `0x3f800000` is `1.0`
- `0x40000000` is `2.0`
- `0x40800000` is `4.0`
- `PI`, `HALF_PI`, `QUARTER_PI`, `TAU` are uppercase `.eqv` float bit constants.

Example:

```asm
IROTATE QUARTER_PI
IRANDOMF fs0, 0x00000000, TAU
```

Lowercase labels such as `tau`, `pi`, `half_pi`, `quarter_pi` are addresses of `.float` values in memory. Load them with `la` + `flw`:

```asm
la  t0, tau
flw fs0, 0(t0)
```

Do not use `li t0, tau`; labels are addresses and `li` should reject them.

## Animation Pattern

```asm
.data
x: .float 256.0

.text
setup:
    ISIZE 512, 512
    ANIMATE draw
    ret

draw:
    IBACKGROUND WHITE
    # update state
    # draw frame
    ret
```

`ANIMATE draw` stores a callback pointer. The core calls `draw` repeatedly and increments `frame_count` after each draw.
The second `.text` before `draw:` is redundant unless the sketch switches to `.data` or another section after `setup`.

## Random Pattern

Integer:

```asm
IRANDOM s0, 0, 512
```

Float:

```asm
IRANDOMF fs0, 0x00000000, 0x3f800000   # [0.0, 1.0)
```

Color:

```asm
RANDOM24 a0
FILL a0
```

`IRANDOM` and `RANDOM` return integers in `[low, high)`.

`IRANDOMF` and `RANDOMF` return floats in `[low, high)`.

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
    la t0, pts
    la t1, pts_end
    POLYGON t0, t1
    ret
```

Use `POLYGON` when coordinates are stored in memory.

## Common Pitfalls

- Missing `ret` at the end of `setup` or `draw`.
- Using `a*` registers for persistent values across macro calls.
- Passing negative width or height to immediate rectangle macros.
- Using decimal float literals where raw IEEE-754 bits are required.
- Using `li` with labels instead of `la`.
- Forgetting to regenerate `sketches-fs.js` after editing `../sketches/*.asm`.
