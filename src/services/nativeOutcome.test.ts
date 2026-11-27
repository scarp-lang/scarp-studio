import { describe, expect, it } from 'vitest';
import { nativeExitCode, parseNativeOutcome } from './nativeOutcome';

describe('native result metadata boundary', () => {
  it.each([null, -2147483648, 0, 1, 4294967295])('accepts process exit values: %s', code => {
    expect(parseNativeOutcome([code, false, true, false])).toEqual({
      exitCode: code, cancelled: false, outputTruncated: true, sourceStale: false,
    });
  });
  it.each([undefined, [], [0, false, false], [0, false, false, false, 'extra'],
    ['0', false, false, false], [0, 'false', false, false], [0, false, 0, false],
    [0, false, false, null], [1.5, false, false, false], [Infinity, false, false, false],
    [4294967296, false, false, false]])('rejects invalid metadata: %j', value => {
    expect(parseNativeOutcome(value)).toBeNull();
  });
  it('does not coerce an unknown exit status to success', () => {
    for (const value of [undefined, '0', false, {}, NaN, -2147483649]) expect(nativeExitCode(value)).toBeNull();
  });
});
