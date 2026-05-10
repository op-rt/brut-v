# BRUT-V Macro Guide For Agents

Use this as a compact map of the public macro API. For exact details, see `docs/references.md`.

## Naming Convention

- `NAME ...`: usually register-based.
- `INAME ...`: usually immediate-based.
- Immediate float arguments are raw IEEE-754 bits.

Example:

```asm
li   s0, BLACK
FILL s0
IFILL BLACK
```

## Canvas And Pixels

- `ISIZE w, h`: create canvas.
- `BACKGROUND color`, `IBACKGROUND color`: clear canvas.
- `POINT x, y`, `IPOINT x, y`: draw one point.
- `PIXEL index, color`, `IPIXEL index, color`: write framebuffer pixel by index.
- `PIXEL_RGB index, r, g, b`, `IPIXEL_RGB index, r, g, b`: packed RGB pixel.

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

Colors:

- `WHITE`
- `BLACK`
- `YELLOW`
- `GREEN`
- `GREY`
- `BLUE`
- `RED`
- `MAGENTA`
- `ORANGE`

## Primitives

- `LINE x1, y1, x2, y2`, `ILINE x1, y1, x2, y2`
- `RECT x, y, w, h`, `IRECT x, y, w, h`
- `RECT_ROUNDED ...`, `IRECT_ROUNDED ...`
- `CIRCLE cx, cy, r`, `ICIRCLE cx, cy, r`
- `ELLIPSE cx, cy, w, h`, `IELLIPSE cx, cy, w, h`
- `ARC cx, cy, w, h, start, stop, mode`, `IARC ...`
- `TRIANGLE x1, y1, x2, y2, x3, y3`, `ITRIANGLE ...`

Rectangle width/height should be non-negative.

`IARC` start/stop angles are float bit patterns such as `0x00000000`, `PI`, `HALF_PI`, `TAU`.

## Shapes And Paths

- `BEGINSHAPE`
- `VERTEX x, y`
- `IVERTEX x, y`
- `ENDSHAPE close`
- `POLYGON start, end`
- `POLYLINE start, end`

`VERTEX` uses registers. `IVERTEX` uses immediate coordinates.

`POLYGON` and `POLYLINE` read `(x, y)` integer point buffers:

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

Use `PUSH_MATRIX` / `POP_MATRIX` to isolate transforms.

## Text

- `TEXT str, x, y`
- `TEXT_ALIGN h, v`
- `ITEXT_ALIGN h, v`
- `TEXT_CENTER str, cx, cy`
- `ITEXT_CENTER str, cx, cy`
- `TEXT_SIZE size`, `ITEXT_SIZE size`
- `TEXT_WIDTH dest, str`
- `TEXT_HEIGHT dest, str`
- `FONT font_ptr`

Strings live in `.data`:

```asm
.data
msg: .asciz "Hello"

.text
setup:
    la s0, msg
    ITEXT_ALIGN CENTER, CENTER
    li s1, 256
    li s2, 256
    TEXT s0, s1, s2
    ret
```

## Math

Integer:

- `MIN`, `MAX`, `ABS`, `SQRT`
- `CONSTRAIN`
- `DIST`, `IDIST`
- `MAP`
- `LERP`

Float:

- `MINF`, `MAXF`, `ABSF`, `SQRTF`
- `ROUND`, `FLOOR`, `CEIL`
- `DISTF`, `IDISTF`
- `NORM`
- `LOG`

Trig:

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

- `ANIMATE label`: enable animation loop.
- `FRAMECOUNT dest`: current frame count.
- `LOOP`
- `NOLOOP`
- `PRINT_REG reg`
- `PRINT_HEX reg`
- `PRINT_REGF freg`
- `PRINT_HEXF freg`

Section directives are sticky. In animated sketches, `draw:` can follow `setup` directly after one `.text` unless another section is selected between them.

Debug print output appears in the web console area below the canvas.
