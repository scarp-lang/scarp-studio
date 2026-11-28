import { sameProjectScope, MAX_SCOPE_REPORT_UNITS, type ProjectSearchScope } from './projectSearchScope';
import { validRelativeLabel } from './projectSearchComparison';
import { sameVerificationRules } from './verificationProfiles';
import {
  assessVerification, VERIFICATION_FILE_STATES, VERIFICATION_STATUS_LABELS,
  type ProjectVerificationPlan, type ProjectVerificationReport, type VerificationRule,
  type VerificationFileEvidence, type VerificationStatus, type VerificationExpectation,
} from './projectVerification';

export const MAX_VERIFICATION_BASELINES=8;
export const VERIFICATION_COMPARISON_PAGE_SIZE=15;
type Result<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):Result<never>=>({ok:false,error});
const count=(n:number)=>Number.isSafeInteger(n)&&n>=0;

export interface VerificationBaselineRule {
  readonly definition:VerificationRule;
  readonly status:VerificationStatus;
  readonly complete:boolean;
  readonly rows:readonly VerificationFileEvidence[];
}
export interface VerificationBaseline {
  readonly scope:ProjectSearchScope;
  readonly mode:ProjectVerificationReport['mode'];
  readonly selected:number;
  readonly listingLimited:boolean;
  readonly rules:readonly VerificationBaselineRule[];
}
/** Bind evidence to the exact reviewed plan, not mutable editor drafts.
 * Retain rule settings only in memory for compatibility checking. Export
 * never serializes queries, source snapshots, or native paths.
 */
export function captureVerificationBaseline(plan:ProjectVerificationPlan,report:ProjectVerificationReport):Result<VerificationBaseline>{
  const inspection=plan.inspection;
  if(report.mode!==inspection.settings.mode||report.listed!==inspection.listed||
    report.selected!==inspection.selected||report.excluded!==inspection.excluded||
    report.deferred!==inspection.deferred||report.withheld!==inspection.withheld||
    report.listingLimited!==inspection.settings.listingLimited||report.rules.length!==plan.rules.length||
    !count(report.bytes)||(report.status!=='completed'&&report.status!=='cancelled')){
    return fail('Verification report does not match the reviewed run.');
  }
  const expected=new Set(inspection.sources.map(source=>source.name));
  if(expected.size!==report.selected||[...expected].some(name=>!validRelativeLabel(name))){
    return fail('Reviewed source labels are inconsistent.');
  }
  const rules:VerificationBaselineRule[]=[];
  for(const [index,definition] of plan.rules.entries()){
    const evidence=report.rules[index];
    if(evidence.index!==index||evidence.name!==definition.name||
      evidence.expectation!==definition.expectation||evidence.rows.length!==expected.size){
      return fail('Verification rule evidence is inconsistent.');
    }
    const seen=new Set<string>();
    let matches=0,scanned=0,partial=0;
    const rows:VerificationFileEvidence[]=[];
    for(const row of evidence.rows){
      if(!expected.has(row.name)||seen.has(row.name)||!VERIFICATION_FILE_STATES.includes(row.state)||
        !['open-buffer','disk','none'].includes(row.origin)||!count(row.matches)){
        return fail('Verification file evidence is inconsistent.');
      }
      const searched=row.state==='scanned'||row.state==='partial';
      if((searched&&row.origin==='none')||(!searched&&row.matches!==0)||
        (row.state==='not-observed'&&row.origin!=='none')){
        return fail('Verification file coverage contradicts its counts.');
      }
      seen.add(row.name);
      matches+=row.matches;
      if(!count(matches))return fail('Verification counts exceed safe integer range.');
      if(row.state==='scanned')scanned++;
      if(row.state==='partial')partial++;
      rows.push(Object.freeze({name:row.name,origin:row.origin,state:row.state,matches:row.matches}));
    }
    const complete=report.status==='completed'&&!report.listingLimited&&!report.deferred&&!report.withheld&&scanned===report.selected;
    if(matches!==evidence.matches||scanned!==evidence.fullyScanned||partial!==evidence.partial||
      rows.length-scanned-partial!==evidence.unread||complete!==evidence.complete||
      evidence.status!==assessVerification(definition.expectation,matches,complete)){
      return fail('Verification rule totals contradict file evidence.');
    }
    rules.push(Object.freeze({
      definition:Object.freeze({name:definition.name,query:definition.query,expectation:definition.expectation,
        options:Object.freeze({...definition.options})}),
      status:evidence.status,complete,rows:Object.freeze(rows),
    }));
  }
  return {ok:true,value:Object.freeze({
    scope:Object.freeze({...inspection.settings.scope}),mode:report.mode,
    selected:report.selected,listingLimited:report.listingLimited,rules:Object.freeze(rules),
  })};
}

export interface VerificationComparisonRow {
  readonly name:string;
  readonly earlier:VerificationFileEvidence|null;
  readonly current:VerificationFileEvidence|null;
  readonly delta:number|null;
  readonly originChanged:boolean;
}
export interface VerificationRuleComparison {
  readonly index:number;
  readonly name:string;
  readonly expectation:VerificationExpectation;
  readonly earlierStatus:VerificationStatus;
  readonly currentStatus:VerificationStatus;
  readonly earlierComplete:boolean;
  readonly currentComplete:boolean;
  readonly comparable:number;
  readonly earlierMatches:number|null;
  readonly currentMatches:number|null;
  readonly delta:number|null;
  readonly earlierOnly:number;
  readonly currentOnly:number;
  readonly rows:readonly VerificationComparisonRow[];
}
export interface VerificationComparison {
  readonly rules:readonly VerificationRuleComparison[];
  readonly changedStatuses:number;
  readonly uncertainRules:number;
}
export function compareVerificationBaselines(earlier:VerificationBaseline,current:VerificationBaseline):Result<VerificationComparison>{
  if(earlier.mode!==current.mode)return fail('Use the same snapshot mode to compare verification runs.');
  if(!sameProjectScope(earlier.scope,current.scope))return fail('Use the same reviewed source scope.');
  if(!sameVerificationRules(earlier.rules.map(item=>item.definition),current.rules.map(item=>item.definition))){
    return fail('Use exactly the same ordered rule names, queries, flags and expectations.');
  }
  const rules=earlier.rules.map((before,index)=>{
    const after=current.rules[index];
    const a=new Map(before.rows.map(row=>[row.name,row]));
    const b=new Map(after.rows.map(row=>[row.name,row]));
    const names=[...new Set([...a.keys(),...b.keys()])].sort();
    let comparable=0,earlierMatches=0,currentMatches=0,earlierOnly=0,currentOnly=0;
    const rows=names.map(name=>{
      const left=a.get(name)??null,right=b.get(name)??null;
      if(!left)currentOnly++;
      if(!right)earlierOnly++;
      let delta:number|null=null;
      if(left?.state==='scanned'&&right?.state==='scanned'&&left.origin===right.origin){
        comparable++;
        earlierMatches+=left.matches;
        currentMatches+=right.matches;
        delta=right.matches-left.matches;
      }
      return Object.freeze({name,earlier:left,current:right,delta,
        originChanged:Boolean(left&&right&&left.origin!==right.origin)});
    });
    return Object.freeze({
      index,name:before.definition.name,expectation:before.definition.expectation,
      earlierStatus:before.status,currentStatus:after.status,
      earlierComplete:before.complete,currentComplete:after.complete,comparable,
      earlierMatches:comparable?earlierMatches:null,currentMatches:comparable?currentMatches:null,
      delta:comparable?currentMatches-earlierMatches:null,earlierOnly,currentOnly,rows:Object.freeze(rows),
    });
  });
  return {ok:true,value:Object.freeze({rules:Object.freeze(rules),
    changedStatuses:rules.filter(rule=>rule.earlierStatus!==rule.currentStatus).length,
    uncertainRules:rules.filter(rule=>!rule.earlierComplete||!rule.currentComplete).length,
  })};
}
export type VerificationComparisonFilter='all'|'changed'|'uncertain'|'earlier-only'|'current-only';
export function filterVerificationComparison(rule:VerificationRuleComparison,filter:VerificationComparisonFilter){
  return rule.rows.filter(row=>filter==='all'||
    (filter==='changed'&&(row.originChanged||(row.delta!==null&&row.delta!==0)))||
    (filter==='uncertain'&&row.delta===null)||
    (filter==='earlier-only'&&row.current===null)||
    (filter==='current-only'&&row.earlier===null));
}
export function pageVerificationComparison(rows:readonly VerificationComparisonRow[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/VERIFICATION_COMPARISON_PAGE_SIZE));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,rows:rows.slice((page-1)*VERIFICATION_COMPARISON_PAGE_SIZE,page*VERIFICATION_COMPARISON_PAGE_SIZE)};
}
export function verificationDeltaLabel(delta:number|null):string{
  return delta===null?'Not comparable':(delta>0?'+':'')+delta;
}
export function verificationComparisonReport(data:VerificationComparison,includeNames=false,includeLabels=false):string{
  const lines=[
    'Scarp Studio — verification comparison',
    'Same ordered literal rules and source scope; relative labels are not filesystem identities.',
    'Only fully scanned files with the same snapshot origin contribute count deltas.',
    'A status transition alone does not establish a source change.',
    'Changed expectation statuses: '+data.changedStatuses,
    'Rules with incomplete coverage in either run: '+data.uncertainRules,
  ];
  let units=lines.join('\n').length;
  const append=(line:string)=>{
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100)return false;
    lines.push(line);units+=line.length+1;return true;
  };
  for(const rule of data.rules){
    if(!append('Rule '+(rule.index+1)+(includeNames?' '+JSON.stringify(rule.name):'')+
      ': '+VERIFICATION_STATUS_LABELS[rule.earlierStatus]+' → '+VERIFICATION_STATUS_LABELS[rule.currentStatus]+
      '; comparable labels: '+rule.comparable+'; delta: '+verificationDeltaLabel(rule.delta)+
      '; earlier / current complete: '+rule.earlierComplete+' / '+rule.currentComplete)){
      lines.push('Additional rows omitted due to report size limit.');break;
    }
    if(!includeLabels)continue;
    for(const row of rule.rows){
      if(!append('  '+JSON.stringify(row.name)+' — '+verificationDeltaLabel(row.delta)+
        (row.originChanged?'; origin changed':'')+(!row.earlier?'; current only':!row.current?'; earlier only':''))){
        lines.push('Additional rows omitted due to report size limit.');return lines.join('\n');
      }
    }
  }
  return lines.join('\n');
}
