// Scales the first numeric amount inside an ingredient quantity string by a
// factor, preserving units and any surrounding text. Handles integers,
// decimals, simple fractions ("1/2") and mixed numbers ("1 1/2").

function parseNum(token: string): number | null {
  token = token.trim();
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const num = Number(token);
  return Number.isFinite(num) ? num : null;
}

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return String(r).replace(/\.?0+$/, "");
}

export function scaleQuantity(qty: string, factor: number): string {
  if (!qty || factor === 1) return qty;
  // match a leading number: mixed, fraction, decimal or integer
  const m = qty.match(/(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/);
  if (!m || m.index === undefined) return qty;
  const value = parseNum(m[0]);
  if (value == null) return qty;
  const scaled = fmt(value * factor);
  return qty.slice(0, m.index) + scaled + qty.slice(m.index + m[0].length);
}
