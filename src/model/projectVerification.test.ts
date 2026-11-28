import { describe, expect, it, vi } from 'vitest';
import {
  validateVerificationRules, prepareProjectVerification, confirmProjectVerification,
  executeProjectVerification, assessVerification, filterVerificationFiles, pageVerificationFiles,
  verificationReportText, MAX_VERIFICATION_RULES, VERIFICATION_PAGE_SIZE,
  type VerificationRule, type VerificationControl, type ProjectVerificationPlan,
} from './projectVerification';
import { DEFAULT_PROJECT_SEARCH_SCOPE, MAX_SCOPE_REPORT_UNITS, PROJECT_SEARCH_BATCH_SIZE } from './projectSearchScope';
import { INSPECTION_READ_LIMITS, type InspectionSettings } from './projectInspection';
import { MAX_SEARCH_RESULTS } from './openFileSearch';
import { createUntitled } from './documents';

const settings: InspectionSettings = { scope: DEFAULT_PROJECT_SEARCH_SCOPE, mode: 'working', listingLimited: false };
const entry = (name: string) => ({ name, path: 'C:/private-root/' + name });
const entries = (count: number) => Array.from({length:count},(_,i)=>entry('src/file-'+String(i).padStart(3,'0')+'.srp'));
const rule = (name:string,query:string,expectation:VerificationRule['expectation']='observe',
  options={caseSensitive:true,wholeWord:false}):VerificationRule=>({name,query,expectation,options});
const rules = [rule('private-required','private-needle','present'),rule('private-forbidden','obsolete','absent'),rule('private-observe','TODO')];
const control:VerificationControl={isCurrent:()=>true,isCancelled:()=>false};
function plan(listed=entries(3),checks=rules,config=settings):ProjectVerificationPlan {
  const prepared=prepareProjectVerification(listed,config,checks);
  if(!prepared.ok)throw Error(prepared.error);
  return prepared.value;
}
async function run(p=plan(),read:(path:string,maxBytes:number)=>Promise<string>=async()=> 'private-needle TODO',
  docs=[] as ReturnType<typeof createUntitled>[],c=control){
  const result=await executeProjectVerification(p,docs,read,c);
  if(result.kind!=='report')throw Error('No verification report');
  return result.report;
}

describe('literal verification rule review',()=>{
  it('normalizes names and preserves literal query and flags',()=>{
    const result=validateVerificationRules([rule('  Name  ','  a.*[b]  ','present',{caseSensitive:false,wholeWord:true})],settings);
    expect(result).toMatchObject({ok:true,value:[{name:'Name',query:'  a.*[b]  ',expectation:'present',
      options:{caseSensitive:false,wholeWord:true}}]});
    if(result.ok)expect(Object.isFrozen(result.value[0].options)).toBe(true);
  });
  it('rejects invalid names, queries, duplicate names and excessive counts',()=>{
    for(const checks of [
      [],[rule('','x')],[rule('A','')],[rule('A','a\nb')],[rule('A','\u202eabc')],
      [rule('A','x'.repeat(121))],[rule('A','x'),rule(' a ','y')],
      Array.from({length:MAX_VERIFICATION_RULES+1},(_,i)=>rule('Rule '+i,'x')),
      [rule('A','x','invalid' as VerificationRule['expectation'])],
    ])expect(validateVerificationRules(checks,settings).ok).toBe(false);
  });
  it('pins rule ordering, expectations, flags and exact listed sources before execution',()=>{
    const listed=entries(3),p=plan(listed);
    expect(confirmProjectVerification(p,listed,settings,rules).ok).toBe(true);
    for(const changed of [
      [...rules].reverse(),rules.slice(1),[{...rules[0],expectation:'absent' as const},...rules.slice(1)],
      [{...rules[0],query:'different'},...rules.slice(1)],
      [{...rules[0],options:{caseSensitive:false,wholeWord:false}},...rules.slice(1)],
    ])expect(confirmProjectVerification(p,listed,settings,changed).ok).toBe(false);
    expect(confirmProjectVerification(p,listed.slice(1),settings,rules).ok).toBe(false);
    expect(confirmProjectVerification(p,listed,{...settings,mode:'saved'},rules).ok).toBe(false);
  });
});

describe('asymmetric evidence semantics',()=>{
  it.each([
    ['present',1,true,'pass'],['present',1,false,'pass'],['present',0,true,'fail'],['present',0,false,'inconclusive'],
    ['absent',1,true,'fail'],['absent',1,false,'fail'],['absent',0,true,'pass'],['absent',0,false,'inconclusive'],
    ['observe',0,true,'observed'],['observe',10,false,'observed'],
  ] as const)('assesses %s with %s matches and complete=%s as %s',(expectation,matches,complete,status)=>{
    expect(assessVerification(expectation,matches,complete)).toBe(status);
  });
  it('reads each selected file once regardless of rule count',async()=>{
    const read=vi.fn(async(_path:string,_limit:number)=>'private-needle TODO');
    const report=await run(plan(),read);
    expect(read).toHaveBeenCalledTimes(3);
    expect(report.rules.map(item=>item.status)).toEqual(['pass','pass','observed']);
    expect(report.rules.map(item=>item.matches)).toEqual([3,0,3]);
    expect(report.rules.every(item=>item.complete)).toBe(true);
    expect(JSON.stringify(report)).not.toContain('private-needle');
    expect(JSON.stringify(report)).not.toContain('C:/private-root');
    expect(Object.isFrozen(report.rules[0].rows)).toBe(true);
  });
  it('cannot prove zero when a read fails but still establishes observed presence',async()=>{
    const checks=[rule('Present','private-needle','present'),rule('Absent','obsolete','absent'),
      rule('Missing','missing','present'),rule('Observed forbidden','private-needle','absent')];
    const report=await run(plan(entries(3),checks),async path=>{
      if(path.endsWith('000.srp'))throw Error('private failure');
      return 'private-needle';
    });
    expect(report.rules.map(item=>item.status)).toEqual(['pass','inconclusive','inconclusive','fail']);
    expect(report.rules.every(item=>item.unread===1&&!item.complete)).toBe(true);
    expect(JSON.stringify(report)).not.toContain('private failure');
  });
  it('does not treat a bounded or deferred listing as conclusive absence',async()=>{
    const checks=[rule('Absent','missing','absent')];
    const bounded=await run(plan(entries(1),checks,{...settings,listingLimited:true}),async()=> '');
    expect(bounded.rules[0].status).toBe('inconclusive');
    const deferred=await run(plan(entries(PROJECT_SEARCH_BATCH_SIZE+1),checks,{...settings,scope:{...settings.scope,batch:1}}),async()=> '');
    expect(deferred.rules[0].status).toBe('inconclusive');
    expect(deferred.deferred).toBe(1);
  });
  it('applies independent per-file query budgets and matching options',async()=>{
    const checks=[rule('Dense','needle','present'),rule('Absent','missing','absent'),
      rule('Whole','cat','observe',{caseSensitive:false,wholeWord:true})];
    const report=await run(plan(entries(1),checks),async()=> 'needle '.repeat(MAX_SEARCH_RESULTS+1)+'CAT catfish cat');
    expect(report.rules[0]).toMatchObject({matches:MAX_SEARCH_RESULTS,status:'pass',partial:1,complete:false});
    expect(report.rules[1]).toMatchObject({matches:0,status:'pass',fullyScanned:1,complete:true});
    expect(report.rules[2]).toMatchObject({matches:2,fullyScanned:1});
  });
  it('uses working buffers once and disk-only mode ignores unsaved edits',async()=>{
    const listed=entries(2),checks=[rule('Present','working','present')];
    const doc={...createUntitled(1),path:listed[0].path,content:'working',savedContent:'saved'};
    const read=vi.fn(async()=> 'saved');
    const working=await run(plan(listed,checks),read,[doc]);
    expect(working.rules[0].status).toBe('pass');
    expect(read).toHaveBeenCalledTimes(1);
    const saved=await run(plan(listed,checks,{...settings,mode:'saved'}),read,[doc]);
    expect(saved.rules[0].status).toBe('fail');
    expect(read).toHaveBeenCalledTimes(3);
  });
  it('does not exceed per-file or aggregate budgets',async()=>{
    const read=vi.fn(async(_path:string,limit:number)=> 'x'.repeat(limit));
    const report=await run(plan(entries(10),[rule('Absent','missing','absent')]),read);
    expect(read).toHaveBeenCalledTimes(INSPECTION_READ_LIMITS.totalBytes/INSPECTION_READ_LIMITS.fileBytes);
    expect(report.bytes).toBe(INSPECTION_READ_LIMITS.totalBytes);
    expect(report.rules[0].unread).toBe(6);
    expect(report.rules[0].status).toBe('inconclusive');
  });
  it('keeps completed evidence after explicit cancellation but never invents zero counts',async()=>{
    let cancelled=false;
    const report=await run(plan(),async()=> 'private-needle TODO',[],{
      ...control,isCancelled:()=>cancelled,onProgress:p=>{if(p.observed===1)cancelled=true;},
    });
    expect(report.status).toBe('cancelled');
    expect(report.rules[0].status).toBe('pass');
    expect(report.rules[1].status).toBe('inconclusive');
    expect(report.rules[0].rows.slice(1).every(row=>row.state==='not-observed')).toBe(true);
  });
  it('discards evidence when the workspace generation changes during a read',async()=>{
    let current=true;
    const result=await executeProjectVerification(plan(),[],async()=>{current=false;return 'private-needle';},
      {...control,isCurrent:()=>current});
    expect(result).toEqual({kind:'invalidated'});
  });
  it('yields between files before reading, allowing immediate cancellation',async()=>{
    let cancelled=false;
    const read=vi.fn(async()=> '');
    const data=await run(plan(),read,[],{...control,isCancelled:()=>cancelled,
      yieldBetweenFiles:async()=>{cancelled=true;}});
    expect(read).not.toHaveBeenCalled();
    expect(data.status).toBe('cancelled');
  });
});

describe('literal verification evidence presentation',()=>{
  it('filters positive observations and incomplete files separately from fully scanned zeroes',async()=>{
    const checks=[rule('Observe','needle')];
    const data=await run(plan(entries(3),checks),async path=>{
      if(path.endsWith('000.srp'))throw Error('unavailable');
      return path.endsWith('001.srp')?'needle':'other';
    });
    const ruleData=data.rules[0];
    expect(filterVerificationFiles(ruleData,'matches').map(row=>row.matches)).toEqual([1]);
    expect(filterVerificationFiles(ruleData,'incomplete')[0].state).toBe('read-failed');
    expect(filterVerificationFiles(ruleData,'zero-scanned')[0].state).toBe('scanned');
  });
  it('bounds pages and independent report disclosures',async()=>{
    const data=await run(plan(entries(24)));
    expect(pageVerificationFiles(data.rules[0].rows,1).rows).toHaveLength(VERIFICATION_PAGE_SIZE);
    expect(pageVerificationFiles(data.rules[0].rows,999).page).toBe(2);
    expect(pageVerificationFiles([],NaN)).toEqual({pages:1,page:1,rows:[]});
    const plain=verificationReportText(data);
    expect(plain).not.toContain('private-required');
    expect(plain).not.toContain('src/file-000.srp');
    const names=verificationReportText(data,{includeRuleNames:true,includeSourceLabels:false});
    expect(names).toContain('private-required');
    expect(names).not.toContain('src/file-000.srp');
    const labels=verificationReportText(data,{includeRuleNames:false,includeSourceLabels:true});
    expect(labels).toContain('src/file-000.srp');
    expect(labels).not.toContain('private-required');
    for(const text of [plain,names,labels]){
      expect(text).not.toContain('private-needle');
      expect(text).not.toContain('C:/private-root');
    }
  });
  it('limits long optional labels in rule reports',async()=>{
    const listed=Array.from({length:24},(_,i)=>entry(i+'x'.repeat(900)+'.srp'));
    const data=await run(plan(listed));
    const text=verificationReportText(data,{includeRuleNames:true,includeSourceLabels:true});
    expect(text.length).toBeLessThanOrEqual(MAX_SCOPE_REPORT_UNITS);
    expect(text).toContain('Additional report rows omitted');
  });
});
