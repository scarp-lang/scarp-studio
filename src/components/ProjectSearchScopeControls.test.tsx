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
