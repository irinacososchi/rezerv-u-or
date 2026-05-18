/**
 * Shared time-slot helpers.
 *
 * Everywhere in the app, a "slot start" is represented as a "HH:MM" string
 * (24h, zero-padded). Database `time` columns come back as "HH:MM:SS" — those
 * should be normalized with {@link slotFromTime} before any comparison.
 *
 * Phase 1 keeps the slot granularity at 60 min (so behavior is identical to
 * the old whole-hour code). Phase 2 will flip {@link SLOT_GRANULARITY_MINUTES}
 * to 30 to enable half-hour bookings.
 */

/** Slot granularity in minutes. Phase 2 will change this to 30. */
export const SLOT_GRANULARITY_MINUTES = 30;

/**
 * Normalize a "HH:MM:SS" or "HH:MM" time string to the canonical "HH:MM" slot key.
 * Does NOT round to the slot granularity — caller is responsible for that.
 */
export function slotFromTime(t: string): string {
  return t.slice(0, 5);
}

/** Convert "HH:MM" or "HH:MM:SS" to minutes from midnight (0..1439). */
export function timeToMinutes(t: string): number {
  const h = parseInt(t.slice(0, 2), 10);
  const m = parseInt(t.slice(3, 5), 10);
  return h * 60 + m;
}

/** Convert minutes from midnight to "HH:MM". */
export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

/**
 * Returns true if the half-open intervals [aStart, aEnd) and [bStart, bEnd)
 * overlap. All args are "HH:MM" (or "HH:MM:SS"; only the HH:MM part is used).
 */
export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && ae > bs;
}

/** Duration in minutes between two "HH:MM" strings (end - start). */
export function slotDurationMinutes(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

// ---------- Dev-only self-tests (run once on import in dev mode) ----------
if (import.meta.env?.DEV) {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) console.error(`[time-slots] self-test failed: ${msg}`);
  };
  assert(slotFromTime("09:30:00") === "09:30", 'slotFromTime("09:30:00")');
  assert(slotFromTime("09:30") === "09:30", 'slotFromTime("09:30")');
  assert(timeToMinutes("09:30") === 570, "timeToMinutes(09:30)");
  assert(timeToMinutes("09:30:00") === 570, "timeToMinutes(09:30:00)");
  assert(minutesToTime(570) === "09:30", "minutesToTime(570)");
  assert(
    intervalsOverlap("09:00", "10:00", "09:30", "10:30") === true,
    "overlap true",
  );
  assert(
    intervalsOverlap("09:00", "10:00", "10:00", "11:00") === false,
    "overlap edge false",
  );
  assert(slotDurationMinutes("09:00", "10:30") === 90, "duration 90");
}
