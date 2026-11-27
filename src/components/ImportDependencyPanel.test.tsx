import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { ImportDependencyPanel } from './ImportDependencyPanel';
import { buildScarpImportGraph } from '../model/sourceImports';

describe('import dependency review initial presentation',()=>{
  it('starts collapsed and does not expose dependency data until requested',()=>{
    const graph=buildScarpImportGraph([],[]);
    const markup=renderToStaticMarkup(createElement(ImportDependencyPanel,{graph,activeId:null}));
    expect(markup).toContain('Review import dependencies');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('Unresolved/frontier edges');
  });
});
