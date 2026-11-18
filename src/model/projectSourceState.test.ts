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

  it('normalizes inside-project dot aliases but refuses outside-root traversal', () => {
    expect(dirtyProjectSourceNames([
      tab('other.srp', 'C:/project-old/other.srp'),
      tab('alias.srp', 'C:/project/src/../outside.srp'),
      tab('good.srp', 'C:/project/src/good.srp'),
      tab('traversal.srp', 'C:/project/src/../../outside.srp'),
      tab('invalid.srp', 'C:/../../project/invalid.srp'),
      tab('drive.srp', 'D:/project/src/drive.srp'),
    ], 'C:/project/')).toEqual(['alias.srp', 'good.srp']);
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

  it('normalizes a lexical selected root and accepts UNC aliases within the share', () => {
    expect(dirtyProjectSourceNames([
      tab('main.srp', String.raw`C:\work\src\..\main.srp`),
    ], 'C:/work/./')).toEqual(['main.srp']);
    expect(dirtyProjectSourceNames([
      tab('main.srp', String.raw`\\SERVER\share\project\src\..\main.srp`),
      tab('outside.srp', String.raw`\\server\share\project\src\..\..\outside.srp`),
    ], String.raw`\\server\share\project`)).toEqual(['main.srp']);
  });

  it('returns no blockers for invalid, relative, device or unsupported roots', () => {
    const documents = [tab('example.srp', 'C:/work/src/example.srp')];
    expect(dirtyProjectSourceNames(documents, './work')).toEqual([]);
    expect(dirtyProjectSourceNames(documents, 'C:/../work')).toEqual([]);
    expect(dirtyProjectSourceNames(documents, String.raw`\\.\C:\work`)).toEqual([]);
    expect(dirtyProjectSourceNames(documents, 'C:/work/../work')).toEqual(['example.srp']);
    expect(dirtyProjectSourceNames([
      tab('extended.srp', String.raw`\\?\C:\work\src\..\main.srp`),
    ], 'C:/work')).toEqual([]);
  });
});
