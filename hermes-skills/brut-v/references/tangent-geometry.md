# BRUT-V Tangent Geometry

Use this reference when a sketch prompt asks for tangents, arcs, outlines, or
filled shapes built from circles.

## Same-Radius Contract

If the user says `R=50`, `same radius`, `no shrinking`, or "original drawn
circles", tangent and arc points must be built on the displayed circle
boundary. Do not use a smaller helper circle.

For every tangent point `(px, py)` on a circle centered at `(cx, cy)`:

```text
(px - cx)^2 + (py - cy)^2 == R^2
```

Add auditable comments and make the code match them:

```asm
# RADIUS_INVARIANT: DRAWN_CIRCLE_R == TANGENT_ARC_R == 50
# BOUNDARY_INVARIANT: tangent point distance squared from center == R*R
```

## Outer Tangent For Equal Radii

For two circles:

```text
dx = x2 - x1
dy = y2 - y1
d  = sqrt(dx*dx + dy*dy)
offx = round((-dy * R) / d)
offy = round(( dx * R) / d)
P1 = (x1 + side*offx, y1 + side*offy)
P2 = (x2 + side*offx, y2 + side*offy)
```

`side` is `+1` or `-1`.

Do not hardcode `35` for `R=50`. That value only approximates a 45-degree
diagonal and is wrong for horizontal, vertical, and arbitrary directions.

## Inner Tangent For Equal Radii

Inner/crossing tangents exist only if `d > 2R`.

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

If this is too much for one sketch, simplify honestly. Do not fake the result
with an inset invisible circle.

## Reject Patterns

Reject tangent code that contains:

- hardcoded inset-like offsets such as `li ..., 35` when `R=50`;
- `r - stroke`, `radius - 5`, `inner radius`, `inset`, or `avoid collision`;
- sign-only branches plus literal offsets with no normalization or distance;
- comments claiming the invariant while the code contradicts it.

