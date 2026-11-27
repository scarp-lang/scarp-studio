import { describe,expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectTestFailureDetails } from './ProjectTestFailureDetails';
import type { ScarpTestReport } from '../model/projectTestReport';
const report:ScarpTestReport={mode:'run',discovered:1,passed:0,failed:1,tests:[
  {path:'tests/private.srp',status:'failed',phase:'runtime',code:'E0065',message:'private detail',help:null}]};
describe('test failure inspection initial UI',()=>{
  it('exposes coverage without exposing selected detail or export before interaction',()=>{
    const html=renderToStaticMarkup(<ProjectTestFailureDetails report={report} historical={false}/>);
    expect(html).toContain('Inspect failure diagnostics');
    expect(html).toContain('0/1 full diagnostic envelopes validated');
    expect(html).not.toContain('private detail');
    expect(html).not.toContain('Reviewed test failure export');
  });
  it('omits the view for reports without failures',()=>{
    expect(renderToStaticMarkup(<ProjectTestFailureDetails report={{...report,mode:'list',failed:0,tests:[]}} historical={false}/>)).toBe('');
  });
});
