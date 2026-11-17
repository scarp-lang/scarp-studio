import { describe, expect, it } from 'vitest';
import { dirtyProjectSourceNames } from './projectSourceState';
import type { StudioDocument } from './documents';

function tab(name: string, path: string | null, dirty = true): StudioDocument {
  return { id: name, name, path, savedContent: 'saved', content: dirty ? 'edited' : 'saved', revision: 0 };
}

describe('disk-backed project source awareness', () => {
  it('flags only dirty files belonging to the chosen project', () => {
    expect(dirtyProjectSourceNames([
      tab('main.srp', 'C:/Work/Scarp/src/main.srp'),
      tab('tests.srp', 'C:/Work/Scarp/tests/tests.srp'),
      tab('unchanged.srp', 'C:/Work/Scarp/unchanged.srp', false),
      tab('unrelated.srp', 'C:/Work/Another/src/unrelated.srp'),
      tab('untitled.srp', null),
    ], 'c:\\work\\scarp')).toEqual(['main.srp', 'tests.srp']);
  });

  it('does not confuse neighboring folder prefixes or path traversal', () => {
    expect(dirtyProjectSourceNames([
      tab('other.srp', 'C:/project-old/other.srp'),
      tab('traversal.srp', 'C:/project/src/../outside.srp'),
      tab('good.srp', 'C:/project/src/good.srp'),
      tab('drive.srp', 'D:/project/src/drive.srp'),
    ], 'C:/project/')).toEqual(['good.srp']);
  });

  it('supports Windows extended-length drive and UNC aliases', () => {
    expect(dirtyProjectSourceNames([
      tab('drive.srp', '\\\\?\\C:\\work\\src\\drive.srp'),
      tab('network.srp', '\\\\?\\UNC\\SERVER\\share\\project\\network.srp'),
      tab('different-share.srp', '\\\\server\\other\\project\\wrong.srp'),
    ], 'c:/WORK')).toEqual(['drive.srp']);
    expect(dirtyProjectSourceNames([
      tab('network.srp', '\\\\?\\UNC\\SERVER\\share\\project\\network.srp'),
      tab('elsewhere.srp', '\\\\server\\other\\project\\wrong.srp'),
    ], '\\\\server\\share\\project')).toEqual(['network.srp']);
  });

  it('keeps POSIX project folder names case-sensitive', () => {
    expect(dirtyProjectSourceNames([
      tab('source.srp', '/home/me/Scarp/src/source.srp'),
      tab('other.srp', '/home/me/scarp/src/other.srp'),
      tab('outside.srp', '/home/me/Scarp-old/outside.srp'),
    ], '/home/me/Scarp')).toEqual(['source.srp']);
  });

  it('returns no blockers for an invalid or relative selected root', () => {
    expect(dirtyProjectSourceNames([tab('example.srp', 'C:/work/src/example.srp')], './work')).toEqual([]);
    expect(dirtyProjectSourceNames([tab('example.srp', 'C:/work/src/example.srp')], 'C:/work/../work')).toEqual([]);
  });
});
