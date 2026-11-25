import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readDir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { scanSourceFolder } from './folders';

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn(async (parent: string, name: string) => parent + '/' + name),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readDir: vi.fn() }));
vi.mock('./sourceRead', () => ({ readScarpSource: vi.fn() }));

const file = (name: string) => ({ name, isFile: true, isDirectory: false, isSymlink: false });
const dir = (name: string, isSymlink = false) => ({
  name, isFile: false, isDirectory: true, isSymlink,
});

describe('nested Scarp-Practice workspaces', () => {
  beforeEach(() => vi.resetAllMocks());

  it('discovers nested sources across projects and keeps empty folders visible', async () => {
    vi.mocked(readDir).mockImplementation(async path => {
      if (path === 'C:/Scarp-Practice') return [dir('basic_tuple'), dir('conditions'), dir('empty')];
      if (path === 'C:/Scarp-Practice/basic_tuple') return [file('main.srp'), file('scarp.project'), dir('examples')];
      if (path === 'C:/Scarp-Practice/basic_tuple/examples') return [file('tuple2.srp')];
      if (path === 'C:/Scarp-Practice/conditions') return [file('if.srp')];
      if (path === 'C:/Scarp-Practice/empty') return [];
      throw new Error('unexpected path: ' + path);
    });
    const scanned = await scanSourceFolder('C:/Scarp-Practice');
    expect(scanned.files).toEqual([
      { name: 'basic_tuple/examples/tuple2.srp', path: 'C:/Scarp-Practice/basic_tuple/examples/tuple2.srp' },
      { name: 'basic_tuple/main.srp', path: 'C:/Scarp-Practice/basic_tuple/main.srp' },
      { name: 'conditions/if.srp', path: 'C:/Scarp-Practice/conditions/if.srp' },
    ]);
    expect(scanned.directories).toEqual(['basic_tuple', 'conditions', 'empty', 'basic_tuple/examples']);
    expect(scanned.projectRoots).toEqual([
      { directory: 'basic_tuple', path: 'C:/Scarp-Practice/basic_tuple' },
    ]);
    expect(scanned.truncated).toBe(false);
    expect(scanned.unavailableFolders).toEqual([]);
  });

  it('never follows linked, dependency or unsafe directory entries', async () => {
    vi.mocked(readDir).mockImplementation(async path => path === 'C:/Scarp-Practice'
      ? [file('main.srp'), dir('linked', true), dir('node_modules'), dir('../outside'),
        dir('target'), dir('legit')]
      : path === 'C:/Scarp-Practice/legit' ? [file('safe.srp')] : []);
    const scanned = await scanSourceFolder('C:/Scarp-Practice');
    expect(scanned.directories).toEqual(['legit']);
    expect(scanned.files.map(item => item.name)).toEqual(['legit/safe.srp', 'main.srp']);
    expect(readDir).toHaveBeenCalledTimes(2);
  });

  it('retains accessible sources while reporting a denied nested folder', async () => {
    vi.mocked(readDir).mockImplementation(async path => {
      if (path === 'C:/Scarp-Practice') return [dir('basic_tuple'), dir('closed')];
      if (path === 'C:/Scarp-Practice/basic_tuple') return [file('main.srp')];
      throw new Error('Access denied');
    });
    const scanned = await scanSourceFolder('C:/Scarp-Practice');
    expect(scanned.files.map(item => item.name)).toEqual(['basic_tuple/main.srp']);
    expect(scanned.directories).toContain('closed');
    expect(scanned.unavailableFolders).toEqual(['closed']);
  });

  it('counts failed directory joins against the traversal budget', async () => {
    vi.mocked(readDir).mockResolvedValue(
      Array.from({ length: 120 }, (_, i) => dir('practice' + String(i).padStart(3, '0'))));
    vi.mocked(join).mockRejectedValue(new Error('Native join failed'));
    const scanned = await scanSourceFolder('C:/Scarp-Practice');
    expect(scanned.directories).toHaveLength(63);
    expect(scanned.unavailableFolders).toEqual(scanned.directories);
    expect(scanned.files).toEqual([]);
    expect(scanned.truncated).toBe(true);
    expect(join).toHaveBeenCalledTimes(63);
    expect(readDir).toHaveBeenCalledTimes(1);
  });

  it('preserves valid sibling sources when a source path join fails', async () => {
    vi.mocked(readDir).mockResolvedValue([file('broken.srp'), file('main.srp')]);
    vi.mocked(join).mockImplementation(async (parent, name) => {
      if (name === 'broken.srp') throw new Error('Native join failed');
      return parent + '/' + name;
    });
    const scanned = await scanSourceFolder('C:/Scarp-Practice');
    expect(scanned.files).toEqual([
      { name: 'main.srp', path: 'C:/Scarp-Practice/main.srp' },
    ]);
    expect(scanned.truncated).toBe(true);
  });

  it('does not join relative names that cannot be displayed by Explorer', async () => {
    const invalid = 'x'.repeat(1025);
    vi.mocked(readDir).mockResolvedValue([
      dir(invalid), file(invalid + '.srp'), file('main.srp'),
    ]);
    const scanned = await scanSourceFolder('C:/Scarp-Practice');
    expect(scanned.directories).toEqual([]);
    expect(scanned.files.map(item => item.name)).toEqual(['main.srp']);
    expect(scanned.truncated).toBe(true);
    expect(join).toHaveBeenCalledTimes(1);
    expect(readDir).toHaveBeenCalledTimes(1);
  });

  it('caps traversal and makes large directory listings visibly incomplete', async () => {
    vi.mocked(readDir).mockImplementation(async path =>
      path === 'C:/Scarp-Practice'
        ? Array.from({ length: 120 }, (_, i) => dir('practice' + String(i).padStart(3, '0')))
        : [file('main.srp')]);
    const scanned = await scanSourceFolder('C:/Scarp-Practice');
    expect(scanned.directories).toHaveLength(63);
    expect(scanned.files).toHaveLength(63);
    expect(scanned.truncated).toBe(true);
    expect(readDir).toHaveBeenCalledTimes(64);
  });
});

describe('manifest-root discovery in a multi-project practice workspace', () => {
  it('includes only directories with a regular scarp.project or Scarp.project entry', async () => {
    vi.mocked(readDir).mockImplementation(async path => {
      if (path === 'C:/Scarp-Practice') return [dir('basic_tuple'), dir('loops'), dir('examples')];
      if (path === 'C:/Scarp-Practice/basic_tuple') return [file('scarp.project'), file('main.srp')];
      if (path === 'C:/Scarp-Practice/loops') return [file('Scarp.project'), file('main.srp')];
      if (path === 'C:/Scarp-Practice/examples') return [
        { name: 'scarp.project', isFile: true, isDirectory: false, isSymlink: true },
      ];
      return [];
    });
    const scanned = await scanSourceFolder('C:/Scarp-Practice');
    expect(scanned.projectRoots).toEqual([
      { directory: 'basic_tuple', path: 'C:/Scarp-Practice/basic_tuple' },
      { directory: 'loops', path: 'C:/Scarp-Practice/loops' },
    ]);
    expect(scanned.files.map(item => item.name))
      .toEqual(['basic_tuple/main.srp', 'loops/main.srp']);
  });
});
