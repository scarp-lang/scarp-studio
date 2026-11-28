import type { ArchitectureRiskLevel, WorkspaceArchitecture } from './workspaceArchitecture';

/** Read-only policy evaluation over the bounded WorkspaceArchitecture capture. */
export const MAX_GOVERNANCE_RULES = 96;
export const MAX_GOVERNANCE_LABEL_UNITS = 120;
export const GOVERNANCE_METRICS = [
  'modules','symbols','functions','call-sites','call-edges','import-edges',
  'unresolved-imports','ambiguous-calls','unmatched-calls','import-cycles','call-cycles',
  'orphan-modules','isolated-modules','entrypoints','high-risk-hotspots','critical-hotspots','coverage-gaps',
] as const;
export type GovernanceMetric = typeof GOVERNANCE_METRICS[number];
export type GovernanceComparator = '<=' | '>=' | '==' | '<' | '>';
export type GovernanceSeverity = 'info' | 'warning' | 'error';
export type GovernanceProfileId = 'exploratory' | 'balanced' | 'strict';
export interface GovernanceFacts { readonly generation:string; readonly complete:boolean; readonly values:Readonly<Record<GovernanceMetric,number>>; }
export interface GovernanceRule { readonly id:string; readonly metric:GovernanceMetric; readonly comparator:GovernanceComparator; readonly threshold:number; readonly severity:GovernanceSeverity; readonly label:string; readonly enabled:boolean; }
export interface GovernanceRuleIssue { readonly ruleId:string; readonly field:'id'|'metric'|'threshold'|'label'; readonly message:string; }
export interface GovernanceEvaluation { readonly rule:GovernanceRule; readonly actual:number; readonly passed:boolean; readonly distance:number; readonly ratio:number|null; readonly message:string; }
export interface GovernancePolicyResult { readonly facts:GovernanceFacts; readonly evaluations:readonly GovernanceEvaluation[]; readonly passed:number; readonly failed:number; readonly errors:number; readonly warnings:number; readonly infos:number; readonly verdict:'pass'|'warn'|'block'; readonly issues:readonly GovernanceRuleIssue[]; }

const DEFAULT_THRESHOLDS:Readonly<Record<GovernanceProfileId,Partial<Record<GovernanceMetric,number>>>>=Object.freeze({
  exploratory:Object.freeze({'unresolved-imports':12,'ambiguous-calls':24,'unmatched-calls':32,'import-cycles':6,'call-cycles':8,'orphan-modules':24,'critical-hotspots':4,'coverage-gaps':8}),
  balanced:Object.freeze({'unresolved-imports':4,'ambiguous-calls':8,'unmatched-calls':12,'import-cycles':2,'call-cycles':3,'orphan-modules':12,'critical-hotspots':1,'coverage-gaps':2}),
  strict:Object.freeze({'unresolved-imports':0,'ambiguous-calls':2,'unmatched-calls':4,'import-cycles':0,'call-cycles':1,'orphan-modules':6,'critical-hotspots':0,'coverage-gaps':0}),
});
const METRIC_LABELS:Readonly<Record<GovernanceMetric,string>>=Object.freeze({
  modules:'Observed modules',symbols:'Observed declarations',functions:'Observed functions','call-sites':'Observed call sites','call-edges':'Observed call candidates','import-edges':'Observed import edges',
  'unresolved-imports':'Unresolved imports','ambiguous-calls':'Ambiguous calls','unmatched-calls':'Unmatched calls','import-cycles':'Import cycles','call-cycles':'Call cycles','orphan-modules':'Orphan modules','isolated-modules':'Isolated modules',
  entrypoints:'Observed entrypoints','high-risk-hotspots':'High-risk hotspots','critical-hotspots':'Critical hotspots','coverage-gaps':'Coverage limitations',
});
function finiteNonNegative(value:number):number { return Number.isFinite(value)&&value>=0?value:0; }
function boundedLabel(value:string):string { const clean=value.trim().replace(/\s+/g,' '); return clean.length<=MAX_GOVERNANCE_LABEL_UNITS?clean:clean.slice(0,MAX_GOVERNANCE_LABEL_UNITS-1)+'…'; }
export function governanceMetricLabel(metric:GovernanceMetric):string { return METRIC_LABELS[metric]; }
export function collectGovernanceFacts(architecture:WorkspaceArchitecture):GovernanceFacts {
  const highRisk=architecture.hotspots.filter(item=>item.risk==='high').length;
  const criticalRisk=architecture.hotspots.filter(item=>item.risk==='critical').length;
  return Object.freeze({generation:architecture.generation,complete:architecture.summary.complete,values:Object.freeze({
    modules:architecture.summary.moduleCount,symbols:architecture.summary.symbolCount,functions:architecture.summary.functionCount,'call-sites':architecture.summary.callSiteCount,'call-edges':architecture.summary.callEdgeCount,'import-edges':architecture.summary.importEdgeCount,
    'unresolved-imports':architecture.summary.unresolvedImportEdgeCount,'ambiguous-calls':architecture.summary.ambiguousCallSiteCount,'unmatched-calls':architecture.summary.unmatchedCallSiteCount,'import-cycles':architecture.summary.importCycleCount,'call-cycles':architecture.summary.callCycleCount,
    'orphan-modules':architecture.summary.orphanModuleCount,'isolated-modules':architecture.summary.isolatedModuleCount,entrypoints:architecture.summary.entrypointCount,'high-risk-hotspots':highRisk,'critical-hotspots':criticalRisk,'coverage-gaps':architecture.coverageReasons.length,
  })});
}
function compare(actual:number,comparator:GovernanceComparator,threshold:number):boolean { switch(comparator){case '<=':return actual<=threshold;case '>=':return actual>=threshold;case '==':return actual===threshold;case '<':return actual<threshold;case '>':return actual>threshold;} }
function distance(actual:number,comparator:GovernanceComparator,threshold:number):number { if(compare(actual,comparator,threshold))return 0; switch(comparator){case '<=':case '<':return Math.max(0,actual-threshold);case '>=':case '>':return Math.max(0,threshold-actual);case '==':return Math.abs(actual-threshold);} }
export function normalizeGovernanceRule(rule:GovernanceRule):GovernanceRule { return Object.freeze({id:boundedLabel(rule.id)||'rule',metric:rule.metric,comparator:rule.comparator,threshold:finiteNonNegative(rule.threshold),severity:rule.severity,label:boundedLabel(rule.label)||governanceMetricLabel(rule.metric),enabled:Boolean(rule.enabled)}); }
export function validateGovernanceRules(rules:readonly GovernanceRule[]):GovernanceRuleIssue[] {
  const issues:GovernanceRuleIssue[]=[]; const seen=new Set<string>();
  for(const rule of rules.slice(0,MAX_GOVERNANCE_RULES)){
    if(!rule.id.trim())issues.push({ruleId:rule.id,field:'id',message:'Rule ID is required.'});
    if(seen.has(rule.id))issues.push({ruleId:rule.id,field:'id',message:'Rule ID must be unique.'}); seen.add(rule.id);
    if(!GOVERNANCE_METRICS.includes(rule.metric))issues.push({ruleId:rule.id,field:'metric',message:'Metric is not supported.'});
    if(!Number.isFinite(rule.threshold)||rule.threshold<0)issues.push({ruleId:rule.id,field:'threshold',message:'Threshold must be finite and non-negative.'});
    if(!rule.label.trim())issues.push({ruleId:rule.id,field:'label',message:'Rule label is required.'});
  }
  if(rules.length>MAX_GOVERNANCE_RULES)issues.push({ruleId:'*',field:'id',message:`Only the first ${MAX_GOVERNANCE_RULES} rules are evaluated.`});
  return issues;
}
export function createGovernanceProfile(profile:GovernanceProfileId):GovernanceRule[] {
  const thresholds=DEFAULT_THRESHOLDS[profile]; const severity:GovernanceSeverity=profile==='strict'?'error':'warning';
  return Object.entries(thresholds).map(([metric,threshold],index)=>Object.freeze({id:`${profile}-${index+1}-${metric}`,metric:metric as GovernanceMetric,comparator:'<=' as const,threshold:threshold??0,severity:metric==='coverage-gaps'||metric==='critical-hotspots'?'error' as const:severity,label:`${governanceMetricLabel(metric as GovernanceMetric)} budget`,enabled:true}));
}
export function evaluateGovernanceRule(facts:GovernanceFacts,input:GovernanceRule):GovernanceEvaluation {
  const rule=normalizeGovernanceRule(input); const actual=facts.values[rule.metric]; const passed=!rule.enabled||compare(actual,rule.comparator,rule.threshold);
  const ratio=rule.threshold>0?actual/rule.threshold:actual===0?0:null;
  const message=passed?`${rule.label}: ${actual} ${rule.comparator} ${rule.threshold}.`:`${rule.label}: observed ${actual}; expected ${rule.comparator} ${rule.threshold}.`;
  return Object.freeze({rule,actual,passed,distance:distance(actual,rule.comparator,rule.threshold),ratio,message});
}
export function evaluateGovernancePolicy(architecture:WorkspaceArchitecture,rules:readonly GovernanceRule[]):GovernancePolicyResult {
  const facts=collectGovernanceFacts(architecture); const issues=validateGovernanceRules(rules); const evaluations=rules.slice(0,MAX_GOVERNANCE_RULES).map(normalizeGovernanceRule).map(rule=>evaluateGovernanceRule(facts,rule));
  const failed=evaluations.filter(item=>!item.passed); const errors=failed.filter(item=>item.rule.severity==='error').length; const warnings=failed.filter(item=>item.rule.severity==='warning').length; const infos=failed.filter(item=>item.rule.severity==='info').length;
  const verdict=errors>0?'block':warnings>0||issues.length>0?'warn':'pass';
  return Object.freeze({facts,evaluations:Object.freeze(evaluations),passed:evaluations.length-failed.length,failed:failed.length,errors,warnings,infos,verdict,issues:Object.freeze(issues)});
}
export function governanceResultSummary(result:GovernancePolicyResult):string { return `${result.verdict.toUpperCase()} · ${result.passed}/${result.evaluations.length} rules pass · ${result.errors} errors · ${result.warnings} warnings`; }
export function governanceRiskWeight(risk:ArchitectureRiskLevel):number { return risk==='critical'?4:risk==='high'?3:risk==='medium'?2:1; }
