import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readDir } from '@tauri-apps/plugin-fs';
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
      if (path === 'C:/Scarp-Practice/basic_tuple') return [file('main.srp'), dir('examples')];
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
