import { describe, expect, it } from 'vitest';
import { preferredProjectDirectory, retainedProjectDirectory, projectTargetForListedSource, selectedManifestPath } from './projectTargets';

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
    expect(preferredProjectDirectory([])).toBeNull();
    expect(preferredProjectDirectory([tuples, loops])).toBeNull();
    expect(preferredProjectDirectory([loops, tuples])).toBeNull();
  });

  it('preserves only the selected project across refresh', () => {
    expect(retainedProjectDirectory('basic_tuple', [tuples, loops])).toBe('basic_tuple');
    expect(retainedProjectDirectory('', [root, loops])).toBe('');
    expect(retainedProjectDirectory('loops', [root, loops])).toBe('loops');
  });

  it('never redirects a removed project to the root or another child', () => {
    expect(retainedProjectDirectory('basic_tuple', [loops])).toBeNull();
    expect(retainedProjectDirectory('basic_tuple', [root, loops])).toBeNull();
    expect(retainedProjectDirectory('basic_tuple', [])).toBeNull();
    expect(retainedProjectDirectory('', [tuples])).toBeNull();
  });

  it('does not silently reselect a project on successive refreshes', () => {
    let target = retainedProjectDirectory('basic_tuple', [loops]);
    expect(target).toBeNull();
    target = retainedProjectDirectory(target, [tuples]);
    expect(target).toBeNull();
    target = retainedProjectDirectory(target, [root]);
    expect(target).toBeNull();
  });

  it('keeps an unselected workspace distinct from a real root manifest', () => {
    expect(selectedManifestPath(null, [root, tuples])).toBeNull();
    expect(selectedManifestPath('', [root, tuples])).toBe(root.path);
    expect(selectedManifestPath('', [tuples])).toBeNull();
    expect(selectedManifestPath('basic_tuple', [root, tuples])).toBe(tuples.path);
    expect(selectedManifestPath('loops', [root, tuples])).toBeNull();
  });

  it('does not restore a stale target when the manifest disappears from a partial listing', () => {
    const target = retainedProjectDirectory('basic_tuple', []);
    expect(selectedManifestPath(target, [tuples, loops])).toBeNull();
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
