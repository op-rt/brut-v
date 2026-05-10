# Getting Started

This introduction moves from a blank canvas to registers, transforms, debug prints, shape construction, randomness, animation, text, and procedural forms. The web editor imports `core.s` automatically, so examples can start directly with `.text` or `.data`.

## 01. A Blank Sketch

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ret
```

This creates a `512x512` canvas and fills it with white.

The final `ret` is important: BRUT-V calls `setup` like a function, and `ret`
returns control to the framework runtime. If it is missing, the simulator keeps
executing whatever bytes come next in memory; the sketch may appear to draw
correctly, then fail with an unknown-opcode error.

## 02. Your First Primitive

```asm
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

## 03. Immediate And Register Macros

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE

    IFILL BLUE              # immediate color
    ICIRCLE 160, 256, 64    # immediate coordinates and radius

    li   s0, 352            # register values can be prepared first
    li   s1, 256
    li   s2, 64
    li   s3, RED
    FILL s3                 # register color
    CIRCLE s0, s1, s2       # register coordinates and radius

    ret
```

Here, read `s0`-`s3` as named storage slots; the next example explains register families in more detail.

Immediate macros usually start with `I` and take literal values directly in the macro call. They are concise when a value is fixed in the source, for example `ICIRCLE 160, 256, 64`, `IFILL BLUE`, or `ITRANSLATE 80, 0`.

Register macros take values that are already stored in registers. Use them when values are computed, loaded from data, randomized, animated, or reused across several instructions. In the example above, `CIRCLE s0, s1, s2` draws from the current values stored in `s0`, `s1`, and `s2`.

Almost all drawing primitives, attributes, and transforms have both forms. Some macros that do not consume source values only need one form; `NO_FILL`, for example, has no immediate argument to specialize.

## 04. Register Basics

```asm
.data
radius_scale: .float 1.25

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK

    li   s0, 256          # saved int: center x
    li   s1, 256          # saved int: center y
    li   s2, 80           # saved int: base radius

    la   t0, radius_scale # temporary int: address calculation
    flw  fs0, 0(t0)       # saved float: scale factor

    fcvt.s.w ft0, s2      # temporary float
    fmul.s ft0, ft0, fs0
    fcvt.w.s t1, ft0      # temporary int: scaled radius

    CIRCLE s0, s1, t1
    ret
```

Integer registers hold addresses, counters, coordinates, colors, and normal integer values. The most common groups are `t0`-`t6`, `s0`-`s11`, and `a0`-`a7`.

Use `t` registers for short-lived temporary values. Use `s` registers for values you want to keep across several instructions, loops, or BRUT-V macro calls. Use `a` registers mainly for arguments and return values; many macros and core routines use them internally, so do not treat them as stable storage.

Float registers follow the same idea: `ft` registers are temporary floats, `fs` registers are saved floats, and `fa` registers are float arguments and return values. In sketches, prefer `s`/`fs` for persistent state and `t`/`ft` for local calculations.

## 05. Stroke And Fill

```asm
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

## 06. Transforming Shapes

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK

    PUSH_MATRIX
    ITRANSLATE 256, 256
    IROTATE QUARTER_PI
    IRECT 0, 0, 160, 40
    POP_MATRIX

    ret
```

This sketch demonstrates:

- local transforms
- rotation around a translated origin
- matrix stack isolation with `PUSH_MATRIX` and `POP_MATRIX`

`QUARTER_PI` is a predefined float bit pattern. In BRUT-V, immediate float macros such as `IROTATE` consume IEEE-754 bits, not decimal literals.

## 07. Float Constants

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK

    PUSH_MATRIX
    ITRANSLATE 160, 256
    IROTATE QUARTER_PI        # uppercase: immediate float bits
    IRECT 0, 0, 120, 30
    POP_MATRIX

    la   t0, quarter_pi       # lowercase: address of a .float in memory
    flw  fs0, 0(t0)

    PUSH_MATRIX
    ITRANSLATE 320, 256
    ROTATE fs0                # register form, using the loaded float
    IRECT 0, 0, 120, 30
    POP_MATRIX

    ret
```

BRUT-V exposes angle constants in two forms. The uppercase names (`PI`, `HALF_PI`, `QUARTER_PI`, `TAU`) are `.eqv` constants containing the raw IEEE-754 bits of the float. They are useful when an instruction or macro expects an immediate value, as in `IROTATE QUARTER_PI`. The main advantage is that no memory access is needed: the bits are loaded directly into an integer register and moved into a float register when required.

The lowercase names (`pi`, `half_pi`, `quarter_pi`, `tau`) are labels pointing to real `.float` values in memory. Use them when you want to load a float explicitly with `la` and `flw`, then pass it to a register-based macro such as `ROTATE`.

## 08. Debug Prints

```asm
.text
setup:
    li   s0, 255
    PRINT_REG s0
    PRINT_HEX s0

    li   t0, PI
    fmv.w.x fs0, t0
    PRINT_REGF fs0
    PRINT_HEXF fs0

    ret
```

These macros print values for debugging; they do not draw on the canvas.

`PRINT_REG` prints an integer register in decimal. `PRINT_HEX` prints an integer register as raw hexadecimal bits, which is useful for packed colors. `PRINT_REGF` prints a float register in decimal. `PRINT_HEXF` prints the raw IEEE-754 bits of a float register in hexadecimal, which is useful when checking constants such as `PI`, `HALF_PI`, or `TAU`.

## 09. Manual Shape Construction

```asm
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

In practice, vertices are what matter for shape construction. `BEGINSHAPE` clears the internal buffer, `VERTEX` appends transformed points from registers, and `ENDSHAPE` finishes the shape.

When the coordinates are literals, `IVERTEX` is the immediate form. It loads the coordinates for you before appending the vertex:

```asm
BEGINSHAPE
IVERTEX 256, 80
IVERTEX 420, 420
IVERTEX 92, 420
ENDSHAPE 1
```

The `1` after `ENDSHAPE` means "close the contour": BRUT-V draws the final edge from the last vertex back to the first one.

## 10. Drawing A Polygon From Data

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

    la   t0, pts
    la   t1, pts_end
    POLYGON t0, t1

    ret
```

This is the simplest way to draw a closed shape from a point buffer.

The main difference from `BEGINSHAPE` / `VERTEX` is where the coordinates come from. With manual shape construction, each vertex is appended directly from registers as the code runs. With `POLYGON`, the points are already stored in memory: `pts` marks the beginning of the coordinate buffer, and `pts_end` marks where it stops. This makes it possible to draw shapes from recorded, generated, or reused coordinate buffers instead of spelling out each vertex in the drawing code.

## 11. Simple Loops

```asm
.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK

    li   s0, 5              # countdown
    li   s1, 96             # x position
    li   s2, 180            # y position
    li   s3, 20             # radius

loop_bnez:
    CIRCLE s1, s2, s3
    addi s1, s1, 64         # move x to the next circle
    addi s0, s0, -1         # decrement countdown
    bnez s0, loop_bnez      # repeat while countdown != 0

    # --- Same idea, written with an explicit exit condition ---

    li   s0, 0              # index
    li   s1, 96
    li   s2, 332

loop_beq:
    li   t0, 5              # target number of circles
    beq  s0, t0, done       # exit when index == 5
    CIRCLE s1, s2, s3
    addi s1, s1, 64         # move x to the next circle
    addi s0, s0, 1          # increment index
    j    loop_beq           # jump back unconditionally

done:
    ret
```

`bnez reg, label` means "branch if not zero". It is useful for countdown loops: decrement a counter, then repeat while it is still non-zero.

`beq a, b, label` means "branch if equal". It is useful when the loop has a clear exit condition: compare two registers, leave when they match, otherwise continue and jump back with `j`.

## 12. Randomness

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

done:
    ret
```

`IRANDOM dest, low, high` returns a random integer in `[low, high)` and stores it in `dest`. `RANDOM24 dest` returns a random 24-bit value, which is useful as a packed `0x00RRGGBB` color.

For floating-point values, use `IRANDOMF dest, low, high` with raw IEEE-754 float bit patterns, or `RANDOMF dest, low, high` with float registers. For example, `IRANDOMF fs0, 0x00000000, 0x3f800000` stores a random float in `[0.0, 1.0)`.

## 13. Animation

```asm
.text
setup:
    ISIZE 512, 512
    ANIMATE draw
    li   s2, 256          # y position
    li   s3, 40           # radius
    ret

draw:
    IBACKGROUND WHITE

    FRAMECOUNT t0
    add  t0, t0, s3       # x = frame_count + radius
    CIRCLE t0, s2, s3

    ret
```

This introduces the animation runtime:

- `ANIMATE draw` enables the main loop
- `FRAMECOUNT` gives the current frame index
- `s2` and `s3` keep the circle parameters between calls; `s` registers are for saved values, while `t` registers are temporary scratch registers

Section directives are sticky: after `.text`, `draw:` can follow `setup` directly. Add another `.text` only if a `.data` block or another section appears between them.

## 14. Text

```asm
.data
msg: .asciz "BRUT-V"

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK
    ITEXT_SIZE 5

    la   s0, msg

    TEXT s0, zero, zero
    ret
```

The `.data` section stores values that the program can read later. Here, `msg:` is a label, and `.asciz "BRUT-V"` stores a zero-terminated string at that label.

`la s0, msg` loads the address of the string into `s0`, so `TEXT` can read the characters from memory.

To center text, set text alignment before drawing:

```asm
.data
msg: .asciz "BRUT-V"

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    IFILL BLACK
    ITEXT_SIZE 5
    ITEXT_ALIGN CENTER, CENTER

    la   s0, msg
    li   s1, 256
    li   s2, 256
    TEXT s0, s1, s2
    ret
```

## 15. Manual Circle From Points

```asm
.data
n_pts:  .word 64
radius: .float 160.0

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ISTROKE BLACK
    ISTROKE_WEIGHT 2
    NO_FILL

    la   t0, n_pts             # load address of n_pts
    lw   s0, 0(t0)             # load number of points

    la   t0, radius            # load address of radius
    flw  fs0, 0(t0)            # load radius as float

    fcvt.s.w fs1, s0           # convert n_pts to float

    la   t0, tau               # load address of constant tau
    flw  fs2, 0(t0)            # load value of tau from address
    fdiv.s fs1, fs2, fs1       # unit angle = TWO_PI / n_pts

    li   s1, 256               # center, used for both x and y
    fmv.w.x fs2, zero          # current angle = 0.0

    BEGINSHAPE

circle_loop:
    COS fs3, fs2               # cos(current angle)
    SIN fs4, fs2               # sin(current angle)

    fmul.s fs3, fs3, fs0       # x = cos(angle) * radius
    fmul.s fs4, fs4, fs0       # y = sin(angle) * radius

    fcvt.w.s t0, fs3           # convert x to int
    fcvt.w.s t1, fs4           # convert y to int
    add  t0, t0, s1            # x += center
    add  t1, t1, s1            # y += center

    VERTEX t0, t1              # append point

    fadd.s fs2, fs2, fs1       # current angle += unit angle
    addi s0, s0, -1            # decrement loop counter
    bnez s0, circle_loop       # repeat while points remain

    ENDSHAPE 1                 # close shape
    ret
```

The `.data` section stores `n_pts` as an integer and `radius` as a float. The unit angle is the full turn divided by `n_pts`; BRUT-V names the full-turn constant `TAU`, which is equivalent to `TWO_PI`.

Each loop iteration converts the current angle into a point around `(256, 256)`, appends that point with `VERTEX`, then decrements the counter. `bnez` keeps the loop running until all points have been emitted.

## 16. Noised Circle

```asm
.data
n_pts:      .word 96
radius:     .float 130.0
noise_amp:  .float 90.0
noise_scale: .float 0.8

.text
setup:
    ISIZE 512, 512
    IBACKGROUND WHITE
    ISTROKE BLACK
    ISTROKE_WEIGHT 2
    NO_FILL

    la   t0, n_pts             # load address of n_pts
    lw   s0, 0(t0)             # load number of points

    la   t0, radius
    flw  fs0, 0(t0)            # base radius

    la   t0, noise_amp
    flw  fs5, 0(t0)            # noise amplitude

    la   t0, noise_scale
    flw  fs6, 0(t0)            # noise input scale

    fcvt.s.w fs1, s0           # convert n_pts to float

    la   t0, tau               # load address of constant tau
    flw  fs2, 0(t0)            # load value of tau from address
    fdiv.s fs1, fs2, fs1       # unit angle = TWO_PI / n_pts

    li   s1, 256               # center, used for both x and y
    fmv.w.x fs2, zero          # current angle = 0.0

    BEGINSHAPE

circle_loop:
    COS fs3, fs2               # cos(current angle)
    SIN fs4, fs2               # sin(current angle)

    fmul.s ft0, fs3, fs6       # noise x input
    fmul.s ft1, fs4, fs6       # noise y input
    NOISE2D ft2, ft0, ft1      # noise value in [0, 1]

    fmul.s ft2, ft2, fs5       # noise contribution
    fadd.s ft2, ft2, fs0       # noised radius

    fmul.s fs3, fs3, ft2       # x = cos(angle) * noised radius
    fmul.s fs4, fs4, ft2       # y = sin(angle) * noised radius

    fcvt.w.s t0, fs3           # convert x to int
    fcvt.w.s t1, fs4           # convert y to int
    add  t0, t0, s1            # x += center
    add  t1, t1, s1            # y += center

    VERTEX t0, t1              # append point

    fadd.s fs2, fs2, fs1       # current angle += unit angle
    addi s0, s0, -1            # decrement loop counter
    bnez s0, circle_loop       # repeat while points remain

    ENDSHAPE 1                 # close shape
    ret
```

This is the same construction pattern as `Manual Circle From Points`, but the radius changes at each vertex. The noise inputs come from the unit circle coordinates, so nearby angles sample nearby noise values and the contour stays continuous.

## Next Step

Once you are comfortable with these examples, keep `references.md` open and use the sketches directory as a pattern library.
