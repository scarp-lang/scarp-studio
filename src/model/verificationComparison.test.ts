import {describe,expect,it} from 'vitest';
import {DEFAULT_PROJECT_SEARCH_SCOPE,MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';
import {prepareProjectVerification,executeProjectVerification,type VerificationRule,type ProjectVerificationPlan,
  type ProjectVerificationReport} from './projectVerification';
import {captureVerificationBaseline,compareVerificationBaselines,filterVerificationComparison,
  pageVerificationComparison,verificationComparisonReport,verificationDeltaLabel} from './verificationComparison';
import type {StudioDocument} from './documents';

const rule:VerificationRule={name:'Private rule name',query:'private-needle',expectation:'present',
  options:{caseSensitive:true,wholeWord:true}};
const settings:import('./projectInspection').InspectionSettings={scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working',listingLimited:false};
function value<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);
  return result.value;
}
function prepare(names=['src/a.srp','src/b.srp'],rules=[rule],config=settings){
  return value(prepareProjectVerification(names.map(name=>({name,path:'/private/'+name})),config,rules));
}
async function run(plan:ProjectVerificationPlan,contents:Record<string,string>,docs:readonly StudioDocument[]=[],
  cancelled=false):Promise<ProjectVerificationReport>{
  const result=await executeProjectVerification(plan,docs,async path=>{
    const content=contents[path.replace('/private/','')];
    if(content===undefined)throw Error('private read error');
    return content;
  },{isCurrent:()=>true,isCancelled:()=>cancelled});
  if(result.kind!=='report')throw Error('Expected report');
  return result.report;
}
async function baseline(plan:ProjectVerificationPlan,contents:Record<string,string>,docs:readonly StudioDocument[]=[]){
  return value(captureVerificationBaseline(plan,await run(plan,contents,docs)));
}
const a='src/a.srp',b='src/b.srp';
const needle=rule.query;

describe('verification baseline binding',()=>{
  it('copies only reviewed rule definitions and bounded evidence',async()=>{
    const plan=prepare();
    const report=await run(plan,{[a]:needle,[b]:'none'});
    const captured=value(captureVerificationBaseline(plan,report));
    expect(captured.rules[0].definition).toEqual(rule);
    expect(captured.rules[0].definition).not.toBe(plan.rules[0]);
    expect(captured.rules[0].rows).not.toBe(report.rules[0].rows);
    expect(captured.rules[0].rows[0]).not.toBe(report.rules[0].rows[0]);
    expect(Object.isFrozen(captured.rules[0].rows[0])).toBe(true);
    expect(JSON.stringify(captured)).not.toContain('/private/');
    expect(JSON.stringify(captured)).not.toContain('private read error');
  });
  it('refuses report metadata from another reviewed scope',async()=>{
    const plan=prepare();
    const report=await run(plan,{[a]:needle,[b]:''});
    for(const changed of [
      {...report,mode:'saved' as const},
      {...report,listed:999},
      {...report,selected:999},
      {...report,excluded:1},
      {...report,withheld:1},
      {...report,deferred:1},
      {...report,listingLimited:true},
      {...report,bytes:-1},
      {...report,rules:[]},
    ])expect(captureVerificationBaseline(plan,changed).ok).toBe(false);
  });
  it('refuses changed rule identity or aggregate evidence',async()=>{
    const plan=prepare();
    const report=await run(plan,{[a]:needle,[b]:''});
    const first=report.rules[0];
    for(const changed of [
      {...first,index:9},
      {...first,name:'Other'},
      {...first,expectation:'absent' as const},
      {...first,matches:99},
      {...first,fullyScanned:0},
      {...first,partial:2},
      {...first,unread:2},
      {...first,complete:false},
      {...first,status:'fail' as const},
      {...first,rows:[first.rows[0],first.rows[0]]},
      {...first,rows:[{...first.rows[0],name:'src/other.srp'},first.rows[1]]},
      {...first,rows:[{...first.rows[0],matches:-1},first.rows[1]]},
      {...first,rows:[{...first.rows[0],origin:'none' as const},first.rows[1]]},
    ])expect(captureVerificationBaseline(plan,{...report,rules:[changed]}).ok).toBe(false);
  });
  it('captures cancellation without inventing a complete negative result',async()=>{
    const plan=prepare();
    const report=await run(plan,{[a]:needle,[b]:needle},[],true);
    const captured=value(captureVerificationBaseline(plan,report));
    expect(captured.rules[0].status).toBe('inconclusive');
    expect(captured.rules[0].complete).toBe(false);
    expect(captured.rules[0].rows.every(row=>row.state==='not-observed')).toBe(true);
  });
});

describe('compatible verification comparisons',()=>{
  it('compares exact fully scanned labels and counts',async()=>{
    const plan=prepare();
    const before=await baseline(plan,{[a]:needle,[b]:''});
    const after=await baseline(plan,{[a]:needle+' '+needle,[b]:needle});
    const data=value(compareVerificationBaselines(before,after));
    expect(data.rules[0]).toMatchObject({comparable:2,earlierMatches:1,currentMatches:3,delta:2,
      earlierStatus:'pass',currentStatus:'pass'});
    expect(data.changedStatuses).toBe(0);
    expect(filterVerificationComparison(data.rules[0],'changed')).toHaveLength(2);
  });
  it('does not infer removals from unread labels',async()=>{
    const plan=prepare();
    const before=await baseline(plan,{[a]:needle,[b]:needle});
    const after=await baseline(plan,{[a]:''});
    const data=value(compareVerificationBaselines(before,after));
    expect(data.rules[0].currentStatus).toBe('inconclusive');
    expect(data.rules[0].delta).toBe(-1);
    expect(data.rules[0].comparable).toBe(1);
    expect(data.changedStatuses).toBe(1);
    expect(data.uncertainRules).toBe(1);
    expect(filterVerificationComparison(data.rules[0],'uncertain').map(row=>row.name)).toEqual([b]);
  });
  it('excludes changed source origins from count deltas',async()=>{
    const plan=prepare([a]);
    const before=await baseline(plan,{[a]:needle});
    const after=await baseline(plan,{},[{id:'open',name:a,path:'/private/'+a,
      content:needle+' '+needle,savedContent:needle,revision:1}]);
    const data=value(compareVerificationBaselines(before,after));
    expect(data.rules[0]).toMatchObject({comparable:0,delta:null});
    expect(data.rules[0].rows[0].originChanged).toBe(true);
    expect(filterVerificationComparison(data.rules[0],'changed')).toHaveLength(1);
  });
  it('shows scope membership changes separately from comparable counts',async()=>{
    const before=await baseline(prepare([a,b]),{[a]:needle,[b]:needle});
    const c='src/c.srp';
    const after=await baseline(prepare([a,c]),{[a]:needle,[c]:needle});
    const data=value(compareVerificationBaselines(before,after));
    expect(data.rules[0]).toMatchObject({comparable:1,delta:0,earlierOnly:1,currentOnly:1});
    expect(filterVerificationComparison(data.rules[0],'earlier-only').map(row=>row.name)).toEqual([b]);
    expect(filterVerificationComparison(data.rules[0],'current-only').map(row=>row.name)).toEqual([c]);
  });
  it('rejects incompatible rule definitions, scope and snapshot mode',async()=>{
    const before=await baseline(prepare(),{[a]:needle,[b]:''});
    const different:VerificationRule[]=[
      {...rule,query:'different'},
      {...rule,name:'Renamed'},
      {...rule,expectation:'absent'},
      {...rule,options:{...rule.options,wholeWord:false}},
      {...rule,options:{...rule.options,caseSensitive:false}},
    ];
    for(const changed of different){
      const after=await baseline(prepare([a,b],[changed]),{[a]:needle,[b]:''});
      expect(compareVerificationBaselines(before,after).ok).toBe(false);
    }
    const saved=await baseline(prepare([a,b],[rule],{...settings,mode:'saved'}),{[a]:needle,[b]:''});
    expect(compareVerificationBaselines(before,saved).ok).toBe(false);
    expect(compareVerificationBaselines(before,{...before,scope:{...before.scope,filename:'a.srp'}}).ok).toBe(false);
  });
  it('reports unknown rather than zero with no comparable observations',async()=>{
    const plan=prepare();
    const before=await baseline(plan,{});
    const after=await baseline(plan,{});
    const data=value(compareVerificationBaselines(before,after));
    expect(data.rules[0].delta).toBeNull();
    expect(data.rules[0].earlierMatches).toBeNull();
    expect(verificationDeltaLabel(null)).toBe('Not comparable');
    expect(verificationDeltaLabel(2)).toBe('+2');
    expect(verificationDeltaLabel(-2)).toBe('-2');
  });
  it('keeps query text and paths out of reports with separate label and name opt-ins',async()=>{
    const plan=prepare();
    const before=await baseline(plan,{[a]:needle,[b]:''});
    const after=await baseline(plan,{[a]:'',[b]:''});
    const data=value(compareVerificationBaselines(before,after));
    const plain=verificationComparisonReport(data);
    expect(plain).not.toContain(rule.name);
    expect(plain).not.toContain(a);
    expect(verificationComparisonReport(data,true,false)).toContain(rule.name);
    expect(verificationComparisonReport(data,false,true)).toContain(a);
    const full=verificationComparisonReport(data,true,true);
    expect(full).not.toContain(needle);
    expect(full).not.toContain('/private/');
    expect(full.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
  });
  it('bounds pages and never returns out-of-range page indexes',async()=>{
    const names=Array.from({length:20},(_,index)=>'src/'+index+'.srp');
    const plan=prepare(names);
    const contents=Object.fromEntries(names.map(name=>[name,needle]));
    const captured=await baseline(plan,contents);
    const data=value(compareVerificationBaselines(captured,captured));
    expect(pageVerificationComparison(data.rules[0].rows,-5).page).toBe(1);
    expect(pageVerificationComparison(data.rules[0].rows,999).page).toBe(2);
    expect(pageVerificationComparison(data.rules[0].rows,NaN).rows).toHaveLength(15);
    expect(pageVerificationComparison([],999)).toEqual({page:1,pages:1,rows:[]});
  });
});
