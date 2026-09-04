/**
 * Safely parses any date string, Unix timestamp (in seconds or ms), or Date object.
 * Returns a valid Date, or a fallback Date (default: 30 days from now).
 * Guaranteed to NEVER throw RangeError: Invalid time value.
 */
export function parseSafeDate(val: any, fallbackMs: number = Date.now() + 30 * 24 * 60 * 60 * 1000): Date {
  if (!val || val === 'null' || val === 'undefined') {
    return new Date(fallbackMs);
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  // Unix timestamp in seconds (Stripe format)
  if (typeof val === 'number' && val > 0 && val < 10000000000) {
    const d = new Date(val * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val === 'string' && /^\d{10}$/.test(val.trim())) {
    const d = new Date(Number(val.trim()) * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d;
  }
  return new Date(fallbackMs);
}

/**
 * Formats a date safely using Intl.DateTimeFormat.
 * Guaranteed never to throw RangeError.
 */
export function formatSafeDate(
  val: any,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  try {
    const d = parseSafeDate(val);
    const loc = locale === 'es' ? 'es-ES' : 'en-US';
    return new Intl.DateTimeFormat(loc, options).format(d);
  } catch (e) {
    console.warn('[dateUtils] Failed to format date:', e);
    const fallback = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return fallback.toLocaleDateString();
  }
}
