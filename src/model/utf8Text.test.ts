import { describe, expect, it, vi } from 'vitest';
import { assertWellFormedUtf16, unicodeSafePreviewBounds, utf8ByteLength } from './utf8Text';

describe('lossless UTF-8 boundary preflight', () => {
  it('accepts empty, ASCII, Hindi, CJK and paired supplementary Unicode', () => {
    for (const text of ['', 'source', 'नमस्ते', '漢字', '😀', 'A\uD83D\uDE03B']) {
      expect(() => assertWellFormedUtf16(text, 'Scarp source')).not.toThrow();
    }
  });

  it('rejects leading and trailing isolated high surrogates', () => {
    for (const text of ['\uD800', 'A\uD800', '\uD83Dabc']) {
      expect(() => assertWellFormedUtf16(text, 'Scarp source'))
        .toThrow(/Scarp source.*unpaired UTF-16 surrogate/);
    }
  });

  it('rejects isolated low surrogates and malformed pairs', () => {
    for (const text of ['\uDC00', '\uDE03A', '\uD83D\uD83D\uDE03', '\uD83D\u0041']) {
      expect(() => assertWellFormedUtf16(text, 'Program input'))
        .toThrow(/Program input.*unpaired UTF-16 surrogate/);
    }
  });

  it('accepts adjacent complete pairs without confusing their boundaries', () => {
    expect(() => assertWellFormedUtf16('😀🙂👋\r\nसमाप्त', 'Program input')).not.toThrow();
  });
});

describe('allocation-free UTF-8 size calculation', () => {
  it('matches TextEncoder for valid and malformed UTF-16, including big input', () => {
    const examples = [
      '', 'ASCII\r\n', '\u0000', 'é', 'नमस्ते 👋', '漢字', 'e\u0301',
      '😃😀🙂', '\ud800', '\udc00', '\ud800x', 'x\udc00', '😀\ud800',
      '\ud800\ud800\udc00', 'a'.repeat(20000), 'न'.repeat(8000),
    ];
    for (const input of examples) {
      expect(utf8ByteLength(input)).toBe(new TextEncoder().encode(input).byteLength);
    }
  });

  it('does not allocate a UTF-8 byte buffer even for a large input preview', () => {
    const encode = vi.spyOn(TextEncoder.prototype, 'encode')
      .mockImplementation(() => { throw new Error('unexpected encoding'); });
    try {
      expect(utf8ByteLength('😀'.repeat(9000))).toBe(36000);
      expect(encode).not.toHaveBeenCalled();
    } finally {
      encode.mockRestore();
    }
  });
});

describe('bounded Unicode-safe preview boundaries', () => {
  it('preserves complete supplementary scalars when both ends cut pairs', () => {
    const source = '😀' + 'a'.repeat(7) + '😀';
    const bounds = unicodeSafePreviewBounds(source, 1, 10);
    expect(bounds).toEqual({ start: 0, end: 11 });
    expect(source.slice(bounds.start, bounds.end)).toBe(source);
  });

  it('preserves exact ranges that are already codepoint-aligned', () => {
    const source = 'A😀B';
    expect(unicodeSafePreviewBounds(source, 1, 3))
      .toEqual({ start: 1, end: 3 });
    expect(unicodeSafePreviewBounds(source, 0, source.length))
      .toEqual({ start: 0, end: source.length });
  });
});
