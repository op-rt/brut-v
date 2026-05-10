# BRUT-V Examples For Agents

Use these compact patterns when generating new sketches.

## Blank Canvas

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ret
```

## Static Primitive

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK
    ICIRCLE 256, 256, 80
    ret
```

## Random Dots

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    NO_STROKE

    li s0, 200

loop:
    RANDOM24 a0
    FILL a0

    IRANDOM s1, 0, 512
    IRANDOM s2, 0, 512
    IRANDOM s3, 2, 12
    CIRCLE s1, s2, s3

    addi s0, s0, -1
    bnez s0, loop
    ret
```

## Animation Skeleton

```asm
.text
setup:
    ISIZE 512, 512
    ANIMATE draw
    ret

draw:
    IBACKGROUND WHITE
    # draw one frame
    ret
```

## Moving Circle State In Data

```asm
.data
x:  .float 256.0
vx: .float 3.0

.text
setup:
    ISIZE 512, 512
    NO_FILL
    ISTROKE BLACK
    ANIMATE draw
    ret

draw:
    IBACKGROUND WHITE

    la   t0, x
    flw  fs0, 0(t0)
    la   t0, vx
    flw  fs1, 0(t0)
    fadd.s fs0, fs0, fs1

    la   t0, x
    fsw  fs0, 0(t0)

    fcvt.w.s a0, fs0
    li       a1, 256
    li       a2, 40
    CIRCLE a0, a1, a2
    ret
```

## Manual Shape

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK

    BEGINSHAPE
    IVERTEX 256, 80
    IVERTEX 420, 420
    IVERTEX 92, 420
    ENDSHAPE 1
    ret
```

## Polygon From Data

```asm
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

    la t0, pts
    la t1, pts_end
    POLYGON t0, t1
    ret
```

## Minimal Perspective Projection Pattern

The useful formula is:

```text
screen_x = x / z
screen_y = y / z
```

For a visible screen result:

1. Rotate or otherwise modify `x`, `y`, `z`.
2. Add a positive z offset so `z` stays away from zero.
3. Divide `x` and `y` by `z`.
4. Multiply by a screen scale.
5. Add the screen center.

Example fragment:

```asm
# x' = x * cos - z * sin
fmul.s ft3, ft0, fs2
fmul.s ft4, ft2, fs3
fsub.s ft3, ft3, ft4

# z' = x * sin + z * cos + z_offset
fmul.s ft4, ft0, fs3
fmul.s ft5, ft2, fs2
fadd.s ft5, ft4, ft5
fadd.s ft5, ft5, fs4

# project and map to screen
fdiv.s ft3, ft3, ft5
fmul.s ft3, ft3, fs5
fadd.s ft3, ft3, fs6
```

See `../sketches/rotating_cube.asm` for a complete implementation.
