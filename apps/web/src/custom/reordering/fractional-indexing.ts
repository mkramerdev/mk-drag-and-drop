/**
 * Fractional Indexing - String-based Order Keys
 *
 * Generates lexicographically sortable string keys that can always be
 * subdivided. Inserting between any two keys produces a new key without
 * touching existing items.
 *
 * Based on the approach described at:
 * https://observablehq.com/@dgreensp/implementing-fractional-indexing
 *
 * Uses base-62 digits (0-9, A-Z, a-z) in ascending character code order.
 *
 * @packageDocumentation
 */

export const BASE_62_DIGITS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export interface FractionalIndexingInstrumentationEvent {
  readonly name: 'generateKeyBetween';
  readonly a: string | null | undefined;
  readonly b: string | null | undefined;
  readonly invalidBounds: boolean;
  readonly threw: boolean;
  readonly durationMs: number;
}

interface FractionalIndexingInstrumentationGlobal {
  __EDITOR_FRACTIONAL_INDEXING_INSTRUMENTATION__?: {
    record(event: FractionalIndexingInstrumentationEvent): void;
  };
}

function readNow(): number {
  const globalPerformance = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof globalPerformance?.now === 'function'
    ? globalPerformance.now()
    : Date.now();
}

function recordFractionalIndexingEvent(event: FractionalIndexingInstrumentationEvent): void {
  (globalThis as FractionalIndexingInstrumentationGlobal).__EDITOR_FRACTIONAL_INDEXING_INSTRUMENTATION__?.record(event);
}

/**
 * Compute a string midpoint between `a` and `b`.
 * `a` may be empty string, `b` is null or non-empty string.
 * `a < b` lexicographically if `b` is non-null.
 * No trailing zeros allowed.
 */
function midpoint(a: string, b: string | null, digits: string): string {
  const zero = digits[0]!;
  if (b != null && a >= b) {
    throw new Error(a + ' >= ' + b);
  }
  if (a.slice(-1) === zero || (b && b.slice(-1) === zero)) {
    throw new Error('trailing zero');
  }
  if (b) {
    let n = 0;
    while ((a[n] || zero) === b[n]) {
      n++;
    }
    if (n > 0) {
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n), digits);
    }
  }
  const digitA = a ? digits.indexOf(a[0]!) : 0;
  const digitB = b != null ? digits.indexOf(b[0]!) : digits.length;
  if (digitB - digitA > 1) {
    const midDigit = Math.round(0.5 * (digitA + digitB));
    return digits[midDigit]!;
  } else {
    if (b && b.length > 1) {
      return b.slice(0, 1);
    } else {
      return digits[digitA]! + midpoint(a.slice(1), null, digits);
    }
  }
}

function validateInteger(int: string): void {
  if (int.length !== getIntegerLength(int[0]!)) {
    throw new Error('invalid integer part of order key: ' + int);
  }
}

function getIntegerLength(head: string): number {
  if (head >= 'a' && head <= 'z') {
    return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
  } else if (head >= 'A' && head <= 'Z') {
    return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
  } else {
    throw new Error('invalid order key head: ' + head);
  }
}

function getIntegerPart(key: string): string {
  const integerPartLength = getIntegerLength(key[0]!);
  if (integerPartLength > key.length) {
    throw new Error('invalid order key: ' + key);
  }
  return key.slice(0, integerPartLength);
}

export function validateOrderKey(key: string, digits: string = BASE_62_DIGITS): void {
  if (key === 'A' + digits[0]!.repeat(26)) {
    throw new Error('invalid order key: ' + key);
  }
  const i = getIntegerPart(key);
  const f = key.slice(i.length);
  if (f.slice(-1) === digits[0]) {
    throw new Error('invalid order key: ' + key);
  }
}

function incrementInteger(x: string, digits: string): string | null {
  validateInteger(x);
  const [head, ...digs] = x.split('');
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i--) {
    const d = digits.indexOf(digs[i]!) + 1;
    if (d === digits.length) {
      digs[i] = digits[0]!;
    } else {
      digs[i] = digits[d]!;
      carry = false;
    }
  }
  if (carry) {
    if (head === 'Z') {
      return 'a' + digits[0];
    }
    if (head === 'z') {
      return null;
    }
    const h = String.fromCharCode(head!.charCodeAt(0) + 1);
    if (h > 'a') {
      digs.push(digits[0]!);
    } else {
      digs.pop();
    }
    return h + digs.join('');
  } else {
    return head + digs.join('');
  }
}

function decrementInteger(x: string, digits: string): string | null {
  validateInteger(x);
  const [head, ...digs] = x.split('');
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i--) {
    const d = digits.indexOf(digs[i]!) - 1;
    if (d === -1) {
      digs[i] = digits.slice(-1);
    } else {
      digs[i] = digits[d]!;
      borrow = false;
    }
  }
  if (borrow) {
    if (head === 'a') {
      return 'Z' + digits.slice(-1);
    }
    if (head === 'A') {
      return null;
    }
    const h = String.fromCharCode(head!.charCodeAt(0) - 1);
    if (h < 'Z') {
      digs.push(digits.slice(-1));
    } else {
      digs.pop();
    }
    return h + digs.join('');
  } else {
    return head + digs.join('');
  }
}

/**
 * Generate an order key between `a` and `b`.
 *
 * - `a` is an order key or null (start of list).
 * - `b` is an order key or null (end of list).
 * - `a < b` lexicographically if both are non-null.
 *
 * Always returns a valid key that sorts between `a` and `b` without
 * touching any existing keys.
 */
export function generateKeyBetween(
  a: string | null | undefined,
  b: string | null | undefined,
): string {
  const startedAt = readNow();
  let threw = true;
  try {
    const result = generateKeyBetweenUnchecked(a, b);
    threw = false;
    return result;
  } finally {
    recordFractionalIndexingEvent({
      name: 'generateKeyBetween',
      a,
      b,
      invalidBounds: a != null && b != null && a >= b,
      threw,
      durationMs: readNow() - startedAt,
    });
  }
}

function generateKeyBetweenUnchecked(
  a: string | null | undefined,
  b: string | null | undefined,
): string {
  const digits = BASE_62_DIGITS;
  if (a != null) {
    validateOrderKey(a, digits);
  }
  if (b != null) {
    validateOrderKey(b, digits);
  }
  if (a != null && b != null && a >= b) {
    throw new Error(a + ' >= ' + b);
  }
  if (a == null) {
    if (b == null) {
      return 'a' + digits[0];
    }
    const ib = getIntegerPart(b);
    const fb = b.slice(ib.length);
    if (ib === 'A' + digits[0]!.repeat(26)) {
      return ib + midpoint('', fb, digits);
    }
    if (ib < b) {
      return ib;
    }
    const res = decrementInteger(ib, digits);
    if (res == null) {
      throw new Error('cannot decrement any more');
    }
    return res;
  }

  if (b == null) {
    const ia = getIntegerPart(a);
    const fa = a.slice(ia.length);
    const i = incrementInteger(ia, digits);
    return i == null ? ia + midpoint(fa, null, digits) : i;
  }

  const ia = getIntegerPart(a);
  const fa = a.slice(ia.length);
  const ib = getIntegerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) {
    return ia + midpoint(fa, fb, digits);
  }
  const i = incrementInteger(ia, digits);
  if (i == null) {
    throw new Error('cannot increment any more');
  }
  if (i < b) {
    return i;
  }
  return ia + midpoint(fa, null, digits);
}

/**
 * Generate `n` distinct keys in sorted order between `a` and `b`.
 */
export function generateNKeysBetween(
  a: string | null | undefined,
  b: string | null | undefined,
  n: number,
): string[] {
  if (n === 0) return [];
  if (n === 1) return [generateKeyBetween(a, b)];
  if (b == null) {
    let c = generateKeyBetween(a, b);
    const result = [c];
    for (let i = 0; i < n - 1; i++) {
      c = generateKeyBetween(c, b);
      result.push(c);
    }
    return result;
  }
  if (a == null) {
    let c = generateKeyBetween(a, b);
    const result = [c];
    for (let i = 0; i < n - 1; i++) {
      c = generateKeyBetween(a, c);
      result.push(c);
    }
    result.reverse();
    return result;
  }
  const mid = Math.floor(n / 2);
  const c = generateKeyBetween(a, b);
  return [
    ...generateNKeysBetween(a, c, mid),
    c,
    ...generateNKeysBetween(c, b, n - mid - 1),
  ];
}
