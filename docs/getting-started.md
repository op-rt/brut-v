# Getting Started

This introduction moves from a blank canvas to animation, text, transforms, and shape buffers. All examples assume the usual include:

```asm
.include "../core/core.s"
```

## 01. A Blank Sketch

```asm
.include "../core/core.s"

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ret
```

This creates a `512x512` canvas and fills it with white.

## 02. Your First Primitive

```asm
.include "../core/core.s"

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK
    IRECT 156, 156, 200, 200
    ret
```

What this introduces:

- canvas setup
- a fill color
- a filled rectangle

## 03. Stroke And Fill

```asm
.include "../core/core.s"

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE

    IFILL YELLOW
    ISTROKE BLACK
    ISTROKE_WEIGHT 4
    ICIRCLE 256, 256, 120

    ret
```

Here the circle is filled in yellow and outlined in black.

Try variations:

- replace `ICIRCLE` with `IRECT`
- call `NO_FILL`
- call `NO_STROKE`

## 04. Transforming Shapes

```asm
.include "../core/core.s"

.eqv ANG 0x3f490fdb

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK

    PUSH_MATRIX
    ITRANSLATE 256, 256
    IROTATE ANG
    IRECT -80, -20, 160, 40
    POP_MATRIX

    ret
```

This sketch demonstrates:

- local transforms
- rotation around a translated origin
- matrix stack isolation with `PUSH_MATRIX` and `POP_MATRIX`

`ANG` is a float bit pattern. In BRUT-V, immediate float macros such as `IROTATE` consume IEEE-754 bits, not decimal literals.

## 05. Drawing A Polygon From Data

```asm
.include "../core/core.s"

.data
pts:
    .word 256, 80
    .word 420, 420
    .word 92, 420
pts_end:

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK

    la   t0, pts
    la   t1, pts_end
    POLYGON t0, t1

    ret
```

This is the simplest way to draw a closed shape from a point buffer.

## 06. Manual Shape Construction

```asm
.include "../core/core.s"

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK

    BEGINSHAPE
    li   t0, 256
    li   t1, 80
    VERTEX t0, t1
    li   t0, 420
    li   t1, 420
    VERTEX t0, t1
    li   t0, 92
    VERTEX t0, t1
    ENDSHAPE 1

    ret
```

In practice, `VERTEX` is what matters for shape construction. `BEGINSHAPE` clears the internal buffer, `VERTEX` appends transformed points, and `ENDSHAPE 1` closes the contour.

A more idiomatic version would use `VERTEX` for every point:

```asm
BEGINSHAPE
li   t0, 256
li   t1, 80
VERTEX t0, t1
li   t0, 420
li   t1, 420
VERTEX t0, t1
li   t0, 92
VERTEX t0, t1
ENDSHAPE 1
```

## 07. Text

```asm
.include "../core/core.s"

.data
msg: .asciz "BRUT-V"

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK
    ITEXT_SIZE 5

    lui  s0, %hi(msg)
    addi s0, s0, %lo(msg)

    TEXT s0, zero, zero
    ret
```

To center text, combine `TEXT_WIDTH` and `TEXT_HEIGHT`:

```asm
TEXT_WIDTH  t0, s0
TEXT_HEIGHT t1, s0
srli t0, t0, 1
srli t1, t1, 1
neg  t0, t0
neg  t1, t1
addi t0, t0, 256
addi t1, t1, 256
TEXT s0, t0, t1
```

## 08. Randomness

```asm
.include "../core/core.s"

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK
    NO_STROKE

    li   s0, 0

loop_points:
    li   t0, 200
    bge  s0, t0, done

    IRANDOM t1, 0, 512
    IRANDOM t2, 0, 512
    IRANDOM t3, 2, 12
    CIRCLE t1, t2, t3

    addi s0, s0, 1
    j    loop_points

done:
    ret
```

This is the usual pattern for generative drawing in `setup`: produce a composition once, then exit.

## 09. Animation

```asm
.include "../core/core.s"

.text
setup:
    ISIZE 512, 512
    REGISTER_DRAW draw
    ret

draw:
    IBACKGROUND WHITE
    IFILL BLACK
    NO_STROKE

    FRAMECOUNT t0
    andi t0, t0, 255
    addi t1, t0, 100
    ICIRCLE 256, 256, 40

    ret
```

This introduces the animation runtime:

- `REGISTER_DRAW draw` enables the main loop
- `FRAMECOUNT` gives the current frame index

## 10. Procedural Shape With Noise

```asm
.include "../core/core.s"

.data
n_pts:      .word 40
radius:     .float 180.0
k_val:      .float 0.35
center_val: .float 256.0

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ISTROKE BLACK
    ISTROKE_WEIGHT 2
    NO_FILL

    lui  t0, %hi(n_pts)
    lw   s0, %lo(n_pts)(t0)

    slli t0, s0, 3
    mv   s6, t0
    neg  t0, t0
    add  sp, sp, t0
    mv   s1, sp

    li   t0, TAU
    fmv.w.x fs0, t0
    fcvt.s.w fs1, s0
    fdiv.s fs2, fs0, fs1

    lui  t0, %hi(radius)
    flw  fs3, %lo(radius)(t0)
    lui  t0, %hi(k_val)
    flw  fs4, %lo(k_val)(t0)
    lui  t0, %hi(center_val)
    flw  fs5, %lo(center_val)(t0)

    li   s2, 0

build:
    bge  s2, s0, draw_shape

    fcvt.s.w fs6, s2
    fmul.s fs6, fs6, fs2

    COS fs7, fs6
    SIN fs8, fs6

    fmul.s ft0, fs7, fs4
    fmul.s ft1, fs8, fs4
    NOISE2D ft2, ft0, ft1
    fmul.s ft2, ft2, fs3

    fmul.s ft3, fs7, ft2
    fadd.s ft3, ft3, fs5
    fmul.s ft4, fs8, ft2
    fadd.s ft4, ft4, fs5

    fcvt.w.s t1, ft3
    fcvt.w.s t2, ft4
    slli t3, s2, 3
    add  t3, t3, s1
    sw   t1, 0(t3)
    sw   t2, 4(t3)

    addi s2, s2, 1
    j    build

draw_shape:
    mv   a0, s1
    add  a1, s1, s6
    POLYGON a0, a1

    add  sp, sp, s6
    ret
```

This is already close to the more advanced examples from `sketches/`.

It combines:

- float math
- trigonometry
- procedural noise
- dynamic point buffers
- polygon drawing

## Next Step

Once you are comfortable with these examples, keep `references.md` open and use the sketches directory as a pattern library.
