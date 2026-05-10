# BRUT-V Macro API Reference

This is a compact map of the public macro surface. For exact behavior, inspect the core sources or the user-facing references in the web docs.

## Naming

- `NAME ...`: usually register-based.
- `INAME ...`: usually immediate-based.
- Immediate float arguments are raw IEEE-754 bit patterns.

Example:

```asm
li   s0, BLACK
FILL s0
IFILL BLACK
```

## Canvas And Pixels

- `SIZE w, h`, `ISIZE w, h`
- `BACKGROUND color`, `IBACKGROUND color`
- `POINT x, y`, `IPOINT x, y`
- `PIXEL index, color`, `IPIXEL index, color`
- `PIXEL_RGB index, r, g, b`, `IPIXEL_RGB index, r, g, b`

Typical setup:

```asm
ISIZE 512, 512
IBACKGROUND WHITE
```

## Attributes

- `FILL color`, `IFILL color`
- `FILL_RGB r, g, b`, `IFILL_RGB r, g, b`
- `NO_FILL`
- `STROKE color`, `ISTROKE color`
- `STROKE_RGB r, g, b`, `ISTROKE_RGB r, g, b`
- `NO_STROKE`
- `STROKE_WEIGHT w`, `ISTROKE_WEIGHT w`
- `STROKE_CAP type`, `ISTROKE_CAP type`

Common colors:

- `WHITE`, `BLACK`, `YELLOW`, `GREEN`, `GREY`, `BLUE`, `RED`, `MAGENTA`, `ORANGE`

## Primitives

- `LINE x1, y1, x2, y2`, `ILINE x1, y1, x2, y2`
- `RECT x, y, w, h`, `IRECT x, y, w, h`
- `RECT_ROUNDED ...`, `IRECT_ROUNDED ...`
- `CIRCLE cx, cy, r`, `ICIRCLE cx, cy, r`
- `ELLIPSE cx, cy, w, h`, `IELLIPSE cx, cy, w, h`
- `ARC cx, cy, w, h, start, stop, mode`, `IARC ...`
- `TRIANGLE x1, y1, x2, y2, x3, y3`, `ITRIANGLE ...`

Rectangle width and height should be non-negative.

## Shapes And Paths

- `BEGINSHAPE`
- `VERTEX x, y`
- `IVERTEX x, y`
- `ENDSHAPE close`
- `POLYGON start, end`
- `POLYLINE start, end`

`VERTEX` uses registers. `IVERTEX` uses immediate coordinates.

`POLYGON` and `POLYLINE` read an integer point buffer containing consecutive `(x, y)` words:

```asm
points:
    .word 100, 100
    .word 200, 100
points_end:
```

## Transforms

- `TRANSLATE dx, dy`, `ITRANSLATE dx, dy`
- `SCALE factor`, `ISCALE bits`
- `ROTATE angle`, `IROTATE bits`
- `PUSH_MATRIX`
- `POP_MATRIX`

Use `PUSH_MATRIX` and `POP_MATRIX` to isolate transformations.

## Text

- `TEXT str, x, y`
- `TEXT_CENTER str, cx, cy`
- `ITEXT_CENTER str, cx, cy`
- `TEXT_SIZE size`, `ITEXT_SIZE size`
- `TEXT_WIDTH dest, str`
- `TEXT_HEIGHT dest, str`
- `FONT font_ptr`

Example:

```asm
.data
msg: .asciz "Hello"

.text
setup:
    la   s0, msg
    ITEXT_CENTER s0, 256, 256
    ret
```

## Math

Integer helpers:

- `MIN`, `MAX`, `ABS`, `SQRT`
- `CONSTRAIN`
- `DIST`, `IDIST`
- `MAP`
- `LERP`

Float helpers:

- `MINF`, `MAXF`, `ABSF`, `SQRTF`
- `ROUND`, `FLOOR`, `CEIL`
- `DISTF`, `IDISTF`
- `NORM`
- `LOG`

Trigonometry:

- `COS`, `SIN`, `TAN`
- `ATAN`, `ATAN2`
- `ASIN`, `ACOS`
- `RADIANS`, `DEGREES`

## Random And Noise

Integer random:

```asm
IRANDOM s0, 0, 512
RANDOM  s0, s1, s2
```

Float random:

```asm
IRANDOMF fs0, 0x00000000, 0x3f800000
RANDOMF  fs0, fs1, fs2
```

Color random:

```asm
RANDOM24 a0
FILL a0
```

Noise:

- `NOISE1D dest, x`
- `INOISE1D dest, x`
- `NOISE2D dest, x, y`
- `INOISE2D dest, x, y`
- `NOISE_SEED seed`
- `INOISE_SEED seed`

Noise inputs and outputs are floats.

## Runtime And Debug

- `ANIMATE label`: enables the animation loop.
- `FRAMECOUNT dest`: reads the current frame count.
- `LOOP`: resume animation.
- `NOLOOP`: pause animation.
- `PRINT_REG reg`: print a signed integer register.
- `PRINT_HEX reg`: print an integer register as hexadecimal.
- `PRINT_REGF freg`: print a float register as decimal.
- `PRINT_HEXF freg`: print the raw float bits as hexadecimal.

Debug output appears in the web console/message area below the canvas.
