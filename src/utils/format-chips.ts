// Display mode for chip/BB amounts
export type DisplayMode = 'chips' | 'bb';

const STORAGE_KEY = 'holdem-sng-display-mode';

/**
 * Load persisted display mode from localStorage.
 * Falls back to 'chips' if not set or invalid.
 */
export function loadDisplayMode(): DisplayMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'bb' || stored === 'chips') return stored;
  } catch {
    // localStorage may be unavailable in SSR/test environments
  }
  return 'chips';
}

/**
 * Persist display mode to localStorage.
 */
export function saveDisplayMode(mode: DisplayMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

/**
 * Format a chip amount for display.
 *
 * - In 'chips' mode: returns locale-formatted integer (e.g. "1,500")
 * - In 'bb' mode: returns BB units rounded to 1 decimal when fractional
 *   (e.g. "2 BB", "2.5 BB")
 *
 * Handles zero and edge cases gracefully.
 */
export function formatAmount(amount: number, bb: number, mode: DisplayMode): string {
  if (mode === 'bb' && bb > 0) {
    const bbAmount = amount / bb;
    return bbAmount % 1 === 0 ? `${bbAmount} BB` : `${bbAmount.toFixed(1)} BB`;
  }
  return amount.toLocaleString();
}

/**
 * Convert a BB amount back to chips (rounded to integer).
 */
export function bbToChips(bbAmount: number, bb: number): number {
  return Math.round(bbAmount * bb);
}

/**
 * Convert chips to BB units.
 */
export function chipsToBB(chips: number, bb: number): number {
  return chips / bb;
}
