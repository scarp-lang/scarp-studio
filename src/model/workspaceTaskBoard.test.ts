import { describe, expect, it } from 'vitest';
import {
  scanWorkspaceCommentTasks, filterWorkspaceTasks, groupWorkspaceTasks,
  currentWorkspaceTaskTarget, MAX_TASK_BOARD_DOCUMENTS,
  MAX_TASK_BOARD_ENTRIES,
} from './workspaceTaskBoard';
import type { StudioDocument } from './documents';
function doc(name:string,content:string,revision=0):StudioDocument {
  return {id:name,name,content,savedContent:content,revision,path:'C:/'+name};
}
const filter = {
  query:'',scope:'all' as const,activeId:null,
  priority:'all' as const,kind:'all' as const,sort:'source' as const,
};

describe('read-only workspace task board scanning',()=>{
  it('returns a complete empty report without inventing tasks',()=>{
    const report=scanWorkspaceCommentTasks([]);
    expect(report).toMatchObject({
      tasks:[],complete:true,totalFound:0,documentsExamined:0,
    });
  });
  it('collects real comment markers across open buffers but not strings',()=>{
    const list=[
      doc('a.srp','// TODO(a): write tests\nprint("// FIXME fake");'),
      doc('b.srp','// BUG: urgent\n// NOTE: read docs'),
    ];
    const report=scanWorkspaceCommentTasks(list);
    expect(report.complete).toBe(true);
    expect(report.tasks.map(e=>e.task.kind)).toEqual(['TODO','BUG','NOTE']);
    expect(report.tasks.map(e=>e.documentId)).toEqual(['a.srp','b.srp','b.srp']);
    expect(report).toMatchObject({high:1,normal:1,low:1,totalFound:3});
  });
  it('marks documents excluded beyond the tab limit',()=>{
    const items=Array.from({length:MAX_TASK_BOARD_DOCUMENTS+4},
      (_,i)=>doc('file'+i+'.srp','// TODO: '+i));
    const report=scanWorkspaceCommentTasks(items);
    expect(report.complete).toBe(false);
    expect(report.documentsExamined).toBe(MAX_TASK_BOARD_DOCUMENTS);
    expect(report.documentsSkipped).toBe(4);
  });
  it('caps displayed tasks while exposing incomplete status',()=>{
    const text=Array.from({length:MAX_TASK_BOARD_ENTRIES+12},
      (_,i)=>'// TODO: task '+i).join('\n');
    const sources=[doc('a.srp',text),doc('b.srp',text)];
    const report=scanWorkspaceCommentTasks(sources);
    expect(report.complete).toBe(false);
    expect(report.tasks.length).toBeLessThanOrEqual(MAX_TASK_BOARD_ENTRIES);
    expect(report.note).toContain('incomplete');
  });
  it('enforces aggregate source budget',()=>{
    const big='x'.repeat(512*1024);
    const list=Array.from({length:4},(_,i)=>doc('f'+i,big));
    const report=scanWorkspaceCommentTasks(list);
    expect(report.complete).toBe(false);
    expect(report.documentsSkipped).toBeGreaterThan(0);
  });
  it('does not scan closed tabs or files beyond the provided document array',()=>{
    expect(scanWorkspaceCommentTasks([doc('a.srp','// FIXME: bad')]).tasks)
      .toHaveLength(1);
    expect(scanWorkspaceCommentTasks([]).tasks).toEqual([]);
  });
});

describe('workspace task filtering, ordering and navigation',()=>{
  const list=[
    doc('a.srp','// TODO: improve\n// NOTE: later'),
    doc('b.srp','// FIXME: improve urgently'),
  ];
  const report=scanWorkspaceCommentTasks(list);
  it('filters current tab, priority, kind and query without regex evaluation',()=>{
    expect(filterWorkspaceTasks(report.tasks,{...filter,scope:'active',activeId:'a.srp'}))
      .toHaveLength(2);
    expect(filterWorkspaceTasks(report.tasks,{...filter,priority:'high'}))
      .toHaveLength(1);
    expect(filterWorkspaceTasks(report.tasks,{...filter,kind:'NOTE'}))
      .toHaveLength(1);
    expect(filterWorkspaceTasks(report.tasks,{...filter,query:'URGENTLY'}))
      .toHaveLength(1);
    expect(filterWorkspaceTasks(report.tasks,{...filter,query:'['}))
      .toEqual([]);
  });
  it('prioritizes urgent tasks without mutating original array',()=>{
    const sorted=filterWorkspaceTasks(report.tasks,{...filter,sort:'priority'});
    expect(sorted.map(x=>x.task.kind)).toEqual(['FIXME','TODO','NOTE']);
    expect(report.tasks[0].task.kind).toBe('TODO');
  });
  it('groups exact source tab identities in stable encounter order',()=>{
    const groups=groupWorkspaceTasks(report.tasks);
    expect(groups.map(g=>[g.documentId,g.tasks.length]))
      .toEqual([['a.srp',2],['b.srp',1]]);
  });
  it('navigates only to a current exact marker and editor revision',()=>{
    const target=currentWorkspaceTaskTarget(report.tasks[0],list);
    expect(target).toMatchObject({
      documentId:'a.srp',line:1,revision:0,
    });
    expect(currentWorkspaceTaskTarget(report.tasks[0],
      [doc('a.srp','// TODO: improve',1)])).toBeNull();
    expect(currentWorkspaceTaskTarget(report.tasks[0],[])).toBeNull();
  });
  it('rejects a marker converted to an inert string after index creation',()=>{
    const replaced=doc('a.srp','print("TODO: improve");');
    expect(currentWorkspaceTaskTarget(report.tasks[0],[replaced])).toBeNull();
  });
  it('repeated indexing is immutable and deterministic',()=>{
    const a=scanWorkspaceCommentTasks(list),b=scanWorkspaceCommentTasks(list);
    expect(a).toEqual(b);
    expect(a.tasks).not.toBe(b.tasks);
    expect(list[0].content).toBe('// TODO: improve\n// NOTE: later');
  });
});
