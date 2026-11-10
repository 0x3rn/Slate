// Pure helpers for number inputs that let the user type freely.
// Clamping on every keystroke breaks typing (e.g. "3" snaps to the minimum and the
// next digits get appended to it), so the field keeps a text draft and only commits
// values that are already valid, then clamps once on blur/Enter.

/** Returns the draft as a number if it is finite and inside [min, max], else null. */
export function parseNumericDraft(draft: string, min: number, max: number): number | null {
  const trimmed = draft.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** Final value when editing ends: clamps into range, falls back when the draft is not a number. */
export function resolveNumericDraft(
  draft: string,
  min: number,
  max: number,
  fallback: number
): number {
  const trimmed = draft.trim();
  const n = trimmed === "" ? NaN : Number(trimmed);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
