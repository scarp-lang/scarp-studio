import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceTaskBoard } from './WorkspaceTaskBoard';
import type { StudioDocument } from '../model/documents';
function doc(id:string,content:string):StudioDocument {
  return {id,name:id,path:'C:/'+id,content,savedContent:content,revision:1};
}
const documents=[
  doc('main.srp','// TODO: improve\nfuncra main() {}'),
  doc('other.srp','// FIXME: urgent\n// NOTE: review'),
];
function render(props:Partial<Parameters<typeof WorkspaceTaskBoard>[0]>={}) {
  return renderToStaticMarkup(createElement(WorkspaceTaskBoard,{
    documents,activeId:'main.srp',busy:false,onNavigate:()=>{},
    initiallyExpanded:true,...props,
  }));
}
describe('read-only open-buffer Workspace Task Board',()=>{
  it('stays collapsed by default',()=>{
    const html=render({initiallyExpanded:false});
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('workspace-task-row');
  });
  it('lists each task with filename and real source line',()=>{
    const html=render();
    expect(html).toContain('WORKSPACE TASKS');
    expect(html).toContain('3 listed tasks');
    expect(html).toContain('main.srp:1');
    expect(html).toContain('other.srp:1');
    expect(html).toContain('Go to task');
  });
  it('exposes scope, priority, kind, sort and literal text filters',()=>{
    const html=render();
    expect(html).toContain('Search workspace comment tasks');
    expect(html).toContain('Workspace task scope');
    expect(html).toContain('Workspace task priority');
    expect(html).toContain('Workspace task marker kind');
    expect(html).toContain('Workspace task ordering');
  });
  it('never renders a comment marker as executable markup',()=>{
    const html=render({documents:[doc('x.srp','// FIXME: <script>oops</script>')]});
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('disables navigation while a native command is running',()=>{
    const html=render({busy:true});
    expect(html).toContain('disabled=""');
  });
  it('reports an empty opened-workspace task inventory',()=>{
    const html=render({documents:[],activeId:null});
    expect(html).toContain('No comment tasks in open Scarp buffers');
  });
  it('marks large or crowded source inventories incomplete',()=>{
    const html=render({documents:[doc('big.srp','x'.repeat(512*1024+1))]});
    expect(html).toContain('incomplete');
  });
});
