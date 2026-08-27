/**
 * Streaming text helpers.
 *
 * A latin1↔utf8 re-decode is a valid repair ONLY when the upstream genuinely
 * handed us UTF-8 bytes that some HTTP layer re-decoded as Latin-1 (mojibake).
 * Applying it unconditionally is destructive: a string that is already correct
 * UTF-8 (a real "·" = U+00B7, "é" = U+00E9, …) gets turned into "�" because a
 * lone high byte is not valid UTF-8. So we only accept the repair when it
 * actually produces clean UTF-8, and otherwise return the input unchanged.
 */
export function fixMojibake(s: string): string {
  if (!s) return s;
  // Fast path: nothing outside ASCII → nothing to repair.
  let hasHigh = false;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    // A latin1 rendering of UTF-8 bytes only uses code points ≤ 0xFF. If ANY
    // code point is > 0xFF the string already carries genuine Unicode (a real
    // "—", "•", emoji, …) — re-decoding as latin1 would corrupt it, so bail.
    if (cp > 0xff) return s;
    if (cp >= 0x80) hasHigh = true;
  }
  if (!hasHigh) return s;
  try {
    const repaired = Buffer.from(s, 'latin1').toString('utf8');
    // Genuine mojibake re-decodes to clean UTF-8. If the re-decode instead
    // introduces U+FFFD, the input was ALREADY valid UTF-8 (e.g. a lone
    // 0xB7 "·") and we'd be the ones corrupting it — keep the original.
    // (This is the guard the old unconditional version lacked, which turned
    // every "·"/"é" delta into "�".)
    if (repaired.indexOf('�') !== -1) return s;
    return repaired;
  } catch {
    return s;
  }
}
