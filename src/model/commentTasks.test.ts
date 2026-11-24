import { describe, expect, it } from 'vitest';
import {
  findScarpCommentTasks, filterScarpCommentTasks, currentTaskPosition,
  sortScarpCommentTasks, groupScarpCommentTasks, taskCounts,
  MAX_SCARP_COMMENT_TASKS,
} from './commentTasks';

describe('Scarp comment task inventory', () => {
  it('finds only real line comments, not string contents', () => {
    const source = [
      'bind message = "// TODO false";',
      '// TODO: real work',
      'print(message); // FIXME: actual issue',
      '// ordinary text without markers',
    ].join('\n');
    const report = findScarpCommentTasks(source);
    expect(report.complete).toBe(true);
    expect(report.tasks.map(t => t.kind)).toEqual(['TODO', 'FIXME']);
    expect(report.tasks.map(t => t.description)).toEqual(['real work', 'actual issue']);
    expect(report.tasks.map(t => t.line)).toEqual([2, 3]);
  });

  it('understands case-insensitive markers and supported owners', () => {
    const report = findScarpCommentTasks([
      '// todo(sanskar): write docs',
      '// FixMe[reviewer]: check edge case',
      '// BUG: parser bug',
      '// REVIEW: audit this',
      '// NOTE- for future',
      '// HACK workaround',
      '// XXX: urgent cleanup',
    ].join('\r\n'));
    expect(report.tasks.map(t => t.kind))
      .toEqual(['TODO', 'FIXME', 'BUG', 'REVIEW', 'NOTE', 'HACK', 'XXX']);
    expect(report.tasks.slice(0, 2).map(t => t.owner))
      .toEqual(['sanskar', 'reviewer']);
    expect(report.tasks.map(t => t.priority))
      .toEqual(['normal', 'high', 'high', 'normal', 'low', 'low', 'high']);
    expect(report.tasks.map(t => t.line)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it.each([
    '// TODOING is not a task',
    '// NOTTODO is not a task',
    '// TODO_name is not a task',
    '// no task words here',
    '// TO-DO not a task',
    'print("// FIXME fake");',
    'funcra TODO() {}',
  ])('rejects non-marker %j', (source) => {
    expect(findScarpCommentTasks(source).tasks).toEqual([]);
  });

  it('retains exact offset and column for indented comments', () => {
    const source = '    // TODO(a): text';
    const task = findScarpCommentTasks(source).tasks[0];
    expect(task.offset).toBe(source.indexOf('TODO'));
    expect(task.column).toBe(8);
    expect(currentTaskPosition(source, task))
      .toEqual({ line: task.line, column: task.column });
  });

  it('does not navigate after a source mutation or forged marker', () => {
    const source = '// FIXME: inspect';
    const task = findScarpCommentTasks(source).tasks[0];
    expect(currentTaskPosition(source.replace('FIXME', 'TODO '), task)).toBeNull();
    expect(currentTaskPosition('"FIXME"', task)).toBeNull();
    expect(currentTaskPosition('// ordinary text', task)).toBeNull();
    expect(currentTaskPosition(source, { ...task, offset: -1 })).toBeNull();
    expect(currentTaskPosition(source, { ...task, line: 99 })).toBeNull();
    expect(currentTaskPosition(source, { ...task, column: 999 })).toBeNull();
  });

  it('never uses a token preview that omitted the task tail', () => {
    const source = '// ' + 'a'.repeat(2100) + ' TODO: invisible in preview';
    const result = findScarpCommentTasks(source);
    expect(result.tasks).toEqual([]);
  });

  it('caps listed tasks while exposing that the source has more', () => {
    const source = Array.from({ length: MAX_SCARP_COMMENT_TASKS + 9 },
      (_, i) => '// TODO: item ' + i).join('\n');
    const result = findScarpCommentTasks(source);
    expect(result.totalFound).toBe(MAX_SCARP_COMMENT_TASKS + 9);
    expect(result.tasks).toHaveLength(MAX_SCARP_COMMENT_TASKS);
    expect(result.complete).toBe(false);
    expect(result.message).toContain('limited');
  });

  it('flags huge source as incomplete rather than returning a false zero', () => {
    const result = findScarpCommentTasks('x'.repeat(512 * 1024 + 1));
    expect(result.complete).toBe(false);
    expect(result.message).toContain('incomplete');
  });

  it('limits task descriptions and excludes control characters from labels', () => {
    const report = findScarpCommentTasks('// TODO: ' + 'x'.repeat(400));
    expect(report.tasks[0].description.length).toBeLessThanOrEqual(180);
    expect(report.tasks[0].description).not.toContain('\0');
  });

  it('ignores malformed owner patterns rather than guessing remote identities', () => {
    const result = findScarpCommentTasks('// TODO(super/unsafe): adjust');
    expect(result.tasks[0].owner).toBeNull();
    expect(result.tasks[0].description).toContain('super/unsafe');
  });

  it('uses first task marker on a comment line for stable navigation', () => {
    const source = '// TODO: inspect FIXME: later';
    const result = findScarpCommentTasks(source);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].kind).toBe('TODO');
  });

  it('does not mutate the source or original task order', () => {
    const source = '// NOTE: c\n// BUG: b\n// TODO: a';
    const tasks = findScarpCommentTasks(source).tasks;
    const ordered = sortScarpCommentTasks(tasks, 'priority');
    expect(ordered.map(t => t.kind)).toEqual(['BUG', 'TODO', 'NOTE']);
    expect(tasks.map(t => t.kind)).toEqual(['NOTE', 'BUG', 'TODO']);
    expect(sortScarpCommentTasks(tasks, 'source').map(t => t.kind))
      .toEqual(['NOTE', 'BUG', 'TODO']);
  });

  it('filters by task kind, severity and text without regex execution', () => {
    const tasks = findScarpCommentTasks([
      '// TODO(p): check module',
      '// FIXME: check source',
      '// NOTE: developer note',
    ].join('\n')).tasks;
    expect(filterScarpCommentTasks(tasks,
      { kind: 'TODO', priority: 'all', query: '' })).toHaveLength(1);
    expect(filterScarpCommentTasks(tasks,
      { kind: 'all', priority: 'high', query: 'check' })).toHaveLength(1);
    expect(filterScarpCommentTasks(tasks,
      { kind: 'all', priority: 'all', query: 'MODULE' })).toHaveLength(1);
    expect(filterScarpCommentTasks(tasks,
      { kind: 'all', priority: 'all', query: '(' })).toEqual([]);
    expect(filterScarpCommentTasks(tasks,
      { kind: 'all', priority: 'all', query: 'x'.repeat(121) })).toEqual([]);
  });

  it('groups priority counts without changing source order', () => {
    const tasks = findScarpCommentTasks(
      '// NOTE a\n// TODO b\n// FIXME c\n// FIXME d',
    ).tasks;
    expect(taskCounts(tasks)).toEqual({ high: 2, normal: 1, low: 1 });
    const groups = groupScarpCommentTasks(tasks);
    expect(groups.map(g => [g.kind, g.tasks.length]))
      .toEqual([['FIXME', 2], ['TODO', 1], ['NOTE', 1]]);
  });

  it('never confuses a marker with an executable Scarp directive', () => {
    const source = '// TODO: visit https://example.invalid/\nfuncra main() { }';
    const report = findScarpCommentTasks(source);
    expect(report.tasks[0].description).toContain('https://');
    expect(report.tasks[0]).not.toHaveProperty('url');
    expect(report.tasks[0]).not.toHaveProperty('command');
  });
});
