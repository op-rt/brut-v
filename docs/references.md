# References

This page catalogs the BRUT-V API exposed through macros and constants. Macros are grouped in a Processing-like way, but keep in mind that BRUT-V is still an assembly framework: every call ultimately manipulates registers and memory.

## How To Read This Reference

Conventions used below:

- `reg`: integer register
- `freg`: floating-point register
- `imm`: immediate integer literal
- `fimm-bits`: raw IEEE-754 float bits used as an immediate
- `ptr`: pointer stored in an integer register

Rule of thumb:

- `NAME ...` usually expects registers
- `INAME ...` usually expects immediate values

```asm
li   t0, BLACK
FILL t0
IFILL BLACK
```

## Constants

### Color Constants

- `WHITE`
- `BLACK`
- `YELLOW`
- `GREEN`
- `GREY`
- `BLUE`
- `RED`
- `MAGENTA`
- `ORANGE`

```asm
IBACKGROUND WHITE
IFILL RED
```

### Float Constants Encoded As Bits

- `PI`
- `HALF_PI`
- `QUARTER_PI`
- `TAU`

These are particularly useful with immediate float macros such as `IROTATE`, `IARC`, and `ISCALE`.

```asm
IROTATE HALF_PI
IARC 256, 256, 200, 200, 0x00000000, PI, 1
```

### Alignment Constants

- `CENTER` = `0`
- `RIGHT` = `1`
- `BOTTOM` = `2`
- `LEFT` = `3`
- `TOP` = `4`

Use them with `TEXT_ALIGN`/`ITEXT_ALIGN`.

## Setting

### `ISIZE w, h`

Sets the canvas width and height.

- Parameters: `imm, imm`
- Notes: usually called once in `setup`

```asm
ISIZE 512, 512
```

### `BACKGROUND color`

Fills the full canvas with a color from a register.

- Parameters: `reg`

```asm
li   t0, WHITE
BACKGROUND t0
```

### `IBACKGROUND color`

Fills the full canvas with an immediate color.

- Parameters: `imm`

```asm
IBACKGROUND WHITE
```

## Shape

### Primitives

#### `POINT x, y`

Draws a point using register arguments.

- Parameters: `reg, reg`

```asm
POINT s0, s1
```

#### `IPOINT x, y`

Draws a point using immediate coordinates.

- Parameters: `imm, imm`

```asm
IPOINT 256, 256
```

#### `PIXEL index, color`

Writes a pixel directly by linear framebuffer index.

- Parameters: `reg, reg`
- Notes: `index = y * width + x`

```asm
PIXEL s0, s1
```

#### `IPIXEL index, color`

Immediate version of `PIXEL`.

- Parameters: `imm, imm`

```asm
IPIXEL 0, BLACK
```

#### `PIXEL_RGB index, r, g, b`

Writes one pixel by index from RGB channels held in registers.

- Parameters: `reg, reg, reg, reg`

```asm
PIXEL_RGB s0, s1, s2, s3
```

#### `IPIXEL_RGB index, r, g, b`

Immediate version of `PIXEL_RGB`.

- Parameters: `imm, imm, imm, imm`

```asm
IPIXEL_RGB 0, 255, 0, 0
```

#### `LINE x1, y1, x2, y2`

Draws a line.

- Parameters: `reg, reg, reg, reg`

```asm
LINE s0, s1, s2, s3
```

#### `ILINE x1, y1, x2, y2`

Immediate version of `LINE`.

- Parameters: `imm, imm, imm, imm`

```asm
ILINE 40, 40, 472, 472
```

#### `RECT x, y, w, h`

Draws a rectangle.

- Parameters: `reg, reg, reg, reg`
- Notes: fill and stroke both apply

```asm
RECT s0, s1, s2, s3
```

#### `IRECT x, y, w, h`

Immediate version of `RECT`.

```asm
IRECT 96, 96, 320, 320
```

#### `RECT_ROUNDED x, y, w, h, rTL, rTR, rBR, rBL`

Draws a rounded rectangle with independent corner radii.

- Parameters: `reg, reg, reg, reg, reg, reg, reg, reg`

```asm
RECT_ROUNDED s0, s1, s2, s3, s4, s5, s6, s7
```

#### `IRECT_ROUNDED x, y, w, h, rTL, rTR, rBR, rBL`

Immediate version of `RECT_ROUNDED`.

```asm
IRECT_ROUNDED 80, 80, 352, 200, 24, 24, 24, 24
```

#### `CIRCLE cx, cy, r`

Draws a circle.

- Parameters: `reg, reg, reg`

```asm
CIRCLE s0, s1, s2
```

#### `ICIRCLE cx, cy, r`

Immediate version of `CIRCLE`.

```asm
ICIRCLE 256, 256, 120
```

#### `ELLIPSE cx, cy, w, h`

Draws an ellipse.

- Parameters: `reg, reg, reg, reg`

```asm
ELLIPSE s0, s1, s2, s3
```

#### `IELLIPSE cx, cy, w, h`

Immediate version of `ELLIPSE`.

```asm
IELLIPSE 256, 256, 300, 140
```

#### `ARC cx, cy, w, h, start, stop, mode`

Draws an arc or closed arc-like shape.

- Parameters: `reg, reg, reg, reg, freg, freg, reg`
- `mode`: `0` for open, `1` for closed
- Notes: the current implementation uses the polygon pipeline

```asm
li   a4, 1
ARC s0, s1, s2, s3, fs0, fs1, a4
```

#### `IARC cx, cy, w, h, start, stop, mode`

Immediate version of `ARC`.

- Parameters: `imm, imm, imm, imm, fimm-bits, fimm-bits, imm`

```asm
IARC 256, 256, 180, 180, 0x00000000, PI, 1
```

#### `TRIANGLE x1, y1, x2, y2, x3, y3`

Draws a triangle.

- Parameters: `reg, reg, reg, reg, reg, reg`

```asm
TRIANGLE s0, s1, s2, s3, s4, s5
```

#### `ITRIANGLE x1, y1, x2, y2, x3, y3`

Immediate version of `TRIANGLE`.

```asm
ITRIANGLE 256, 80, 420, 420, 92, 420
```

### Curves And Paths

BRUT-V does not currently expose Bezier-style curve macros. Shape construction is based on point buffers and vertex accumulation.

#### `BEGINSHAPE`

Clears the internal vertex buffer.

```asm
BEGINSHAPE
```

#### `ENDSHAPE close`

Finalizes the current shape.

- Parameters: `imm`
- `0`: open
- `1`: closed

```asm
ENDSHAPE 1
```

#### `VERTEX x, y`

Adds one point to the current shape buffer.

- Parameters: `reg, reg`
- Notes: the point is transformed by the current transform matrix

```asm
VERTEX s0, s1
```

#### `IVERTEX x, y`

Adds one point to the current shape buffer using immediate coordinates.

- Parameters: `imm, imm`
- Notes: this is the immediate form of `VERTEX`

```asm
IVERTEX 256, 80
```

#### `POLYGON start, end`

Draws a closed polygon from a point buffer.

- Parameters: `ptr, ptr`
- Buffer layout: `.word x0, y0, x1, y1, ...`

```asm
la   t0, points
la   t1, points_end
POLYGON t0, t1
```

#### `IPOLYGON start, end`

Immediate-address version of `POLYGON`.

```asm
IPOLYGON 0x10008000, 0x10008030
```

#### `POLYLINE start, end`

Draws an open polyline from a point buffer.

- Parameters: `ptr, ptr`

```asm
la   t0, points
la   t1, points_end
POLYLINE t0, t1
```

#### `IPOLYLINE start, end`

Immediate-address version of `POLYLINE`.

```asm
IPOLYLINE 0x10008000, 0x10008030
```

### Attributes

#### `STROKE color`

Sets the stroke color from a register and enables stroke.

- Parameters: `reg`

```asm
STROKE s0
```

#### `ISTROKE color`

Immediate version of `STROKE`.

```asm
ISTROKE BLACK
```

#### `STROKE_RGB r, g, b`

Sets the stroke color from three register channels.

```asm
STROKE_RGB s0, s1, s2
```

#### `ISTROKE_RGB r, g, b`

Immediate version of `STROKE_RGB`.

```asm
ISTROKE_RGB 255, 0, 0
```

#### `NO_STROKE`

Disables stroke drawing.

```asm
NO_STROKE
```

#### `STROKE_WEIGHT w`

Sets stroke thickness from a register.

```asm
STROKE_WEIGHT s0
```

#### `ISTROKE_WEIGHT w`

Immediate version of `STROKE_WEIGHT`.

```asm
ISTROKE_WEIGHT 4
```

#### `STROKE_CAP type`

Sets line cap mode from a register.

- `0`: round
- `1`: project

```asm
STROKE_CAP s0
```

#### `ISTROKE_CAP type`

Immediate version of `STROKE_CAP`.

```asm
ISTROKE_CAP 1
```

#### `FILL color`

Sets the fill color from a register and enables fill.

```asm
FILL s0
```

#### `IFILL color`

Immediate version of `FILL`.

```asm
IFILL BLACK
```

#### `FILL_RGB r, g, b`

Sets the fill color from register channels.

```asm
FILL_RGB s0, s1, s2
```

#### `IFILL_RGB r, g, b`

Immediate version of `FILL_RGB`.

```asm
IFILL_RGB 255, 200, 0
```

#### `NO_FILL`

Disables fill drawing.

```asm
NO_FILL
```

## Typography

### `TEXT_SIZE size`

Sets text scale from a register.

- Parameters: `reg`
- Notes: the base font is `8x8`

```asm
TEXT_SIZE s0
```

### `ITEXT_SIZE size`

Immediate version of `TEXT_SIZE`.

```asm
ITEXT_SIZE 4
```

### `TEXT_ALIGN h, v`

Sets Processing-style text alignment from registers. `TEXT` then interprets its
`x, y` arguments as an anchor point using the current alignment.

- Parameters: `reg, reg`
- Horizontal values: `LEFT`, `CENTER`, `RIGHT`
- Vertical values: `TOP`, `CENTER`, `BOTTOM`
- Default: `LEFT, TOP`

```asm
li s0, CENTER
li s1, CENTER
TEXT_ALIGN s0, s1
```

### `ITEXT_ALIGN h, v`

Immediate version of `TEXT_ALIGN`.

```asm
ITEXT_ALIGN CENTER, CENTER
ITEXT_ALIGN 0, 0
```

### `TEXT str, x, y`

Draws a string.

- Parameters: `ptr, reg, reg`
- Notes: text uses the current fill color and current text alignment

```asm
la   s0, msg
ITEXT_ALIGN CENTER, CENTER
TEXT s0, s1, s2
```

### `TEXT_CENTER str, cx, cy`

Shortcut that draws a string centered around a register-based point.

- Parameters: `ptr, reg, reg`
- Notes: text uses the current fill color and current text size

```asm
la   s0, msg
li   s1, 256
li   s2, 256
TEXT_CENTER s0, s1, s2
```

### `ITEXT_CENTER str, cx, cy`

Immediate center-point shortcut version of `TEXT_CENTER`.

```asm
la s0, msg
ITEXT_CENTER s0, 256, 256
```

### `TEXT_WIDTH dest, str`

Computes string width in pixels.

- Parameters: `reg, ptr`
- Returns: width in `dest`

```asm
TEXT_WIDTH t0, s0
```

### `TEXT_HEIGHT dest, str`

Computes string height in pixels.

- Parameters: `reg, ptr`

```asm
TEXT_HEIGHT t1, s0
```

### `FONT font`

Selects the bitmap font table used by `TEXT`.

- Parameters: `ptr`
- Notes: the default font is initialized by the runtime; use `FONT` only when you provide another 256-character, 8-byte-per-character font table.

```asm
la   s0, font_8x8
FONT s0
```

## Image

### `IMAGE ptr, x, y, w, h`

Draws an RGB image from a pointer to packed `.word` pixels.

- Parameters: `ptr, reg, reg, reg, reg`
- Pixel format: `0x00RRGGBB`

```asm
la   s0, image_pixels
IMAGE s0, s1, s2, s3, s4
```

### `IIMAGE ptr, x, y, w, h`

Version of `IMAGE` using immediate coordinates and size.

- Notes: `ptr` is still expected in a register

```asm
la   s0, image_pixels
IIMAGE s0, 100, 80, 32, 32
```

### `IMAGE_1BPP_2X ptr, w, h, x, y`

Draws a packed 1-bit image at 2x scale.

- Parameters: `ptr, reg, reg, reg, reg`
- Data layout: row-major, packed bits, MSB first

```asm
la   s0, raster
IMAGE_1BPP_2X s0, s1, s2, s3, s4
```

### `IIMAGE_1BPP_2X ptr, w, h, x, y`

Immediate-coordinate version of `IMAGE_1BPP_2X`.

- Notes: `ptr` is still expected in a register

```asm
la   s0, raster
IIMAGE_1BPP_2X s0, 128, 64, 80, 40
```

## Transform

### `TRANSLATE dx, dy`

Translates the current transform matrix.

- Parameters: `reg, reg`

```asm
TRANSLATE s0, s1
```

### `ITRANSLATE dx, dy`

Immediate version of `TRANSLATE`.

```asm
ITRANSLATE 256, 256
```

### `SCALE s`

Scales the current transform matrix using a float register.

- Parameters: `freg`

```asm
SCALE fs0
```

### `ISCALE bits`

Immediate version of `SCALE`.

- Parameters: `fimm-bits`

```asm
ISCALE 0x3f800000
```

### `ROTATE angle`

Rotates the current transform matrix using a float register.

- Parameters: `freg`

```asm
ROTATE fs0
```

### `IROTATE bits`

Immediate version of `ROTATE`.

- Parameters: `fimm-bits`

```asm
IROTATE QUARTER_PI
```

### `PUSH_MATRIX`

Pushes the current transform matrix onto the stack.

```asm
PUSH_MATRIX
```

### `POP_MATRIX`

Restores the previous transform matrix.

```asm
POP_MATRIX
```

## Conversion

### `RADIANS dest, src`

Converts degrees to radians.

- Parameters: `freg, freg`

```asm
RADIANS fs1, fs0
```

### `DEGREES dest, src`

Converts radians to degrees.

```asm
DEGREES fs1, fs0
```

### `ROUND dest, src`

Rounds a float register to an integer register.

```asm
ROUND t0, fs0
```

### `FLOOR dest, src`

Floors a float to an integer.

```asm
FLOOR t0, fs0
```

### `CEIL dest, src`

Ceils a float to an integer.

```asm
CEIL t0, fs0
```

## Math

### Calculation

#### `MIN dest, a, b`

Integer minimum.

```asm
MIN t0, s0, s1
```

#### `MAX dest, a, b`

Integer maximum.

```asm
MAX t0, s0, s1
```

#### `ABS dest, src`

Integer absolute value.

```asm
ABS t0, s0
```

#### `SQRT dest, src`

Integer square root.

```asm
SQRT t0, s0
```

#### `CONSTRAIN dest, amt, low, high`

Clamps an integer between two bounds.

```asm
CONSTRAIN t0, s0, s1, s2
```

#### `MINF dest, a, b`

Float minimum. Implemented inline.

```asm
MINF fs0, fs1, fs2
```

#### `MAXF dest, a, b`

Float maximum. Implemented inline.

```asm
MAXF fs0, fs1, fs2
```

#### `ABSF dest, src`

Float absolute value. Implemented inline.

```asm
ABSF fs0, fs1
```

#### `SQRTF dest, src`

Float square root. Implemented inline.

```asm
SQRTF fs0, fs1
```

#### `LERP dest, start, stop, amount`

Linear interpolation between two integers using a float amount.

- `amount` is usually in `[0, 1]`

```asm
LERP t0, s0, s1, fs0
```

#### `NORM dest, value, start, stop`

Normalizes an integer into a float between `0` and `1`.

- Returns a float in `dest`

```asm
NORM fs0, s0, s1, s2
```

#### `MAP dest, value, start1, stop1, start2, stop2`

Maps an integer range into another integer range.

```asm
MAP t0, s0, s1, s2, s3, s4
```

#### `LOG dest, src`

Natural logarithm of a float.

```asm
LOG fs1, fs0
```

### Trigonometry

#### `COS dest, src`

Cosine of a float angle in radians.

```asm
COS fs1, fs0
```

#### `SIN dest, src`

Sine of a float angle in radians.

```asm
SIN fs1, fs0
```

#### `TAN dest, src`

Tangent of a float angle in radians.

```asm
TAN fs1, fs0
```

#### `ATAN dest, src`

Inverse tangent.

```asm
ATAN fs1, fs0
```

#### `ATAN2 dest, y, x`

Two-argument inverse tangent.

```asm
ATAN2 fs2, fs0, fs1
```

#### `ASIN dest, src`

Inverse sine.

```asm
ASIN fs1, fs0
```

#### `ACOS dest, src`

Inverse cosine.

```asm
ACOS fs1, fs0
```

### Distance

#### `DIST dest, x1, y1, x2, y2`

Integer distance between two integer points.

```asm
DIST t0, s0, s1, s2, s3
```

#### `IDIST dest, x1, y1, x2, y2`

Immediate version of `DIST`.

```asm
IDIST t0, 0, 0, 512, 512
```

#### `DISTF dest, x1, y1, x2, y2`

Distance between two float points.

```asm
DISTF fs0, fs1, fs2, fs3, fs4
```

#### `IDISTF dest, x1, y1, x2, y2`

Immediate version of `DISTF`. Float immediates are raw IEEE-754 bit patterns.

```asm
IDISTF fs0, 0x00000000, 0x00000000, 0x43800000, 0x43800000
```

### Random

#### `IRANDOM dest, low, high`

Random integer in `[low, high)`.

- Returns in `dest`

```asm
IRANDOM t0, 0, 512
```

#### `RANDOM dest, low, high`

Register version of `IRANDOM`.

```asm
RANDOM t0, s0, s1
```

#### `IRANDOMF dest, low, high`

Random float in `[low, high)`. Immediate float values are raw IEEE-754 bit patterns.

- Parameters: `freg, fimm-bits, fimm-bits`
- Returns in `dest`

```asm
IRANDOMF fs0, 0x00000000, 0x3f800000   # 0.0 <= fs0 < 1.0
```

#### `RANDOMF dest, low, high`

Register version of `IRANDOMF`.

- Parameters: `freg, freg, freg`
- Returns in `dest`

```asm
RANDOMF fs0, fs1, fs2
```

#### `RANDOM24 dest`

Returns a 24-bit random integer.

```asm
RANDOM24 t0
```

### Noise

#### `NOISE1D dest, x`

1D Perlin-style noise.

- Parameters: `freg, freg`
- Returns a float

```asm
NOISE1D fs1, fs0
```

#### `INOISE1D dest, x`

Immediate version of `NOISE1D`. The float immediate is a raw IEEE-754 bit pattern.

```asm
INOISE1D fs1, 0x3f800000
```

#### `NOISE2D dest, x, y`

2D Perlin-style noise.

```asm
NOISE2D fs2, fs0, fs1
```

#### `INOISE2D dest, x, y`

Immediate version of `NOISE2D`. Float immediates are raw IEEE-754 bit patterns.

```asm
INOISE2D fs2, 0x3f800000, 0x40000000
```

#### `NOISE_SEED seed`

Seeds the noise generator from a register.

```asm
NOISE_SEED s0
```

#### `INOISE_SEED seed`

Immediate version of `NOISE_SEED`.

```asm
INOISE_SEED 42
```

## Runtime

### `ANIMATE label`

Registers a `draw` callback and enables animation-style execution.

```asm
ANIMATE draw
```

If `setup` and `draw` are contiguous code labels, a second `.text` before `draw:` is unnecessary. Section directives stay active until another section is selected.

### `LOOP`

Re-enables the animation loop after `NOLOOP`.

```asm
LOOP
```

### `NOLOOP`

Stops the animation loop after the current `draw` frame completes.

```asm
NOLOOP
```

### `FRAMECOUNT dest`

Copies the current frame index into a register.

```asm
FRAMECOUNT t0
```

## Data Helpers

### `LOAD_POINT rx, ry, base, index`

Loads one integer point from a point buffer.

- Result: `rx = x`, `ry = y`

```asm
LOAD_POINT s0, s1, s2, s3
```

### `STORE_POINT rx, ry, base, index`

Stores one integer point into a point buffer.

```asm
STORE_POINT s0, s1, s2, s3
```

### `LOAD_POINTF fx, fy, base, index`

Loads one float point from a float point buffer.

```asm
LOAD_POINTF fs0, fs1, s0, s1
```

### `STORE_POINTF fx, fy, base, index`

Stores one float point into a float point buffer.

```asm
STORE_POINTF fs0, fs1, s0, s1
```

## Debug

### `PRINT_REG reg`

Prints an integer register followed by a newline.

### `PRINT_HEX reg`

Prints an integer register in hexadecimal.

### `PRINT_REGF freg`

Prints a float register in decimal.

### `PRINT_HEXF freg`

Prints the IEEE-754 bits of a float register in hexadecimal.

## Practical Notes

### Fill And Stroke

- Filled shapes use the current fill state
- Outlines use the current stroke state
- Text uses fill, not stroke
- `NO_FILL` and `NO_STROKE` only affect subsequent drawing calls

### Immediate Float Macros

The immediate float macros do not accept decimal literals like `1.5` directly. They accept float bit patterns:

```asm
ISCALE 0x3fc00000       # 1.5
IROTATE PI
```

When you already have a float in a register, use the non-`I` form:

```asm
SCALE fs0
ROTATE fs1
```

### Shape Buffer Layout

`POLYGON` and `POLYLINE` expect:

```asm
pts:
    .word x0, y0
    .word x1, y1
    .word x2, y2
pts_end:
```

### Image Buffer Layout

`IMAGE` expects:

```asm
image_pixels:
    .word 0x00RRGGBB, 0x00RRGGBB, ...
```

### Recommended Default Pattern

For most static sketches:

```asm
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ret
```

For animated sketches:

```asm
setup:
    ISIZE 512, 512
    ANIMATE draw
    ret
```
