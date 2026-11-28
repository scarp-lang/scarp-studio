import { describe, expect, it } from 'vitest';
import {
  captureInspectionBaseline, compareInspectionBaselines, filterInspectionComparison,
  inspectionComparisonReport, inspectionDeltaLabel, pageInspectionComparison,
  INSPECTION_COMPARISON_PAGE, type InspectionBaseline,
} from './projectInspectionComparison';
import { prepareProjectInspection, executeProjectInspection,
  type InspectionSettings, type ProjectInspectionReport } from './projectInspection';
import { DEFAULT_PROJECT_SEARCH_SCOPE, MAX_SCOPE_REPORT_UNITS } from './projectSearchScope';
import { createUntitled } from './documents';

const settings: InspectionSettings = { scope: DEFAULT_PROJECT_SEARCH_SCOPE, mode: 'working', listingLimited: false };
const entry = (name: string) => ({ name, path: 'C:/private-root/' + name });
async function inspect(
  contents: Readonly<Record<string,string>>, config = settings,
  unavailable: readonly string[] = [], open: readonly ReturnType<typeof createUntitled>[] = [],
): Promise<ProjectInspectionReport> {
  const listed = Object.keys(contents).map(entry);
  const planned = prepareProjectInspection(listed, config);
  if (!planned.ok) throw Error(planned.error);
  const result = await executeProjectInspection(planned.value, open, async path => {
    const name = listed.find(item => item.path === path)!.name;
    if (unavailable.includes(name)) throw Error('private native error');
    return contents[name];
  }, { isCurrent: () => true, isCancelled: () => false });
  if (result.kind !== 'report') throw Error('No report');
  return result.report;
}
function baseline(report: ProjectInspectionReport): InspectionBaseline {
  const result = captureInspectionBaseline(report);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
function compare(before: ProjectInspectionReport, after: ProjectInspectionReport) {
  const result = compareInspectionBaselines(baseline(before), baseline(after));
  if (!result.ok) throw Error(result.error);
  return result.value;
}

describe('metadata-only source inspection baselines', () => {
  it('copies independent count maps and excludes private task and finding details', async () => {
    const report = await inspect({ 'src/private.srp': '// TODO(privateOwner): private-description  \n' });
    const captured = baseline(report);
    expect(captured.files[0].tasks.TODO).toBe(1);
    expect(captured.files[0].quality['trailing-whitespace']).toBe(1);
    expect(JSON.stringify(captured)).not.toContain('private-description');
    expect(JSON.stringify(captured)).not.toContain('privateOwner');
    expect(JSON.stringify(captured)).not.toContain('C:/private-root');
    expect(JSON.stringify(captured)).not.toContain('column');
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.files)).toBe(true);
    expect(Object.isFrozen(captured.files[0].tasks)).toBe(true);
  });

  it('rejects inconsistent aggregate and per-file counts', async () => {
    const report = await inspect({ 'a.srp': '// TODO a\n' });
    for (const patch of [
      { selected: 2 }, { listed: 99 }, { excluded: -1 }, { fullyInspected: 0 },
      { partial: 1 }, { unread: 2 }, { taskCounts: { ...report.taskCounts, TODO: 99 } },
      { qualityCounts: { ...report.qualityCounts, 'long-line': 1 } },
      { tasks: [] }, { tasks: [...report.tasks, ...report.tasks] },
    ]) expect(captureInspectionBaseline({ ...report, ...patch }).ok).toBe(false);
    for (const file of [
      { ...report.files[0], tasksRetained: 0 },
      { ...report.files[0], state: 'read-failed' as const },
      { ...report.files[0], tasksComplete: false },
      { ...report.files[0], origin: 'none' as const },
      { ...report.files[0], name: 'C:/native/a.srp' },
    ]) expect(captureInspectionBaseline({ ...report, files: [file] }).ok).toBe(false);
  });

  it('rejects scope-completeness contradictions', async () => {
    const limited = await inspect({ 'a.srp': '// TODO a\n' }, { ...settings, listingLimited: true });
    expect(captureInspectionBaseline({ ...limited, complete: true }).ok).toBe(false);
    const failure = await inspect({ 'a.srp': '' }, settings, ['a.srp']);
    expect(captureInspectionBaseline({ ...failure, complete: true }).ok).toBe(false);
  });
});

describe('inspection comparison evidence', () => {
  it('compares task and quality rule counts over fully observed paired labels', async () => {
    const before = await inspect({
      'a.srp': '// TODO a  \n// FIXME b\n',
      'b.srp': '// NOTE c\n',
    });
    const after = await inspect({
      'a.srp': '// BUG b\n',
      'b.srp': '// NOTE c\n// TODO d  \n',
    });
    const result = compare(before, after);
    expect(result.comparableTaskFiles).toBe(2);
    expect(result.comparableQualityFiles).toBe(2);
    expect(result.taskTotals).toEqual({ earlier: 3, current: 3, delta: 0 });
    expect(result.qualityTotals).toEqual({ earlier: 1, current: 1, delta: 0 });
    expect(result.taskRules.FIXME.delta).toBe(-1);
    expect(result.taskRules.BUG.delta).toBe(1);
    expect(result.rows[0].taskChanges?.TODO.delta).toBe(-1);
    expect(result.rows[1].qualityChanges?.['trailing-whitespace'].delta).toBe(1);
    expect(filterInspectionComparison(result, 'changed')).toHaveLength(2);
  });

  it('treats unavailable evidence as unknown instead of zero', async () => {
    const before = await inspect({ 'a.srp': '// TODO a\n', 'b.srp': '' }, settings, ['a.srp']);
    const after = await inspect({ 'a.srp': '// TODO a\n', 'b.srp': '// NOTE b\n' });
    const result = compare(before, after);
    expect(result.rows[0].taskDelta).toBeNull();
    expect(result.rows[0].qualityDelta).toBeNull();
    expect(result.comparableTaskFiles).toBe(1);
    expect(result.taskTotals).toEqual({ earlier: 0, current: 1, delta: 1 });
    expect(result.originChanges).toBe(0);
    expect(filterInspectionComparison(result, 'uncertain')).toHaveLength(1);
  });

  it('keeps complete quality counts when long comment evidence limits task coverage', async () => {
    const before = await inspect({ 'a.srp': '// ' + 'x'.repeat(2100) + ' TODO hidden\n' });
    const after = await inspect({ 'a.srp': '// TODO visible\n' });
    const result = compare(before, after);
    expect(result.comparableTaskFiles).toBe(0);
    expect(result.comparableQualityFiles).toBe(1);
    expect(result.taskTotals).toBeNull();
    expect(result.qualityRules['long-line'].delta).toBe(-1);
  });

  it('does not infer file creation or deletion from changed selection membership', async () => {
    const result = compare(
      await inspect({ 'a.srp': '// TODO a\n', 'b.srp': '' }),
      await inspect({ 'b.srp': '', 'c.srp': '// TODO c\n' }),
    );
    expect(result.earlierOnly).toBe(1);
    expect(result.currentOnly).toBe(1);
    expect(result.comparableTaskFiles).toBe(1);
    expect(filterInspectionComparison(result, 'earlier-only')[0].name).toBe('a.srp');
    expect(filterInspectionComparison(result, 'current-only')[0].name).toBe('c.srp');
    expect(result.rows.find(row => row.name === 'c.srp')?.taskDelta).toBeNull();
  });

  it('flags working-buffer origin changes without treating them as semantic edits', async () => {
    const source = '// TODO a\n';
    const open = { ...createUntitled(1), name: 'a.srp', path: entry('a.srp').path, content: source, savedContent: source };
    const result = compare(await inspect({ 'a.srp': source }), await inspect({ 'a.srp': source }, settings, [], [open]));
    expect(result.originChanges).toBe(1);
    expect(result.rows[0].taskDelta?.delta).toBe(0);
    expect(filterInspectionComparison(result, 'changed')).toHaveLength(1);
  });

  it('rejects different scope or snapshot modes', async () => {
    const before = baseline(await inspect({ 'src/a.srp': '' }));
    const saved = baseline(await inspect({ 'src/a.srp': '' }, { ...settings, mode: 'saved' }));
    const scoped = baseline(await inspect({ 'src/a.srp': '' }, { ...settings,
      scope: { ...settings.scope, directory: 'src' } }));
    expect(compareInspectionBaselines(before, saved).ok).toBe(false);
    expect(compareInspectionBaselines(before, scoped).ok).toBe(false);
  });

  it('detects category changes even when a file total is unchanged', async () => {
    const result = compare(await inspect({ 'a.srp': '// TODO a\n' }), await inspect({ 'a.srp': '// FIXME a\n' }));
    expect(result.rows[0].taskDelta?.delta).toBe(0);
    expect(filterInspectionComparison(result, 'changed')).toHaveLength(1);
  });
});

describe('inspection comparison reports and paging', () => {
  it('keeps labels opt-in and omits source details in every report', async () => {
    const result = compare(await inspect({ 'private/a.srp': '// TODO(privateOwner): private-description\n' }),
      await inspect({ 'private/a.srp': '' }));
    const plain = inspectionComparisonReport(result);
    expect(plain).toContain('Task count change: 1 → 0 (-1)');
    expect(plain).not.toContain('private/a.srp');
    const labeled = inspectionComparisonReport(result, true);
    expect(labeled).toContain('private/a.srp');
    for (const secret of ['privateOwner','private-description','C:/private-root']) expect(labeled).not.toContain(secret);
    expect(inspectionDeltaLabel(null)).toBe('Not comparable');
    expect(inspectionDeltaLabel({ earlier: 1, current: 2, delta: 1 })).toBe('1 → 2 (+1)');
  });
  it('clamps pages over paired and unmatched label sets', async () => {
    const before = Object.fromEntries(Array.from({ length: 24 }, (_, index) => ['a-' + index + '.srp', '']));
    const after = Object.fromEntries(Array.from({ length: 24 }, (_, index) => ['b-' + index + '.srp', '']));
    const result = compare(await inspect(before), await inspect(after));
    expect(result.rows).toHaveLength(48);
    expect(pageInspectionComparison(result.rows, 1).rows).toHaveLength(INSPECTION_COMPARISON_PAGE);
    expect(pageInspectionComparison(result.rows, 99).page).toBe(3);
    expect(pageInspectionComparison([], 99)).toEqual({ page: 1, pages: 1, rows: [] });
  });
  it('limits optional label report length', async () => {
    const before = Object.fromEntries(Array.from({ length: 24 }, (_, index) => [index + 'a'.repeat(950) + '.srp', '']));
    const after = Object.fromEntries(Array.from({ length: 24 }, (_, index) => [index + 'b'.repeat(950) + '.srp', '']));
    const result = compare(await inspect(before), await inspect(after));
    const report = inspectionComparisonReport(result, true);
    expect(report.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(report).toContain('Additional labels omitted');
  });
});
