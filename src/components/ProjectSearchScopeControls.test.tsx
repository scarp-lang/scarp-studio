import { describe,expect,it,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectSearchScopeControls,ProjectSearchCoverage } from './ProjectSearchScopeControls';
import { DEFAULT_PROJECT_SEARCH_SCOPE } from '../model/projectSearchScope';
describe('project search scope controls',()=>{
  it('renders a collapsed scope without reading or exposing native paths',()=>{
    const onChange=vi.fn();
    const html=renderToStaticMarkup(<ProjectSearchScopeControls listed={[{name:'src/private.srp',path:'C:/private/root/src/private.srp'}]}
      scope={DEFAULT_PROJECT_SEARCH_SCOPE} busy={false} onChange={onChange}/>);
    expect(html).toContain('Configure project search scope');
    expect(html).toContain('Workspace root and descendants');
    expect(html).not.toContain('C:/private');
    expect(html).not.toContain('src/private.srp');
    expect(onChange).not.toHaveBeenCalled();
  });
  it('discloses incomplete coverage even before report expansion',()=>{
    const html=renderToStaticMarkup(<ProjectSearchCoverage summary={{scope:DEFAULT_PROJECT_SEARCH_SCOPE,listed:4,inScope:2,
      excluded:1,withheld:1,searched:1,skipped:1,hits:0,matchingFiles:0,incomplete:true,rows:[]}}/>);
    expect(html).toContain('1 listing entries were withheld');
    expect(html).toContain('Zero displayed matches does not prove');
    expect(html).toContain('Review search coverage report');
  });
});

describe('batched project search coverage',()=>{
  it('discloses deferred sources before expanding the coverage report',()=>{
    const html=renderToStaticMarkup(<ProjectSearchCoverage summary={{
      scope:{...DEFAULT_PROJECT_SEARCH_SCOPE,batch:2},listed:12,inScope:4,excluded:1,withheld:0,
      searched:4,skipped:0,hits:0,matchingFiles:0,incomplete:true,rows:[],
      batch:{index:2,total:3,candidates:11,deferred:7,first:5,last:8},
    }}/>);
    expect(html).toContain('Batch 2 of 3');
    expect(html).toContain('7 deferred to other batches');
    expect(html).toContain('Separate searches are not combined');
    expect(html).toContain('Zero displayed matches does not prove');
    expect(html).toContain('4 selected batch candidate(s)');
  });
  it('does not render deferred coverage for ordinary searches',()=>{
    const html=renderToStaticMarkup(<ProjectSearchCoverage summary={{
      scope:DEFAULT_PROJECT_SEARCH_SCOPE,listed:1,inScope:1,excluded:0,withheld:0,
      searched:1,skipped:0,hits:0,matchingFiles:0,incomplete:false,rows:[],
    }}/>);
    expect(html).not.toContain('deferred to other batches');
    expect(html).not.toContain('Coverage is incomplete');
  });
});
