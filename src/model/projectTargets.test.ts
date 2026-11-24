import { describe, expect, it } from 'vitest';
import { preferredProjectDirectory, retainedProjectDirectory } from './projectTargets';

const root = { directory: '', path: 'C:/Scarp-Practice' };
const tuples = { directory: 'basic_tuple', path: 'C:/Scarp-Practice/basic_tuple' };
const loops = { directory: 'loops', path: 'C:/Scarp-Practice/loops' };

describe('Scarp workspace manifest target selection', () => {
  it('honors an explicit manifest at the selected workspace root', () => {
    expect(preferredProjectDirectory([root])).toBe('');
    expect(preferredProjectDirectory([root, tuples])).toBe('');
  });

  it('automatically selects a unique nested Scarp project, not a manifest-less parent', () => {
    expect(preferredProjectDirectory([tuples])).toBe('basic_tuple');
    expect(preferredProjectDirectory([loops])).toBe('loops');
  });

  it('requires the user to choose when multiple nested projects exist', () => {
    expect(preferredProjectDirectory([])).toBe('');
    expect(preferredProjectDirectory([tuples, loops])).toBe('');
    expect(preferredProjectDirectory([loops, tuples])).toBe('');
  });

  it('preserves selected project across successful refresh and reverts removed project', () => {
    expect(retainedProjectDirectory('basic_tuple', [tuples, loops])).toBe('basic_tuple');
    expect(retainedProjectDirectory('basic_tuple', [loops])).toBe('loops');
    expect(retainedProjectDirectory('basic_tuple', [root, loops])).toBe('');
    expect(retainedProjectDirectory('basic_tuple', [])).toBe('');
    expect(retainedProjectDirectory('', [tuples])).toBe('');
  });
});
