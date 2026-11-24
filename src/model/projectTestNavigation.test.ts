import { describe, expect, it } from 'vitest';
import { resolveListedTestSource, isSelectedProjectTestReport, type TestSourceListing } from './projectTestNavigation';

const current: TestSourceListing = {
  path: 'C:/Scarp/Project',
  files: [
    { name: 'tests/green.srp', path: 'C:/Scarp/Project/tests/green.srp' },
    { name: 'tests/लाल.srp', path: 'C:/Scarp/Project/tests/लाल.srp' },
    { name: 'src/main.srp', path: 'C:/Scarp/Project/src/main.srp' },
  ],
};

describe('project test report → current Explorer source navigation', () => {
  it('uses listed paths without ever constructing one from compiler output', () => {
    expect(resolveListedTestSource('tests/green.srp', 'c:\\scarp\\project', current))
      .toBe('C:/Scarp/Project/tests/green.srp');
    expect(resolveListedTestSource('tests/लाल.srp', current.path, current))
      .toBe('C:/Scarp/Project/tests/लाल.srp');
  });

  it('resolves a listed UNC project under slash/backslash spelling changes only', () => {
    const network = {
      path: String.raw`\\server\share\Scarp`,
      files: [{ name: 'tests/green.srp',
        path: String.raw`\\server\share\Scarp\tests\green.srp` }],
    };
    expect(resolveListedTestSource('tests/green.srp',
      '//SERVER/SHARE/scarp', network)).toBe(network.files[0].path);
    expect(resolveListedTestSource('tests/green.srp',
      '//SERVER/another/scarp', network)).toBeNull();
  });

  it('refuses unlisted or removed project test sources', () => {
    expect(resolveListedTestSource('tests/new.srp', current.path, current)).toBeNull();
    expect(resolveListedTestSource('tests/green.srp', current.path,
      { ...current, files: current.files.slice(1) })).toBeNull();
  });

  it('rejects selection changes and absent folder listings', () => {
    expect(resolveListedTestSource('tests/green.srp', current.path, null)).toBeNull();
    expect(resolveListedTestSource('tests/green.srp', current.path,
      { ...current, path: 'C:/Scarp/Another' })).toBeNull();
    expect(resolveListedTestSource('tests/green.srp', 'C:/Scarp/Another', current))
      .toBeNull();
  });

  it('rejects traversal, nested tests, non-test paths and separators', () => {
    const forged: TestSourceListing = {
      ...current,
      files: [...current.files,
        { name: 'tests/../secret.srp', path: 'C:/secret.srp' },
        { name: 'tests/nested/x.srp', path: 'C:/other/x.srp' },
      ],
    };
    for (const name of [
      'tests/../secret.srp', 'tests/nested/x.srp', 'tests\\green.srp',
      '../secret.srp', 'src/main.srp', 'tests/C:secret.srp',
      'tests//evil.srp', 'tests/.srp',
    ]) {
      expect(resolveListedTestSource(name, current.path, forged)).toBeNull();
    }
  });

  it('does not invent case-insensitive aliases for compiler report names', () => {
    expect(resolveListedTestSource('tests/GREEN.srp', current.path, current)).toBeNull();
  });
});


describe('project test navigation in a multi-project Scarp workspace', () => {
  const nested = {
    path: 'C:/Scarp-Practice',
    projectRoots: [
      { directory: 'basic_tuple', path: 'C:/Scarp-Practice/basic_tuple' },
      { directory: 'loops', path: 'C:/Scarp-Practice/loops' },
    ],
    files: [
      { name: 'basic_tuple/tests/tuple.srp', path: 'C:/Scarp-Practice/basic_tuple/tests/tuple.srp' },
      { name: 'loops/tests/loop.srp', path: 'C:/Scarp-Practice/loops/tests/loop.srp' },
    ],
  };
  it('opens only test sources belonging to an explicitly scanned nested manifest root', () => {
    expect(resolveListedTestSource('tests/tuple.srp',
      'C:/Scarp-Practice/basic_tuple', nested)).toBe(nested.files[0].path);
    expect(resolveListedTestSource('tests/loop.srp',
      'c:\\scarp-practice\\loops', nested)).toBe(nested.files[1].path);
  });
  it('does not resolve another project, unknown root or report traversal', () => {
    expect(resolveListedTestSource('tests/loop.srp',
      'C:/Scarp-Practice/basic_tuple', nested)).toBeNull();
    expect(resolveListedTestSource('tests/tuple.srp',
      'C:/Scarp-Practice/other', nested)).toBeNull();
    expect(resolveListedTestSource('../basic_tuple/tests/tuple.srp',
      'C:/Scarp-Practice/basic_tuple', nested)).toBeNull();
    expect(resolveListedTestSource('tests/tuple.srp',
      'C:/Scarp-Practice/basic_tuple', { ...nested, projectRoots: [] })).toBeNull();
  });
});

describe('structured test report visibility for the selected project root', () => {
  it('renders results for the selected nested project, not its workspace parent', () => {
    expect(isSelectedProjectTestReport(
      'C:/Scarp-Practice/basic_tuple', 'C:/Scarp-Practice/basic_tuple',
    )).toBe(true);
    expect(isSelectedProjectTestReport(
      'C:/Scarp-Practice/basic_tuple', 'C:/Scarp-Practice',
    )).toBe(false);
  });
  it('keeps Windows path aliases valid but isolates neighboring project folders', () => {
    expect(isSelectedProjectTestReport(
      String.raw`C:\Scarp-Practice\Basic_Tuple`, 'c:/scarp-practice/basic_tuple',
    )).toBe(true);
    expect(isSelectedProjectTestReport(
      'C:/Scarp-Practice/basic_tuple', 'C:/Scarp-Practice/loops',
    )).toBe(false);
    expect(isSelectedProjectTestReport(
      'C:/Scarp-Practice/basic_tuple', null,
    )).toBe(false);
  });
  it('preserves exact case on POSIX project roots', () => {
    expect(isSelectedProjectTestReport('/home/me/Scarp/basic_tuple',
      '/home/me/Scarp/basic_tuple')).toBe(true);
    expect(isSelectedProjectTestReport('/home/me/Scarp/basic_tuple',
      '/home/me/scarp/basic_tuple')).toBe(false);
  });
});
