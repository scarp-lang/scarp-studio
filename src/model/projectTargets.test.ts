import { describe, expect, it } from 'vitest';
import { preferredProjectDirectory, retainedProjectDirectory, projectTargetForListedSource } from './projectTargets';

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

describe('explicit project targeting from an active listed source', () => {
  const workspaceRoot = { directory: '', path: 'C:/Scarp-Practice' };
  const tuples = { directory: 'basic_tuple', path: 'C:/Scarp-Practice/basic_tuple' };
  const examples = {
    directory: 'basic_tuple/examples',
    path: 'C:/Scarp-Practice/basic_tuple/examples',
  };
  const loops = { directory: 'loops', path: 'C:/Scarp-Practice/loops' };
  const listed = [
    { name: 'main.srp', path: 'C:/Scarp-Practice/main.srp' },
    { name: 'basic_tuple/main.srp', path: 'C:/Scarp-Practice/basic_tuple/main.srp' },
    {
      name: 'basic_tuple/examples/tuple.srp',
      path: 'C:/Scarp-Practice/basic_tuple/examples/tuple.srp',
    },
    { name: 'loops/main.srp', path: 'C:/Scarp-Practice/loops/main.srp' },
    { name: 'loops-old/main.srp', path: 'C:/Scarp-Practice/loops-old/main.srp' },
  ];
  it('requires an exact listed source rather than a guessed or arbitrary disk path', () => {
    expect(projectTargetForListedSource(null, listed, [tuples])).toBeNull();
    expect(projectTargetForListedSource('C:/Scarp-Practice/private.srp', listed, [tuples])).toBeNull();
    expect(projectTargetForListedSource('C:/Scarp-Practice/basic_tuple/main.txt', listed, [tuples]))
      .toBeNull();
  });
  it('selects nested project from Windows aliases, without selecting sibling projects', () => {
    expect(projectTargetForListedSource(
      'c:/SCARP-PRACTICE/BASIC_TUPLE/MAIN.SRP', listed, [tuples, loops],
    )).toBe('basic_tuple');
    expect(projectTargetForListedSource(
      'C:/Scarp-Practice/loops/main.srp', listed, [tuples, loops],
    )).toBe('loops');
    expect(projectTargetForListedSource(
      'C:/Scarp-Practice/loops-old/main.srp', listed, [loops],
    )).toBeNull();
  });
  it('chooses the nearest manifest root and allows a root-level project', () => {
    expect(projectTargetForListedSource(
      'C:/Scarp-Practice/basic_tuple/examples/tuple.srp',
      listed, [workspaceRoot, tuples, examples],
    )).toBe('basic_tuple/examples');
    expect(projectTargetForListedSource(
      'C:/Scarp-Practice/basic_tuple/main.srp', listed, [workspaceRoot, tuples, examples],
    )).toBe('basic_tuple');
    expect(projectTargetForListedSource(
      'C:/Scarp-Practice/main.srp', listed, [workspaceRoot, tuples],
    )).toBe('');
  });
  it('rejects forged relative paths even when their absolute path matches a listed source', () => {
    expect(projectTargetForListedSource(
      'C:/Scarp-Practice/basic_tuple/main.srp',
      [{ name: 'basic_tuple/../main.srp', path: 'C:/Scarp-Practice/basic_tuple/main.srp' }],
      [tuples],
    )).toBeNull();
  });
});
