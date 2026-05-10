# BRUT-V Tangent Geometry For Agents

This reference is for prompts that ask for tangents, arcs, outlines, or filled
shapes built from circles.

## Non-Negotiable Radius Rule

If the user says `R=50`, `same radius`, `no shrinking`, or "original drawn
circles", tangent and arc points must be built on the displayed circle
boundary.

The sketch must not use a smaller helper circle, inset radius, or visual
collision-avoidance radius. A comment is not enough; the code must actually use
the same radius in the geometry.

For every tangent point `(px, py)` on a circle centered at `(cx, cy)`:

```text
(px - cx)^2 + (py - cy)^2 == R^2
```

With integer or fixed-point arithmetic, a small rounding error is acceptable,
but the target radius is still `R`, never `R - strokeWeight`, `R - 5`, `35`
for `R=50`, or any other hidden inset.

Use an auditable comment next to the construction:

```asm
# RADIUS_INVARIANT: DRAWN_CIRCLE_R == TANGENT_ARC_R == 50
# BOUNDARY_INVARIANT: tangent point distance squared from center == R*R
```

## Equal-Radius Outer Tangent

For two visible circles with the same radius `R`:

```text
C1 = (x1, y1)
C2 = (x2, y2)
dx = x2 - x1
dy = y2 - y1
d  = sqrt(dx*dx + dy*dy)
u  = (dx/d, dy/d)
n  = (-u.y, u.x)
```

The two outer tangents are:

```text
P1 = C1 + side * R * n
P2 = C2 + side * R * n
```

where `side` is `+1` or `-1`.

In integer code, compute:

```text
offx = round((-dy * R) / d)
offy = round(( dx * R) / d)
P1 = (x1 + side*offx, y1 + side*offy)
P2 = (x2 + side*offx, y2 + side*offy)
```

For `R=50`, hardcoding `35` is not a valid general solution. It is only the
rounded offset for an exact 45-degree diagonal; it is wrong for horizontal,
vertical, and most other center-to-center directions. Derive offsets from
`dx`, `dy`, `R`, and `d`.

## Equal-Radius Inner Tangent

Inner/crossing tangents exist only if `d > 2R`. For equal radii:

```text
u = (dx/d, dy/d)
p = (-u.y, u.x)
c = 2R / d
h = sqrt(1 - c*c)
n1 = c*u + side*h*p
n2 = -c*u + side*h*p
P1 = C1 + R*n1
P2 = C2 + R*n2
```

Again, `P1` and `P2` are on the displayed circle boundaries. If implementing
this exactly is too large for a sketch, say so and render a simpler geometry;
do not replace it with smaller invisible circles.

## Audit Checklist

Reject a sketch if tangent code contains:

- `li ..., 35` or another hardcoded inset-like offset for `R=50`;
- `r - stroke`, `radius - 5`, `inner radius`, `inset`, or `avoid collision`;
- sign-only branches such as `bgt dx, zero` / `blt dy, zero` plus literal
  offsets, with no normalization, division, distance, square root, or lookup
  table tied to `dx`, `dy`, and `R`;
- comments claiming the invariant while the code uses a smaller offset.

