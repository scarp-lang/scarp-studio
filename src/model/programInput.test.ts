import { describe, expect, it } from 'vitest';
import {
  MAX_INPUT_BYTES, MAX_INPUT_LINE_BYTES, MAX_INPUT_LINES,
  programInputBytes, validateProgramInput,
} from './programInput';

describe('bounded explicit Scarp program input', () => {
  it('accepts empty, LF, CRLF, Unicode and final unterminated lines unchanged', () => {
    for (const input of ['', 'Ada\n', 'नमस्ते 👋\r\nnext', 'last line']) {
      expect(() => validateProgramInput(input)).not.toThrow();
    }
    expect(programInputBytes('👋')).toBe(4);
  });
  it('counts UTF-8 bytes rather than JavaScript UTF-16 units', () => {
    expect(() => validateProgramInput('👋'.repeat(MAX_INPUT_LINE_BYTES / 4))).not.toThrow();
    expect(() => validateProgramInput('👋'.repeat(MAX_INPUT_LINE_BYTES / 4 + 1)))
      .toThrow('4096');
  });
  it('enforces a total 16 KiB budget even when each line is short', () => {
    expect(() => validateProgramInput('a\n'.repeat(MAX_INPUT_BYTES / 2))).toThrow('256 lines');
    expect(() => validateProgramInput('a'.repeat(4000) + '\n'.repeat(13000))).toThrow('16 KiB');
  });
  it('accepts exactly 256 lines and rejects 257 lines', () => {
    expect(() => validateProgramInput('a\n'.repeat(MAX_INPUT_LINES))).not.toThrow();
    expect(() => validateProgramInput('a\n'.repeat(MAX_INPUT_LINES + 1))).toThrow('256 lines');
  });
  it('counts CRLF terminators inside the per-line byte budget', () => {
    expect(() => validateProgramInput('a'.repeat(MAX_INPUT_LINE_BYTES - 2) + '\r\n')).not.toThrow();
    expect(() => validateProgramInput('a'.repeat(MAX_INPUT_LINE_BYTES - 1) + '\r\n')).toThrow('4096');
  });
});
