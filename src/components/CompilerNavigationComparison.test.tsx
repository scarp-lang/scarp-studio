import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { CompilerNavigationComparison } from './CompilerNavigationComparison';
describe('compiler inventory baseline UI',()=>{
  it('starts collapsed and never captures automatically',()=>{
    const html=renderToStaticMarkup(<CompilerNavigationComparison snapshot={{folder:'/private',report:{kind:'symbols',files:[],symbols:[],references:[]}}}
      baseline={null} onBaseline={()=>{throw Error('unexpected baseline capture');}}/>);
    expect(html).toContain('Compare compiler inventories');
    expect(html).not.toContain('Confirm inventory baseline capture');
    expect(html).not.toContain('/private');
  });
});
