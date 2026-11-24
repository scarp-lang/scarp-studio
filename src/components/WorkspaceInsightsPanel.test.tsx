import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { WorkspaceInsightsPanel } from './WorkspaceInsightsPanel';
import type { StudioDocument } from '../model/documents';

function doc(name: string, content: string, saved = content): StudioDocument {
  return {id:name,name,path:'C:/Workspace/'+name,content,savedContent:saved,revision:0};
}
const sources = [
  {name:'main.srp',path:'C:/Workspace/main.srp'},
  {name:'loops/main.srp',path:'C:/Workspace/loops/main.srp'},
];
const roots = [
  {directory:'',path:'C:/Workspace'},
  {directory:'loops',path:'C:/Workspace/loops'},
];
function render(options: Partial<Parameters<typeof WorkspaceInsightsPanel>[0]> = {}) {
  return renderToStaticMarkup(createElement(WorkspaceInsightsPanel,{
    documents:[doc('main.srp','funcra main() {}')],
    listed:sources,roots,activeId:'main.srp',busy:false,onActivate:()=>{},
    initiallyExpanded:true,...options,
  }));
}
describe('Workspace Overview UI',()=>{
  it('avoids scanning and rendering when collapsed',()=>{
    const html = render({initiallyExpanded:false});
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('<dt>Functions</dt>');
  });
  it('aggregates in-memory sources and names their discovered project',()=>{
    const html = render({
      documents:[
        doc('main.srp','funcra main() {}'),
        doc('main.srp2','// FIXME: task'),
        doc('loops/main.srp','funcra loop() {}'),
      ],
    });
    expect(html).toContain('WORKSPACE OVERVIEW');
    expect(html).toContain('Open sources by project');
    expect(html).toContain('Workspace project root');
    expect(html).toContain('loops/');
    expect(html).toContain('Filter open workspace source summaries');
  });
  it('labels modified buffers without attempting any disk write',()=>{
    const html = render({documents:[doc('main.srp','print(2);','print(1);')]});
    expect(html).toContain('modified');
    expect(html).toContain('Read-only open-buffer summary');
  });
  it('renders an empty workspace without invented files',()=>{
    const html = render({documents:[],activeId:null});
    expect(html).toContain('No open Scarp sources');
    expect(html).not.toContain('workspace-source-row');
  });
  it('escapes user source names before rendering',()=>{
    const source = doc('<script>.srp','print("safe");');
    const html = render({documents:[source],listed:[]});
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('disables tab selection while a native task is active',()=>{
    const html = render({busy:true});
    expect(html).toContain('disabled=""');
  });
  it('marks source work budgets and prevents claiming a complete audit',()=>{
    const html = render({documents:[doc('main.srp','x'.repeat(512*1024+1))]});
    expect(html).toContain('analysis is incomplete');
  });
});
