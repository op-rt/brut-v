# BRUT-V Examples Reference

Use these snippets as safe starting points. Web sketches do not need `.include "../core/core.s"`.

## Static Circle

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ISTROKE BLACK
    ISTROKE_WEIGHT 2
    NO_FILL

    ICIRCLE 256, 256, 80
    ret
```

## Computed Circle

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ISTROKE BLACK
    NO_FILL

    li   s0, 256
    li   s1, 256
    li   s2, 80
    CIRCLE s0, s1, s2

    ret
```

## Random Colored Dots

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    NO_STROKE

    li   s0, 200

loop_points:
    RANDOM24 a0
    FILL a0

    IRANDOM s1, 0, 512
    IRANDOM s2, 0, 512
    IRANDOM s3, 2, 12
    CIRCLE s1, s2, s3

    addi s0, s0, -1
    bnez s0, loop_points

    ret
```

Use `s1`, `s2`, and `s3` here because random and drawing macros may clobber temporary registers.

## Bouncing Circle

```asm
.data
x:  .float 256.0
y:  .float 256.0
vx: .float 2.2
vy: .float 1.7
r:  .float 32.0

.text
setup:
    ISIZE 512, 512
    ISTROKE BLACK
    ISTROKE_WEIGHT 2
    NO_FILL

    ANIMATE draw
    ret

draw:
    IBACKGROUND WHITE

    la   t0, x
    flw  fs0, 0(t0)
    la   t1, y
    flw  fs1, 0(t1)
    la   t2, vx
    flw  fs2, 0(t2)
    la   t3, vy
    flw  fs3, 0(t3)
    la   t4, r
    flw  fs4, 0(t4)

    fadd.s fs0, fs0, fs2
    fadd.s fs1, fs1, fs3

    fsub.s ft0, fs0, fs4
    fmv.w.x ft1, zero
    flt.s  t5, ft0, ft1
    bnez   t5, flip_x

    li      t5, 0x44000000     # 512.0
    fmv.w.x ft1, t5
    fadd.s  ft0, fs0, fs4
    flt.s   t5, ft1, ft0
    bnez    t5, flip_x
    j       check_y

flip_x:
    fneg.s fs2, fs2

check_y:
    fsub.s ft0, fs1, fs4
    fmv.w.x ft1, zero
    flt.s  t5, ft0, ft1
    bnez   t5, flip_y

    li      t5, 0x44000000
    fmv.w.x ft1, t5
    fadd.s  ft0, fs1, fs4
    flt.s   t5, ft1, ft0
    bnez    t5, flip_y
    j       draw_ball

flip_y:
    fneg.s fs3, fs3

draw_ball:
    fsw  fs0, 0(t0)
    fsw  fs1, 0(t1)
    fsw  fs2, 0(t2)
    fsw  fs3, 0(t3)

    fcvt.w.s s0, fs0
    fcvt.w.s s1, fs1
    fcvt.w.s s2, fs4
    CIRCLE s0, s1, s2

    ret
```

## Manual Triangle Shape

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ISTROKE BLACK
    IFILL YELLOW

    BEGINSHAPE
    IVERTEX 256, 96
    IVERTEX 96, 416
    IVERTEX 416, 416
    ENDSHAPE 1

    ret
```

## Polygon From Data

```asm
.data
points:
    .word 256, 96
    .word 96, 416
    .word 416, 416
points_end:

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ISTROKE BLACK
    IFILL YELLOW

    la   t0, points
    la   t1, points_end
    POLYGON t0, t1

    ret
```

Use `POLYGON` when the shape comes from a coordinate buffer rather than inline `VERTEX` calls.
