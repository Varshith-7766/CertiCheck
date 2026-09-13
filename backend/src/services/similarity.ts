// Text similarity for tamper detection (TAMPERED vs UNREGISTERED verdicts).
//
// Design notes:
// - Scores are Levenshtein-based 0-100, same definition as before.
// - Inputs are windowed to COMPARE_WINDOW chars: certificate text beyond the
//   first window rarely moves the 80% verdict threshold, but m*n DP time
//   grows quadratically. Typical docs (< window) score bit-identically.
// - Single-row DP: identical distances to the full (m+1)x(n+1) matrix with
//   O(min(m,n)) memory — no more hundred-MB allocations per comparison.

export const COMPARE_WINDOW = 4000;
const TAMPER_THRESHOLD = 80;

/** Levenshtein distance via single-row DP (identical result, O(n) memory). */
export function levenshteinDistance(a: string, b: string): number {
  let s1 = a;
  let s2 = b;
  if (s1.length < s2.length) [s1, s2] = [s2, s1];
  const m = s1.length;
  const n = s2.length;
  if (n === 0) return m;
  const prev: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    const ca = s1.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j]!;
      prev[j] =
        ca === s2.charCodeAt(j - 1) ? diag : 1 + Math.min(diag, prev[j - 1]!, tmp);
      diag = tmp;
    }
  }
  return prev[n]!;
}

/** Text similarity 0-100% between two strings. */
export function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const wa = a.length > COMPARE_WINDOW ? a.slice(0, COMPARE_WINDOW) : a;
  const wb = b.length > COMPARE_WINDOW ? b.slice(0, COMPARE_WINDOW) : b;
  const maxLen = Math.max(wa.length, wb.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(wa, wb);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

/** True when the score means TAMPERED rather than UNREGISTERED. */
export function isTamperedSimilarity(score: number): boolean {
  return score > TAMPER_THRESHOLD;
}
