/** Machine-readable outcome from Studio's native backend, never inferred
 * from user-controlled program output. Older bridge versions may omit it. */
export interface NativeOutcome {
  readonly exitCode: number | null;
  readonly cancelled: boolean;
  readonly outputTruncated: boolean;
  readonly sourceStale: boolean;
}

export function nativeExitCode(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= -2147483648 && value <= 4294967295 ? value : null;
}

/** The Rust bridge returns a fixed four-element tuple. Reject malformed
 * payloads wholesale, rather than trusting an isolated exit-zero field. */
export function parseNativeOutcome(value: unknown): NativeOutcome | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const [code, cancelled, truncated, stale] = value;
  if ((code !== null && nativeExitCode(code) === null) ||
      typeof cancelled !== 'boolean' || typeof truncated !== 'boolean' ||
      typeof stale !== 'boolean') return null;
  return Object.freeze({ exitCode: code, cancelled, outputTruncated: truncated, sourceStale: stale });
}
