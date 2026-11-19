import { describe, expect, it } from 'vitest';
import {
  assertScarpSourceBytes, assertScarpSourceText, MAX_SCARP_SOURCE_BYTES,
} from './sourceLimits';

describe('Scarp source validation at the UTF-8 boundary', () => {
  it('accepts a valid multilingual source exactly as authored', () => {
    expect(() => assertScarpSourceText('print("नमस्ते 😀");\r\n')).not.toThrow();
  });

  it('rejects malformed surrogate source text before native Save or Replace', () => {
    expect(() => assertScarpSourceText('print("\uD800");')).toThrow(/unpaired UTF-16 surrogate/);
    expect(() => assertScarpSourceText('print("\uDC00");')).toThrow(/unpaired UTF-16 surrogate/);
  });

  it('counts UTF-8 bytes, including supplementary Unicode, not UTF-16 units', () => {
    expect(() => assertScarpSourceText('😀'.repeat(MAX_SCARP_SOURCE_BYTES / 4))).not.toThrow();
    expect(() => assertScarpSourceText('😀'.repeat(MAX_SCARP_SOURCE_BYTES / 4 + 1))).toThrow(/4 MiB/);
  });

  it('rejects nonsensical byte counts', () => {
    for (const size of [-1, 1.5, NaN, Infinity, MAX_SCARP_SOURCE_BYTES + 1]) {
      expect(() => assertScarpSourceBytes(size)).toThrow(/4 MiB/);
    }
  });
});
