# BRUT-V Documentation

BRUT-V is a creative coding framework written for a RISC-V assembly environment. It provides a compact macro layer on top of a framebuffer, a small math toolkit, a transform stack, text rendering, procedural noise, and a minimal animation runtime.

This documentation is meant to complement the web version of BRUT-V and to serve as a practical reference while writing sketches.

At the moment, the web environment is limited to a maximum canvas size of `512x512`. Plan examples and assets with that limit in mind.

## Documentation Map

- `getting-started.md`: progressive introduction through small sketches
- `references.md`: macro reference, grouped by category

## First Principles

A BRUT-V sketch usually starts like this:

```asm
.include "../core/core.s"

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE

    ret
```

The framework automatically calls `setup` once. If you also register a `draw` function with `REGISTER_DRAW draw`, BRUT-V enters an animation loop and calls `draw` once per frame.

## Core Model

BRUT-V is built around a few simple ideas:

- A canvas stored in a framebuffer
- A global drawing state: `fill`, `stroke`, `stroke weight`, `text size`
- A current transform matrix: `translation`, `rotation`, `scaling`
- Immediate-mode drawing: each macro draws directly into the framebuffer
- A small runtime for animation: `REGISTER_DRAW`, `FRAMECOUNT`, `LOOP`, `NOLOOP`

## Direct And Immediate Macros

Many macros come in two forms:

- Register form: `FILL`, `LINE`, `RECT`, `TEXT_SIZE`, `ROTATE`
- Immediate form: `IFILL`, `ILINE`, `IRECT`, `ITEXT_SIZE`, `IROTATE`

The rule is simple:

- The non-`I` form expects registers
- The `I` form expects literal values encoded directly in the instruction stream

```asm
li   t0, BLACK
FILL t0              # register form

IFILL BLACK          # immediate form
```

For integer values, the `I` form is usually the easiest one to use.

For float-based immediate macros such as `IROTATE`, `IARC`, and `ISCALE`, the immediate value must be the raw IEEE-754 bits of a float. BRUT-V exposes constants such as `PI`, `HALF_PI`, `QUARTER_PI`, and `TAU` precisely for this use:

```asm
IROTATE HALF_PI
IARC 256, 256, 200, 200, 0x00000000, PI, 1
```

## Registers And Data Types

BRUT-V uses both integer and floating-point registers:

- Integer registers for positions, sizes, colors, indices, counters
- Float registers for trigonometry, noise inputs, angle conversions, scaling factors, and some math helpers

Typical conventions:

- Coordinates, widths, heights: integer registers
- Angles: float registers, or immediate float bit patterns with `I...` macros
- Colors: packed `0x00RRGGBB` integers

## Colors

Built-in constants from `config.s` include:

- `WHITE`
- `BLACK`
- `YELLOW`
- `GREEN`
- `GREY`
- `BLUE`
- `RED`
- `MAGENTA`

You can also build colors manually:

```asm
li   t0, 0x00FF8800
FILL t0
```

Or by channels:

```asm
IFILL_RGB 255, 136, 0
```

## Data Formats Used By The Framework

### Polygon And Polyline Buffers

`POLYGON` and `POLYLINE` expect a contiguous array of points stored as:

```asm
points:
    .word x0, y0
    .word x1, y1
    .word x2, y2
points_end:
```

Then:

```asm
la   t0, points
la   t1, points_end
POLYGON t0, t1
```

### RGB Images

`IMAGE` expects a pointer to packed 32-bit pixels in row-major order:

- one pixel per `.word`
- format: `0x00RRGGBB`

### 1-Bit Images

`IMAGE_1BPP_2X` expects:

- packed bits, MSB first
- row-major layout
- output rendered at 2x scale

## Text Rendering

Text is drawn with the current font and the current fill color.

Important detail:

- text uses `fill`
- text does not use `stroke`

The built-in font is an 8x8 bitmap font, scaled by `TEXT_SIZE` or `ITEXT_SIZE`.

## Animation

To animate, define `draw` and register it from `setup`:

```asm
.include "../core/core.s"

.text
setup:
    ISIZE 512, 512
    REGISTER_DRAW draw
    ret

draw:
    IBACKGROUND WHITE
    ret
```

Useful runtime helpers:

- `REGISTER_DRAW`
- `FRAMECOUNT`
- `LOOP`
- `NOLOOP`

## Recommended Reading Order

1. Start with `getting-started.md`
2. Keep `references.md` open while writing sketches
3. Use the sketches folder as a companion library of examples
