import type {ListedSymbolReport,ListedSymbolSite} from './listedSymbolIndex';
import type {CallArgumentIssue} from '../language/scarpCallArguments';
import {MAX_OBSERVED_ARGUMENTS} from '../language/scarpCallArguments';
import {MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';

export const ARITY_STATUSES=['same-observed-count','different-observed-count','multiple-declarations','no-declaration','shape-unavailable','arguments-unavailable','coverage-incomplete','nested-or-shadowed'] as const;
export type ArityStatus=typeof ARITY_STATUSES[number];
export const ARITY_LABELS:Readonly<Record<ArityStatus,string>>=Object.freeze({
  'same-observed-count':'Same observed argument and parameter counts',
  'different-observed-count':'Different observed counts',
  'multiple-declarations':'Multiple observed function declarations',
  'no-declaration':'No observed function declaration',
  'shape-unavailable':'Declaration shape unavailable',
  'arguments-unavailable':'Argument observation unavailable',
  'coverage-incomplete':'Incomplete lexical coverage',
  'nested-or-shadowed':'Nested or non-function name candidate',
});
export interface ArityRow{
  readonly call:ListedSymbolSite;
  readonly status:ArityStatus;
  readonly count:number|null;
  readonly explicitTypeCount:number|null;
  readonly expected:number|null;
  readonly issue:CallArgumentIssue|null;
  readonly candidates:readonly ListedSymbolSite[];
  readonly otherNameCandidates:number;
}
export interface ArityReview{
  readonly available:boolean;
  readonly complete:boolean;
  readonly rows:readonly ArityRow[];
  readonly counts:Readonly<Record<ArityStatus,number>>;
}
function emptyCounts():Record<ArityStatus,number>{
  return Object.fromEntries(ARITY_STATUSES.map(status=>[status,0])) as Record<ArityStatus,number>;
}
function compareText(a:string,b:string):number{return a<b?-1:a>b?1:0;}
function validCount(count:number):boolean{return Number.isSafeInteger(count)&&count>=0&&count<=MAX_OBSERVED_ARGUMENTS;}

/** Compare same-spelling observations, not resolved calls. Even a unique
 * same-file name may refer to an imported or shadowed function. Excluded
 * files, incomplete scans, or other name candidates prevent a count
 * comparison. The results are navigation/review cues, not diagnostics.
 */
export function buildArityReview(report:ListedSymbolReport):ArityReview{
  const counts=emptyCounts();
  if(!report.interfaces||!report.callArguments)return Object.freeze({
    available:false,complete:false,rows:Object.freeze([]),counts:Object.freeze(counts),
  });
  const declarations=new Map<string,ListedSymbolSite[]>();
  for(const site of report.declarations){
    const group=declarations.get(site.name)??[];
    group.push(site);declarations.set(site.name,group);
  }
  const shapes=new Map(report.interfaces.map(item=>[item.site.id,item]));
  const observed=new Map(report.callArguments.map(item=>[item.site.id,item]));
  const fullCoverage=report.complete&&report.excluded===0&&report.files.every(file=>file.state==='scanned');
  const rows:ArityRow[]=[];
  for(const call of report.calls){
    const evidence=observed.get(call.id);
    const valid=evidence?.site===call&&evidence.evidence.ok&&validCount(evidence.evidence.count);
    const count=valid&&evidence.evidence.ok?evidence.evidence.count:null;
    const explicitTypeCount=valid&&evidence.evidence.ok?evidence.evidence.explicitTypeCount:null;
    const issue=evidence&&!evidence.evidence.ok?evidence.evidence.issue:null;
    const names=declarations.get(call.name)??[];
    const candidates=Object.freeze(names.filter(site=>site.kind==='function'));
    const otherNameCandidates=names.length-candidates.length;
    let status:ArityStatus,expected:number|null=null;
    if(count===null)status='arguments-unavailable';
    else if(!fullCoverage)status='coverage-incomplete';
    else if(otherNameCandidates||candidates.some(site=>site.scope!=='top-level'))status='nested-or-shadowed';
    else if(candidates.length>1)status='multiple-declarations';
    else if(!candidates.length)status='no-declaration';
    else{
      const shape=shapes.get(candidates[0].id);
      if(!shape||shape.site!==candidates[0]||!shape.evidence.ok||!validCount(shape.evidence.shape.parameters.length))
        status='shape-unavailable';
      else{
        expected=shape.evidence.shape.parameters.length;
        status=count===expected?'same-observed-count':'different-observed-count';
      }
    }
    counts[status]++;
    rows.push(Object.freeze({call,status,count,explicitTypeCount,expected,issue,candidates,otherNameCandidates}));
  }
  return Object.freeze({available:true,complete:fullCoverage,rows:Object.freeze(rows),counts:Object.freeze(counts)});
}
export interface ArityFilter{
  readonly query:string;
  readonly source:string;
  readonly status:ArityStatus|'all';
  readonly order:'source'|'name'|'difference';
}
export const DEFAULT_ARITY_FILTER:ArityFilter=Object.freeze({query:'',source:'',status:'all',order:'source'});
export function filterArityReview(review:ArityReview,filter:ArityFilter):readonly ArityRow[]{
  if(filter.query.length>120||/[\x00-\x1f\x7f]/.test(filter.query))return [];
  const query=filter.query.trim().toLowerCase();
  const difference=(row:ArityRow)=>row.count!==null&&row.expected!==null?Math.abs(row.count-row.expected):-1;
  return review.rows.filter(row=>(!filter.source||row.call.source===filter.source)&&
    (filter.status==='all'||row.status===filter.status)&&
    (!query||[row.call.name,row.call.source,row.call.enclosing??''].join(' ').toLowerCase().includes(query)))
    .sort((a,b)=>(filter.order==='name'?compareText(a.call.name,b.call.name):
      filter.order==='difference'?difference(b)-difference(a):0)||
      compareText(a.call.source,b.call.source)||a.call.offset-b.call.offset);
}
export interface ArityNameGroup{
  readonly name:string;
  readonly calls:number;
  readonly observedCounts:readonly {readonly count:number;readonly calls:number}[];
  readonly unavailable:number;
  readonly differing:number;
}
export function groupArityByName(review:ArityReview):readonly ArityNameGroup[]{
  const byName=new Map<string,{calls:number;counts:Map<number,number>;unavailable:number;differing:number}>();
  for(const row of review.rows){
    const group=byName.get(row.call.name)??{calls:0,counts:new Map(),unavailable:0,differing:0};
    group.calls++;
    if(row.count===null)group.unavailable++;
    else group.counts.set(row.count,(group.counts.get(row.count)??0)+1);
    if(row.status==='different-observed-count')group.differing++;
    byName.set(row.call.name,group);
  }
  return Object.freeze([...byName].map(([name,group])=>Object.freeze({
    name,calls:group.calls,unavailable:group.unavailable,differing:group.differing,
    observedCounts:Object.freeze([...group.counts].sort(([a],[b])=>a-b).map(([count,calls])=>Object.freeze({count,calls}))),
  })).sort((a,b)=>b.differing-a.differing||b.calls-a.calls||compareText(a.name,b.name)));
}
export function arityReviewText(review:ArityReview,includeLabels=false,includeNames=false):string{
  const lines=['Scarp Studio — lexical call argument count review',
    'Candidate count comparisons only; not semantic resolution, compiler diagnostics, type checks, or contract validation.',
    'Coverage: '+(review.complete?'complete listed inventory':'incomplete or excluded sources'),
    'Call observations: '+review.rows.length,
    ...ARITY_STATUSES.map(status=>ARITY_LABELS[status]+': '+review.counts[status]),
    'No argument expressions, source text, native paths or declaration bodies are included.'];
  let units=lines.join('\n').length;
  if(includeLabels||includeNames)for(const [index,row] of review.rows.entries()){
    const line='Observation '+(index+1)+(includeLabels?' '+JSON.stringify(row.call.source)+':'+row.call.line+':'+row.call.column:'')+
      (includeNames?' '+JSON.stringify(row.call.name):'')+'; '+ARITY_LABELS[row.status]+
      '; observed: '+(row.count??'unknown')+'; candidate parameters: '+(row.expected??'unknown');
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100){lines.push('Additional observations omitted.');break;}
    lines.push(line);units+=line.length+1;
  }
  return lines.join('\n');
}
