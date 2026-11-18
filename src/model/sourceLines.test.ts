import { describe, expect, it } from 'vitest';
import { lineBreakWidth, nextLineBreak, sourceLineAt } from './sourceLines';

describe('Monaco-compatible source line boundaries', () => {
  it('recognizes lone CR, lone LF and CRLF without merging independent lines', () => {
    const text = 'one\rtwo\r\nthree\nfour';
    expect(Array.from({ length: 4 }, (_, index) => sourceLineAt(text, index + 1)))
      .toEqual(['one', 'two', 'three', 'four']);
    expect(sourceLineAt(text, 5)).toBeNull();
    expect(nextLineBreak(text, 0)).toBe(3);
    expect(lineBreakWidth(text, 3)).toBe(1);
    expect(nextLineBreak(text, 4)).toBe(7);
    expect(lineBreakWidth(text, 7)).toBe(2);
  });

  it('preserves empty lines created by consecutive or terminal separators', () => {
    expect(Array.from({ length: 5 }, (_, index) =>
      sourceLineAt('\r\n\rX\n', index + 1),
    )).toEqual(['', '', 'X', '', null]);
    expect(sourceLineAt('', 1)).toBe('');
    expect(sourceLineAt('', 2)).toBeNull();
  });

  it('preserves UTF-16 text without changing emoji and Hindi source', () => {
    const text = '😀 हिन्दी\rनया\nठीक\r\n';
    expect(sourceLineAt(text, 1)).toBe('😀 हिन्दी');
    expect(sourceLineAt(text, 2)).toBe('नया');
    expect(sourceLineAt(text, 3)).toBe('ठीक');
    expect(sourceLineAt(text, 4)).toBe('');
  });

  it('rejects malformed or impossible source line numbers', () => {
    for (const line of [0, -2, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(sourceLineAt('first\nsecond', line)).toBeNull();
    }
  });
});
