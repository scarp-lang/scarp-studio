import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { CompilerNavigationOverview } from './CompilerNavigationOverview';
import type { CompilerNavigationReport } from '../model/compilerNavigation';

describe('compiler navigation overview initial state',()=>{
  it('keeps summaries and private labels collapsed until explicitly requested',()=>{
    const report:CompilerNavigationReport={kind:'symbols',files:[{id:0,path:'C:/private/source.srp'}],symbols:[],references:[]};
    const html=renderToStaticMarkup(<CompilerNavigationOverview report={report} onChoose={()=>{throw Error('unexpected selection');}}/>);
    expect(html).toContain('Review inspection overview');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('C:/private');
    expect(html).not.toContain('Compiler inspection overview report');
  });
});
