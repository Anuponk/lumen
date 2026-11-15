// PostgreSQL jsonb text output, reproduced for a value parsed from JSON, so the
// client can send a SHA-256 of its expected cloud profile instead of the whole
// profile. Rules (jsonb out): object keys ordered by byte length then bytes,
// "key": value with ", " separators, arrays "[a, b]", strings escaped like
// JSON.stringify, numbers in plain (non-exponent) notation.
// Any difference only makes the digest unequal: the caller then falls back to
// the full compare-and-swap, so a mismatch can never accept a stale write.
const encoder = new TextEncoder();

function compareKeys(a, b) {
  const x = encoder.encode(a),
    y = encoder.encode(b);
  if (x.length !== y.length) return x.length - y.length;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// JSON.stringify may use an exponent (1e+21, 1e-7); jsonb prints numeric
// without one. Returns null when the number cannot be represented exactly.
export function jsonbNumber(value) {
  if (!Number.isFinite(value)) return null;
  const text = JSON.stringify(value);
  if (!/[eE]/.test(text)) return text === '-0' ? '0' : text;
  const negative = text.startsWith('-'),
    [coefficient, exponentText] = (negative ? text.slice(1) : text).toLowerCase().split('e');
  const exponent = Number(exponentText),
    [whole, fraction = ''] = coefficient.split('.'),
    digits = whole + fraction,
    point = whole.length + exponent;
  let out;
  if (point <= 0) out = '0.' + '0'.repeat(-point) + digits;
  else if (point >= digits.length) out = digits + '0'.repeat(point - digits.length);
  else out = digits.slice(0, point) + '.' + digits.slice(point);
  return (negative ? '-' : '') + out;
}

export function jsonbText(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    const number = jsonbNumber(value);
    if (number === null) throw Error('Unsupported jsonb number');
    return number;
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(jsonbText).join(', ') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined);
    // jsonb keeps the last duplicate key; plain objects cannot hold duplicates.
    return '{' + keys.sort(compareKeys).map((key) => JSON.stringify(key) + ': ' + jsonbText(value[key])).join(', ') + '}';
  }
  throw Error('Unsupported jsonb value');
}

export async function jsonbDigest(value, subtle = globalThis.crypto?.subtle) {
  if (!subtle) return null;
  const bytes = await subtle.digest('SHA-256', encoder.encode(jsonbText(value)));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
