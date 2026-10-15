/** An SVG `matrix(a b c d e f)`. RNSVG's native nodes accept a transform only in this form. */
export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

/**
 * T(tx, ty) · T(ox, oy) · R(rDeg) · S(sx, sy) · T(−ox, −oy): scale and rotate about (ox, oy), then move.
 * A worklet. `mat(-26, 0, 0, 1, 1, 0, 0)` is [1, 0, 0, 1, -26, 0].
 */
export function mat(
  tx: number,
  ty: number,
  rDeg: number,
  sx: number,
  sy: number,
  ox: number,
  oy: number,
): Matrix {
  'worklet';
  const rad = (rDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const a = cos * sx;
  const b = sin * sx;
  // `0 -` rather than unary minus, so an unrotated matrix holds 0 and not -0.
  const c = 0 - sin * sy;
  const d = cos * sy;
  return [a, b, c, d, tx + ox - (a * ox + c * oy), ty + oy - (b * ox + d * oy)];
}
