const MASK = 0xFFFFFFFFFFFFFFFFn;

/**
 * xoshiro256** state: 4 × uint64 BigInt values.
 */
export interface PrngState {
  s: [bigint, bigint, bigint, bigint];
}

/**
 * Initialize PRNG state from a seed string using SHA-256.
 * SHA-256(UTF-8(seed)) → 32 bytes → 4 × uint64 BigInt.
 */
export async function seedFromString(seed: string): Promise<PrngState> {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  return bytesToState(bytes);
}

/**
 * Generate a random seed string using crypto.getRandomValues().
 */
export function generateRandomSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert 32 bytes into 4 × uint64 state values (little-endian).
 */
function bytesToState(bytes: Uint8Array): PrngState {
  const s: [bigint, bigint, bigint, bigint] = [0n, 0n, 0n, 0n];
  for (let i = 0; i < 4; i++) {
    let value = 0n;
    for (let j = 0; j < 8; j++) {
      value |= BigInt(bytes[i * 8 + j]!) << BigInt(j * 8);
    }
    s[i] = value & MASK;
  }
  // Ensure state is not all-zero (degenerate case)
  if (s[0] === 0n && s[1] === 0n && s[2] === 0n && s[3] === 0n) {
    s[0] = 1n;
  }
  return { s };
}

/**
 * Rotate left for uint64.
 */
function rotl(x: bigint, k: number): bigint {
  return ((x << BigInt(k)) | (x >> BigInt(64 - k))) & MASK;
}

/**
 * Generate the next uint64 value using xoshiro256**.
 * Mutates the state in place.
 */
export function nextUint64(state: PrngState): bigint {
  const s = state.s;
  // result = rotl(s[1] * 5, 7) * 9
  const result = (rotl((s[1] * 5n) & MASK, 7) * 9n) & MASK;

  const t = (s[1] << 17n) & MASK;

  s[2] ^= s[0];
  s[3] ^= s[1];
  s[1] ^= s[2];
  s[0] ^= s[3];

  s[2] ^= t;
  s[3] = rotl(s[3], 45);

  return result;
}

/**
 * Generate a float in [0, 1) from the next PRNG value.
 * Number(next() >> 11n) / 2**53
 */
export function nextFloat(state: PrngState): number {
  const value = nextUint64(state);
  return Number(value >> 11n) / (2 ** 53);
}

/**
 * Generate a random integer in [0, max) (exclusive).
 */
export function nextInt(state: PrngState, max: number): number {
  return Math.floor(nextFloat(state) * max);
}

/**
 * Clone the PRNG state (for snapshotting).
 */
export function cloneState(state: PrngState): PrngState {
  return { s: [...state.s] };
}
