import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CodeReferencesPanel } from './CodeReferencesPanel';
import type { StudioDocument } from '../model/documents';
const document:StudioDocument = {
  id:'main', name:'main.srp', path:'C:/main.srp', revision:1,
  content:'funcra item() {}\nitem();\nprint("item");\n// item',
  savedContent:'',
};
function render(props: Partial<Parameters<typeof CodeReferencesPanel>[0]> = {}) {
  return renderToStaticMarkup(createElement(CodeReferencesPanel,{
    documents:[document],activeId:'main',cursor:{line:2,column:1},
    busy:false,onNavigate:()=>{},initiallyExpanded:true,initialQuery:'item',
    ...props,
  }));
}
describe('open-buffer code references UI',()=>{
  it('is lazy/collapsed by default',()=>{
    const html=render({initiallyExpanded:false});
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('references-row');
  });
  it('shows lexical usages and declaration-like sites without strings/comments',()=>{
    const html=render();
    expect(html).toContain('2 code references');
    expect(html).toContain('declaration-like');
    expect(html).toContain('Go to reference');
    expect(html).toContain('Match case');
    expect(html).toContain('Current tab only');
  });
  it('shows no results before query without reading disk',()=>{
    const html=render({initialQuery:''});
    expect(html).toContain('No native files are searched');
    expect(html).not.toContain('references-row');
  });
  it('disables all navigation when native operations are busy',()=>{
    const html=render({busy:true});
    expect(html).toContain('disabled=""');
  });
  it('escapes raw source preview text and does not interpret markup',()=>{
    const other:StudioDocument={...document,content:'item("<script>");'};
    const html=render({documents:[other]});
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('reports invalid identifier queries without turning them into regex',()=>{
    const html=render({initialQuery:'[bad]'});
    expect(html).toContain('Enter a Scarp identifier');
    expect(html).not.toContain('Go to reference');
  });
  it('reports no matches for a legitimate absent identifier',()=>{
    const html=render({initialQuery:'unknown_token'});
    expect(html).toContain('No matching code identifiers');
  });
});
