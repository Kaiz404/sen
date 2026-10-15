/** An SVG `matrix(a b c d e f)`. RNSVG's native nodes accept a transform only in this form. */
export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

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
  const c = 0 - sin * sy;
  const d = cos * sy;
  return [a, b, c, d, tx + ox - (a * ox + c * oy), ty + oy - (b * ox + d * oy)];
}
