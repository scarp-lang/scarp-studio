import { describe, expect, it } from 'vitest';
import {
  MAX_WORKSPACE_ITEM_NAME, planWorkspaceCreation, workspaceCreationTargets,
  workspaceItemNameError,
} from './workspaceCreate';

describe('workspace item name policy', () => {
  it.each(['', '.', '..', '.secret', ' leading', 'trailing ', 'name.',
    '../escape', 'sub/file', 'sub\\file', 'C:drive', 'stream:ads',
    'a?b', 'a*b', 'a"b', 'a<b', 'a>b', 'a|b', '\u0000', '\u007f',
    'CON', 'con.srp', 'NUL.txt', 'PRN', 'AUX', 'COM1', 'LPT9',
    'COM¹.txt', 'CONIN$', 'CONOUT$', '\ud800', '\udc00', 'x'.repeat(121),
  ])('rejects unsafe component %j', name => {
    expect(workspaceItemNameError(name)).not.toBeNull();
  });

  it.each(['main', 'main.srp', 'Main.SRP', 'practice-1', 'my project',
    'COM10', 'NUL-safe', 'नमस्ते', 'hello😀', 'x'.repeat(MAX_WORKSPACE_ITEM_NAME),
  ])('accepts portable component %j', name => {
    expect(workspaceItemNameError(name)).toBeNull();
  });
});

describe('workspace creation targets', () => {
  it('includes the root, valid nested directories, and no duplicates', () => {
    expect(workspaceCreationTargets(['src', 'src/lib', 'src', 'tests'], []))
      .toEqual(['', 'src', 'src/lib', 'tests']);
  });

  it('excludes inaccessible descendants and malformed paths', () => {
    expect(workspaceCreationTargets([
      'src', 'src/lib', 'examples', '../escape', '.git', 'node_modules',
      'CON', 'x:y', 'a//b', 'a/b/c/d/e/f',
    ], ['src'])).toEqual(['', 'examples']);
  });

  it('excludes every target when root is unavailable', () => {
    expect(workspaceCreationTargets(['src', 'tests'], [''])).toEqual([]);
  });
});

describe('workspace creation plan', () => {
  it('normalizes a source name to the Scarp extension', () => {
    expect(planWorkspaceCreation({ kind: 'source', directory: 'src/lib', name: 'math' }, ['', 'src/lib']))
      .toEqual({ ok: true, plan: {
        kind: 'source', directory: 'src/lib', segments: ['src', 'lib'],
        basename: 'math.srp', relativePath: 'src/lib/math.srp',
      } });
  });

  it('preserves an explicitly supplied extension', () => {
    const result = planWorkspaceCreation({ kind: 'source', directory: '', name: 'MAIN.SRP' }, ['']);
    expect(result.ok && result.plan.basename).toBe('MAIN.SRP');
  });

  it('creates one folder component only', () => {
    const result = planWorkspaceCreation({ kind: 'directory', directory: 'src', name: 'utils' }, ['src']);
    expect(result.ok && result.plan.relativePath).toBe('src/utils');
  });

  it.each(['../outside', 'unlisted', 'src/../outside', '/absolute', 'C:/drive'])(
    'rejects an invalid or unlisted parent %s', directory => {
      expect(planWorkspaceCreation({ kind: 'source', directory, name: 'main' }, ['src']).ok).toBe(false);
    },
  );

  it('allows files at maximum directory depth but not another directory', () => {
    const directory = 'a/b/c/d/e';
    expect(planWorkspaceCreation({ kind: 'source', directory, name: 'main' }, [directory]).ok).toBe(true);
    expect(planWorkspaceCreation({ kind: 'directory', directory, name: 'f' }, [directory]).ok).toBe(false);
  });

  it.each(['node_modules', 'build', 'target', '.git', 'dist'])('rejects hidden or ignored folders %s', name => {
    expect(planWorkspaceCreation({ kind: 'directory', directory: '', name }, ['']).ok).toBe(false);
  });

  it('rechecks the resulting name length after adding the extension', () => {
    expect(planWorkspaceCreation({ kind: 'source', directory: '', name: 'x'.repeat(120) }, ['']).ok).toBe(false);
  });
});
