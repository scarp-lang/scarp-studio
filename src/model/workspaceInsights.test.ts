import { describe, expect, it } from 'vitest';
import {
  inspectScarpWorkspace, filterWorkspaceInsightEntries,
  workspaceInsightNavigationTarget, projectDirectoryForListedSource,
  MAX_WORKSPACE_INSIGHT_SOURCES,
} from './workspaceInsights';
import type { StudioDocument } from './documents';

function doc(name: string, content: string, saved = content): StudioDocument {
  return {
    id: name, name: name.split('/').pop() ?? name,
    path: 'C:/Workspace/' + name,
    content, savedContent:saved, revision:0,
  };
}
const listed = (...names: string[]) =>
  names.map(name => ({ name, path: 'C:/Workspace/' + name }));
const roots = [
  { directory:'', path:'C:/Workspace' },
  { directory:'basic_tuple', path:'C:/Workspace/basic_tuple' },
  { directory:'loops', path:'C:/Workspace/loops' },
];

describe('workspace overview project classification', () => {
  it('uses deepest discovered project directory, not a guessed native path', () => {
    expect(projectDirectoryForListedSource('basic_tuple/main.srp', roots))
      .toBe('basic_tuple');
    expect(projectDirectoryForListedSource('loops/main.srp', roots)).toBe('loops');
    expect(projectDirectoryForListedSource('main.srp', roots)).toBe('');
  });
  it('never maps traversal or unsupported file names to a project', () => {
    expect(projectDirectoryForListedSource('../outside.srp', roots)).toBeNull();
    expect(projectDirectoryForListedSource('src/../main.srp',roots)).toBeNull();
    expect(projectDirectoryForListedSource('main.txt',roots)).toBeNull();
  });
  it('returns null when a listed source has no scanned manifest root', () => {
    expect(projectDirectoryForListedSource('basic_tuple/main.srp',[])).toBeNull();
  });
});

describe('source-only Workspace Overview metrics', () => {
  it('reports an empty workspace without invented files', () => {
    const report = inspectScarpWorkspace([],[],[],null);
    expect(report.complete).toBe(true);
    expect(report.entries).toEqual([]);
    expect(report.projects).toEqual([]);
    expect(report.totals).toMatchObject({openTabs:0,modifiedTabs:0,analyzedTabs:0});
  });

  it('aggregates only the provided open editor sources', () => {
    const a = doc('basic_tuple/main.srp',
      'pure funcra one() { return 1; }\n// TODO: fix');
    const b = doc('loops/main.srp','funcra two() { repeat 2 as i { print(i); } }');
    const report = inspectScarpWorkspace([a,b],
      listed('basic_tuple/main.srp','loops/main.srp','other.srp'),roots,a.id);
    expect(report.complete).toBe(true);
    expect(report.entries).toHaveLength(2);
    expect(report.totals).toMatchObject({
      openTabs:2, analyzedTabs:2, functions:2, tasks:1, modifiedTabs:0,
      filesInExplorer:2, filesOutsideExplorer:0,
    });
    expect(report.projects.map(p=>p.directory)).toEqual(['basic_tuple','loops']);
    expect(report.entries[0].active).toBe(true);
  });

  it('counts unsaved editor text without claiming a disk conflict', () => {
    const active = doc('main.srp','print(2);','print(1);');
    const report = inspectScarpWorkspace([active], listed('main.srp'), roots, active.id);
    expect(report.totals.modifiedTabs).toBe(1);
    expect(report.entries[0].modified).toBe(true);
    expect(report.entries[0].warnings.some(w=>w.kind==='dirty')).toBe(true);
    expect(report.entries[0].warnings.some(w=>w.kind==='duplicate-path')).toBe(false);
  });

  it('adds explicit review hints for lexical issues without fabricating errors', () => {
    const active = doc('main.srp',
      'funcra main() { \n\t  // BUG: fix\nprint("bad\n');
    const report = inspectScarpWorkspace([active], listed('main.srp'),roots,active.id);
    const kinds = report.entries[0].warnings.map(w=>w.kind);
    expect(kinds).toContain('mixed-indent');
    expect(kinds).toContain('unbalanced-braces');
    expect(kinds).toContain('unterminated-string');
    expect(kinds).toContain('task-high');
    expect(report.totals.highPriorityTasks).toBe(1);
  });

  it('keeps source tabs outside selected folder visible as unassigned', () => {
    const active = doc('external/file.srp','print(10);');
    const report = inspectScarpWorkspace([active],listed('main.srp'),roots,active.id);
    expect(report.totals.filesOutsideExplorer).toBe(1);
    expect(report.entries[0].relativeName).toBeNull();
    expect(report.projects[0].label).toBe('Unassigned or standalone');
  });

  it('notes duplicate Windows paths across tab identity variants', () => {
    const a = doc('main.srp','print(1);');
    const b = {...a,id:'alias',path:'c:\\workspace\\MAIN.SRP'};
    const report = inspectScarpWorkspace([a,b],listed('main.srp'),roots,null);
    expect(report.entries.some(e=>e.warnings.some(w=>w.kind==='duplicate-path')))
      .toBe(true);
  });

  it('groups root-level and nested sources by their manifest roots', () => {
    const entries = [
      doc('main.srp','print(1);'),
      doc('basic_tuple/main.srp','print(2);'),
      doc('loops/main.srp','print(3);'),
    ];
    const report = inspectScarpWorkspace(entries,
      listed('main.srp','basic_tuple/main.srp','loops/main.srp'),roots,null);
    expect(report.projects.map(p=>p.directory)).toEqual(['basic_tuple','loops','']);
    expect(report.projects.every(p=>p.openFiles===1)).toBe(true);
  });

  it('refuses to scan past workspace-wide source budget', () => {
    const a = doc('a.srp','x'.repeat(512*1024));
    const b = doc('b.srp','x'.repeat(512*1024));
    const c = doc('c.srp','x'.repeat(512*1024));
    const d = doc('d.srp','x'.repeat(512*1024));
    const e = doc('e.srp','x'.repeat(1000));
    const report = inspectScarpWorkspace([a,b,c,d,e],
      listed('a.srp','b.srp','c.srp','d.srp','e.srp'),roots,null);
    expect(report.complete).toBe(false);
    expect(report.entries.find(entry=>entry.documentId==='e.srp')?.lineCount).toBeNull();
    expect(report.notes.some(note=>note.includes('exclude'))).toBe(true);
  });

  it('prioritizes the active document when more than forty tabs are open', () => {
    const docs = Array.from({length:MAX_WORKSPACE_INSIGHT_SOURCES+2},
      (_,i)=>doc('src/file'+i+'.srp','print('+i+');'));
    const active = docs[docs.length-1];
    const report = inspectScarpWorkspace(docs,
      listed(...docs.map(d=>d.id)),roots,active.id);
    expect(report.complete).toBe(false);
    expect(report.entries[0].documentId).toBe(active.id);
    expect(report.totals.openTabs).toBe(docs.length);
    expect(report.totals.analyzedTabs).toBe(MAX_WORKSPACE_INSIGHT_SOURCES);
  });

  it('does not store entire in-memory source text in report entries', () => {
    const secretSentinel = 'VERY_LONG_RANDOM_CONTENT_SENTINEL_0123456789';
    const text = 'print("'+secretSentinel+'");';
    const result = inspectScarpWorkspace([doc('main.srp',text)],
      listed('main.srp'),roots,null);
    expect(JSON.stringify(result)).not.toContain(secretSentinel);
  });

  it('does not mistake code in quotes or comments as source declarations', () => {
    const source = 'print("funcra record variant");\n// funcra fake\nfuncra real() {}';
    const report = inspectScarpWorkspace([doc('main.srp',source)],
      listed('main.srp'),roots,null);
    expect(report.totals.functions).toBe(1);
    expect(report.totals.records).toBe(0);
    expect(report.totals.variants).toBe(0);
  });

  it('produces deterministic independent summaries', () => {
    const a = doc('main.srp','funcra main() {}\n');
    const one = inspectScarpWorkspace([a],listed('main.srp'),roots,'main.srp');
    const two = inspectScarpWorkspace([a],listed('main.srp'),roots,'main.srp');
    expect(one).toEqual(two);
    expect(one.entries).not.toBe(two.entries);
    expect(a.content).toBe('funcra main() {}\n');
  });
});

describe('Workspace Overview filtering and safe navigation', () => {
  const source = [
    doc('a.srp','// TODO: improvement'),
    doc('b.srp','print(1);','print(0);'),
    doc('c.srp','funcra bad() {'),
  ];
  const report = inspectScarpWorkspace(source,
    listed('a.srp','b.srp','c.srp'),roots,source[0].id);
  it('filters comment tasks, modified buffers and structural review items', () => {
    const tasks = filterWorkspaceInsightEntries(report.entries,
      { scope:'tasks',search:'',order:'name' });
    expect(tasks.map(e=>e.documentId)).toEqual(['a.srp']);
    const modified = filterWorkspaceInsightEntries(report.entries,
      { scope:'modified',search:'',order:'name' });
    expect(modified.map(e=>e.documentId)).toEqual(['b.srp']);
    const review = filterWorkspaceInsightEntries(report.entries,
      { scope:'review',search:'',order:'name' });
    expect(review.map(e=>e.documentId)).toEqual(['c.srp']);
  });

  it('supports substring search and preserves original report ordering', () => {
    const result = filterWorkspaceInsightEntries(report.entries,
      { scope:'all',search:'b.srp',order:'name' });
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe('b.srp');
    expect(report.entries[0].active).toBe(true);
  });

  it('never treats search input as an executable regular expression', () => {
    expect(filterWorkspaceInsightEntries(report.entries,
      { scope:'all',search:'[',order:'name' })).toEqual([]);
    expect(filterWorkspaceInsightEntries(report.entries,
      { scope:'all',search:'x'.repeat(121),order:'name' })).toEqual([]);
  });

  it('only returns a source tab ID while it is still open', () => {
    const item = report.entries[0];
    expect(workspaceInsightNavigationTarget(item,source)).toBe(item.documentId);
    expect(workspaceInsightNavigationTarget(item,[])).toBeNull();
  });
});
