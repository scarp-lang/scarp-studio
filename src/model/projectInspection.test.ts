import { describe, expect, it, vi } from 'vitest';
import {
  prepareProjectInspection, confirmProjectInspection, executeProjectInspection,
  filterInspection, pageInspection, resolveInspectionSource, inspectionReportText,
  DEFAULT_INSPECTION_FILTER, INSPECTION_READ_LIMITS, INSPECTION_PAGE_SIZE,
  MAX_INSPECTION_TASKS, MAX_INSPECTION_FINDINGS, type ProjectInspectionPlan,
  type InspectionSettings, type InspectionControl,
} from './projectInspection';
import { DEFAULT_PROJECT_SEARCH_SCOPE, PROJECT_SEARCH_BATCH_SIZE, MAX_SCOPE_REPORT_UNITS } from './projectSearchScope';
import { createUntitled } from './documents';

const settings: InspectionSettings = { scope: DEFAULT_PROJECT_SEARCH_SCOPE, mode: 'working', listingLimited: false };
const control: InspectionControl = { isCurrent: () => true, isCancelled: () => false };
const entry = (name: string) => ({ name, path: 'C:/private-root/' + name });
const entries = (count: number) => Array.from({ length: count }, (_, index) => entry('src/file-' + String(index).padStart(3,'0') + '.srp'));
function plan(listed = entries(3), config = settings): ProjectInspectionPlan {
  const result = prepareProjectInspection(listed, config);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
async function run(p = plan(), read: (path: string, limit: number) => Promise<string> = async () => '// TODO: private-description\n',
  docs = [] as ReturnType<typeof createUntitled>[], c = control) {
  const result = await executeProjectInspection(p, docs, read, c);
  if (result.kind !== 'report') throw Error('No inspection report');
  return result.report;
}

describe('listed source inspection review', () => {
  it('selects only reviewed listed files with bounded fair ordering', () => {
    const listed = [...entries(30), entry('tests/check.srp'), entry('main.srp')];
    const p = plan(listed);
    expect(p.selected).toBe(INSPECTION_READ_LIMITS.files);
    expect(p.sources.some(source => source.name === 'tests/check.srp')).toBe(true);
    expect(p.sources.some(source => source.name === 'main.srp')).toBe(true);
    expect(p.deferred).toBe(listed.length - p.selected);
    expect(Object.isFrozen(p.sources)).toBe(true);
    expect(Object.isFrozen(p.settings.scope)).toBe(true);
  });
  it('supports an explicit numbered batch beyond the conventional cap', () => {
    const listed = entries(40);
    const p = plan(listed, { ...settings, scope: { ...settings.scope, batch: 8 } });
    expect(p.selected).toBe(PROJECT_SEARCH_BATCH_SIZE);
    expect(p.sources.map(source => source.name)).toEqual(
      listed.slice(7 * PROJECT_SEARCH_BATCH_SIZE, 8 * PROJECT_SEARCH_BATCH_SIZE).map(source => source.name),
    );
  });
  it('separates excluded, duplicate, invalid and deferred entries', () => {
    const listed = [...entries(5), entry('tests/check.srp'), entry('../bad.srp'),
      entry('duplicate.srp'), entry('duplicate.srp')];
    const p = plan(listed, { ...settings, scope: { directory: 'src', descendants: true, filename: '', batch: 2 } });
    expect(p.selected).toBe(1);
    expect(p.deferred).toBe(4);
    expect(p.excluded).toBe(1);
    expect(p.withheld).toBe(3);
    expect(p.listed).toBe(9);
  });
  it('rejects unavailable scope or invalid snapshot mode', () => {
    expect(prepareProjectInspection([], settings).ok).toBe(false);
    expect(prepareProjectInspection(entries(1), { ...settings, scope: { ...settings.scope, batch: 2 } }).ok).toBe(false);
    expect(prepareProjectInspection(entries(1), { ...settings, mode: 'unknown' as InspectionSettings['mode'] }).ok).toBe(false);
  });
  it('revalidates paths and settings before reads', () => {
    const listed = entries(3), p = plan(listed);
    expect(confirmProjectInspection(p, listed, settings).ok).toBe(true);
    expect(confirmProjectInspection(p, listed, { ...settings, mode: 'saved' }).ok).toBe(false);
    expect(confirmProjectInspection(p, listed, { ...settings, listingLimited: true }).ok).toBe(false);
    expect(confirmProjectInspection(p, listed, { ...settings, scope: { ...settings.scope, filename: 'file' } }).ok).toBe(false);
    expect(confirmProjectInspection(p, listed.slice(1), settings).ok).toBe(false);
    expect(confirmProjectInspection(p, listed.map((source, index) => index ? source : { ...source, path: 'D:/other.srp' }), settings).ok).toBe(false);
  });
});

describe('listed source inspection execution', () => {
  it('finds true comment markers and lexical hints without retaining full source', async () => {
    const data = await run(plan(entries(1)), async () =>
      'bind a = "// TODO fake";\r\n// FIXME(owner): private-description\nprint(a);  ');
    expect(data.status).toBe('completed');
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]).toMatchObject({ kind: 'FIXME', owner: 'owner', line: 2, column: 4, priority: 'high' });
    expect(data.findings.map(finding => finding.rule)).toEqual(expect.arrayContaining([
      'mixed-newlines', 'missing-final-newline', 'trailing-whitespace',
    ]));
    expect(data.findings.every(finding => !('edit' in finding))).toBe(true);
    expect(JSON.stringify(data)).not.toContain('C:/private-root');
    expect(JSON.stringify(data)).not.toContain('bind a =');
    expect(data.complete).toBe(true);
  });
  it('prefers open working buffers and independently supports disk-only scans', async () => {
    const listed = entries(2);
    const dirty = { ...createUntitled(1), path: listed[0].path, name: listed[0].name,
      content: '// FIXME: working\n', savedContent: '// TODO: saved\n' };
    const reader = vi.fn(async (_path: string, _limit: number) => '// TODO: disk\n');
    const working = await run(plan(listed), reader, [dirty]);
    expect(reader).toHaveBeenCalledTimes(1);
    expect(working.files.find(file => file.name === dirty.name)).toMatchObject({ origin: 'open-buffer', dirtyTab: true });
    expect(working.taskCounts.FIXME).toBe(1);
    const saved = await run(plan(listed, { ...settings, mode: 'saved' }), reader, [dirty]);
    expect(reader).toHaveBeenCalledTimes(3);
    expect(saved.taskCounts.FIXME).toBe(0);
    expect(saved.taskCounts.TODO).toBe(2);
    expect(saved.files.find(file => file.name === dirty.name)).toMatchObject({ origin: 'disk', dirtyTab: true });
  });
  it('does not choose between ambiguous working buffer aliases', async () => {
    const listed = entries(1);
    const docs = [1,2].map(id => ({ ...createUntitled(id), path: listed[0].path, content: '// TODO: text' }));
    const read = vi.fn(async () => '');
    const data = await run(plan(listed), read, docs);
    expect(read).not.toHaveBeenCalled();
    expect(data.files[0].state).toBe('ambiguous-buffer');
    expect(data.complete).toBe(false);
  });
  it('continues after read failures and does not leak native errors', async () => {
    const data = await run(plan(), async path => {
      if (path.endsWith('000.srp')) throw Error('private absolute native error');
      return '// TODO: available\n';
    });
    expect(data.unread).toBe(1);
    expect(data.fullyInspected).toBe(2);
    expect(data.tasks).toHaveLength(2);
    expect(data.files[0].state).toBe('read-failed');
    expect(JSON.stringify(data)).not.toContain('private absolute native error');
  });
  it('enforces independent byte budgets even if an injected reader returns too much', async () => {
    const listed = entries(2);
    const data = await run(plan(listed), async path => path.endsWith('000.srp')
      ? '😀'.repeat(INSPECTION_READ_LIMITS.fileBytes / 4 + 1) : '// TODO: available\n');
    expect(data.files[0].state).toBe('byte-limit');
    expect(data.files[1].state).toBe('scanned');
    expect(data.tasks).toHaveLength(1);
  });
  it('marks skipped or truncated comment previews as partial evidence', async () => {
    const data = await run(plan(entries(1)), async () => '// ' + 'a'.repeat(2100) + ' TODO hidden\n');
    expect(data.files[0]).toMatchObject({ state: 'partial', lexicalComplete: true, tasksComplete: false });
    expect(data.tasks).toHaveLength(0);
    expect(data.complete).toBe(false);
  });
  it('marks malformed strings as uncertain lexical observations', async () => {
    const data = await run(plan(entries(1)), async () => 'bind a = "unterminated\n// TODO visible\n');
    expect(data.files[0].lexicalComplete).toBe(false);
    expect(data.files[0].tasksComplete).toBe(false);
    expect(data.findings.some(finding => finding.rule === 'unclosed-string')).toBe(true);
    expect(data.complete).toBe(false);
  });
  it('caps workspace findings without falsely claiming complete coverage', async () => {
    const content = Array.from({ length: 180 }, (_, index) => '// TODO: ' + index + '  \n').join('');
    const data = await run(plan(entries(4)), async () => content);
    expect(data.tasks).toHaveLength(MAX_INSPECTION_TASKS);
    expect(data.findings).toHaveLength(MAX_INSPECTION_FINDINGS);
    expect(data.partial).toBeGreaterThan(0);
    expect(data.complete).toBe(false);
    expect(data.files.reduce((sum, file) => sum + file.tasksRetained, 0)).toBe(data.tasks.length);
  });
  it('marks bounded listing as incomplete even when all selected files were inspected', async () => {
    const data = await run(plan(entries(1), { ...settings, listingLimited: true }));
    expect(data.fullyInspected).toBe(1);
    expect(data.complete).toBe(false);
  });
  it('retains only completed file observations on cancellation', async () => {
    let cancelled = false;
    const read = vi.fn(async () => '// TODO observed\n');
    const data = await run(plan(), read, [], {
      ...control, isCancelled: () => cancelled, onProgress: progress => {
        if (progress.observed === 1) cancelled = true;
      },
    });
    expect(data.status).toBe('cancelled');
    expect(data.fullyInspected).toBe(1);
    expect(data.files.slice(1).every(file => file.state === 'not-observed')).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('discards the whole report if editor or listing generation becomes stale', async () => {
    let current = true;
    const result = await executeProjectInspection(plan(), [], async () => {
      current = false;
      return '// TODO observed\n';
    }, { ...control, isCurrent: () => current });
    expect(result).toEqual({ kind: 'invalidated' });
  });
});

describe('inspection filtering and privacy', () => {
  it('filters literal markers, priorities, rules and source labels', async () => {
    const data = await run(plan(entries(2)), async path => path.endsWith('000.srp')
      ? '// FIXME(owner): urgent  \n' : '// NOTE: later\n');
    const high = filterInspection(data, { ...DEFAULT_INSPECTION_FILTER, priority: 'high', query: 'urgent' });
    expect(high.tasks).toHaveLength(1);
    expect(high.tasks[0].kind).toBe('FIXME');
    const style = filterInspection(data, { ...DEFAULT_INSPECTION_FILTER, qualityRule: 'trailing-whitespace' });
    expect(style.findings).toHaveLength(1);
    expect(filterInspection(data, { ...DEFAULT_INSPECTION_FILTER, source: 'missing.srp' }).files).toHaveLength(0);
    expect(filterInspection(data, { ...DEFAULT_INSPECTION_FILTER, query: 'x'.repeat(121) }).tasks).toHaveLength(0);
  });
  it('clamps pagination for empty and large lists', async () => {
    const data = await run(plan(entries(1)), async () => '// TODO: task\n'.repeat(80));
    expect(pageInspection(data.tasks, 1).rows).toHaveLength(INSPECTION_PAGE_SIZE);
    expect(pageInspection(data.tasks, Infinity).page).toBe(1);
    expect(pageInspection(data.tasks, 999).page).toBe(4);
    expect(pageInspection([], 999)).toEqual({ pages: 1, page: 1, rows: [] });
  });
  it('only resolves currently unique listed labels that occurred in the report', async () => {
    const listed = entries(2);
    const data = await run(plan(listed));
    expect(resolveInspectionSource(data, listed[0].name, listed)).toBe(listed[0].path);
    expect(resolveInspectionSource(data, listed[0].name, listed.slice(1))).toBeNull();
    expect(resolveInspectionSource(data, listed[0].name, [...listed, listed[0]])).toBeNull();
    expect(resolveInspectionSource(data, 'extra.srp', [...listed, entry('extra.srp')])).toBeNull();
  });
  it('exports counts without task descriptions, owners or paths', async () => {
    const data = await run(plan(entries(1)), async () => '// TODO(privateOwner): private-description\n');
    const plain = inspectionReportText(data);
    expect(plain).not.toContain('private-description');
    expect(plain).not.toContain('privateOwner');
    expect(plain).not.toContain('src/file-000.srp');
    const withLabels = inspectionReportText(data, true);
    expect(withLabels).toContain('src/file-000.srp');
    expect(withLabels).not.toContain('private-description');
    expect(withLabels).not.toContain('privateOwner');
    expect(withLabels).not.toContain('C:/private-root');
    expect(withLabels.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
  });
});


describe('cooperative inspection scheduling', () => {
  it('cancels an all-buffer inspection between completed file observations', async () => {
    const listed = entries(3);
    const docs = listed.map((source,index) => ({
      ...createUntitled(index+1), name:source.name, path:source.path,
      content:'// TODO: retained task\n', savedContent:'',
    }));
    const read = vi.fn(async () => { throw Error('Unexpected disk read'); });
    let cancelled = false;
    let turns = 0;
    const result = await run(plan(listed),read,docs,{
      ...control,isCancelled:()=>cancelled,
      yieldBetweenFiles:async()=>{if(++turns===2)cancelled=true;},
    });
    expect(result.status).toBe('cancelled');
    expect(result.tasks).toHaveLength(1);
    expect(result.files.map(file=>file.state)).toEqual(['scanned','not-observed','not-observed']);
    expect(read).not.toHaveBeenCalled();
  });
  it('invalidates before the next read when workspace changes during a yield', async () => {
    const read = vi.fn(async () => '// TODO: private task\n');
    let current = true;
    let turns = 0;
    const result=await executeProjectInspection(plan(),[],read,{
      ...control,isCurrent:()=>current,
      yieldBetweenFiles:async()=>{if(++turns===2)current=false;},
    });
    expect(result).toEqual({kind:'invalidated'});
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('rejects oversized adapter responses before scanning malformed text', async () => {
    const result=await run(plan(entries(1)),async(_path,limit)=>'x'.repeat(limit)+'\ud800');
    expect(result.files[0].state).toBe('byte-limit');
    expect(result.tasks).toHaveLength(0);
    expect(result.findings).toHaveLength(0);
  });
});
