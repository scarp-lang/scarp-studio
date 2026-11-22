import { describe, expect, it } from 'vitest';
import {
  dirtyProjectSourceNames, projectActionRequiresSavedSources,
  projectSourceBuffersChanged,
} from './projectSourceState';
import type { StudioDocument } from './documents';

function tab(name: string, path: string | null, dirty = true): StudioDocument {
  return { id: name, name, path, savedContent: 'saved', content: dirty ? 'edited' : 'saved', revision: 0 };
}

describe('project commands and saved source requirements', () => {
  it('keeps Info available but requires clean sources for every source-backed action', () => {
    expect(projectActionRequiresSavedSources('info')).toBe(false);
    for (const action of ['verify', 'run', 'list-tests', 'run-tests'] as const) {
      expect(projectActionRequiresSavedSources(action)).toBe(true);
    }
  });
});

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

describe('project test result freshness', () => {
  const folder = 'C:/Work/Scarp';
  const project = tab('main.srp', 'C:/Work/Scarp/src/main.srp', false);
  const unrelated = tab('other.srp', 'C:/Other/src/other.srp', false);

  it('retains reports while switching tabs, opening files and editing another project', () => {
    expect(projectSourceBuffersChanged([project], [project], folder)).toBe(false);
    expect(projectSourceBuffersChanged([project], [project, tab('new.srp', null)], folder)).toBe(false);
    expect(projectSourceBuffersChanged([project], [project, tab('test.srp',
      'C:/Work/Scarp/tests/test.srp', false)], folder)).toBe(false);
    expect(projectSourceBuffersChanged([project, unrelated], [project,
      { ...unrelated, content: 'new text', revision: 1 }], folder)).toBe(false);
  });

  it('invalidates reports for edits, same-content Saves and Reloads in the project', () => {
    expect(projectSourceBuffersChanged([project], [
      { ...project, content: 'edited', revision: 1 },
    ], folder)).toBe(true);
    expect(projectSourceBuffersChanged([project], [
      { ...project, revision: 1 },
    ], folder)).toBe(true);
    expect(projectSourceBuffersChanged([project], [
      { ...project, savedContent: 'disk changed', revision: 1 },
    ], folder)).toBe(true);
    expect(projectSourceBuffersChanged([project], [
      { ...project, revision: 2, content: project.content },
    ], folder)).toBe(true);
  });

  it('invalidates reports when Save As moves a source into or out of the project', () => {
    expect(projectSourceBuffersChanged([unrelated], [
      { ...unrelated, path: 'C:/Work/Scarp/new.srp', revision: 1 },
    ], folder)).toBe(true);
    expect(projectSourceBuffersChanged([project], [
      { ...project, path: 'C:/Other/main.srp', revision: 1 },
    ], folder)).toBe(true);
  });

  it('recognizes safe Windows aliases and UNC roots without confusing siblings', () => {
    const alias = tab('main.srp', String.raw`C:\Work\Scarp\src\..\main.srp`, false);
    expect(projectSourceBuffersChanged([alias], [{ ...alias, revision: 1 }],
      'c:/work/scarp/./')).toBe(true);
    const unc = tab('test.srp', String.raw`\\SERVER\share\project\tests\a.srp`, false);
    expect(projectSourceBuffersChanged([unc], [{ ...unc, content: 'edited' }],
      String.raw`\\server\share\project`)).toBe(true);
    expect(projectSourceBuffersChanged([project], [{ ...project, content: 'edited' }],
      'C:/Work/Scarp-old')).toBe(false);
  });

  it('rejects unsafe, non-project and mismatched POSIX path identities', () => {
    const posix = tab('main.srp', '/home/me/Scarp/main.srp', false);
    expect(projectSourceBuffersChanged([posix], [{ ...posix, revision: 1 }],
      '/home/me/Scarp')).toBe(true);
    expect(projectSourceBuffersChanged([posix], [{ ...posix, revision: 1 }],
      '/home/me/scarp')).toBe(false);
    expect(projectSourceBuffersChanged([project], [{ ...project, revision: 1 }],
      String.raw`\\.\C:\Work\Scarp`)).toBe(false);
  });
});
