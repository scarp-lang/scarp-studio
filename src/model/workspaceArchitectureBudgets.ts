import type { GovernanceFacts,GovernanceMetric } from './workspaceArchitectureGovernance';
import { GOVERNANCE_METRICS,governanceMetricLabel } from './workspaceArchitectureGovernance';
export const MAX_ARCHITECTURE_BUDGETS=64;
export type ArchitectureBudgetStatus='healthy'|'near'|'exceeded';
export interface ArchitectureBudget { readonly id:string; readonly metric:GovernanceMetric; readonly limit:number; readonly warningRatio:number; readonly enabled:boolean; }
export interface ArchitectureBudgetUsage { readonly budget:ArchitectureBudget; readonly actual:number; readonly remaining:number; readonly ratio:number; readonly status:ArchitectureBudgetStatus; readonly message:string; }
export interface ArchitectureBudgetResult { readonly usages:readonly ArchitectureBudgetUsage[]; readonly healthy:number; readonly near:number; readonly exceeded:number; readonly score:number; }
function clampRatio(value:number):number { return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0.8; }
function normalizeLimit(value:number):number { return Number.isFinite(value)&&value>=0?value:0; }
export function normalizeArchitectureBudget(budget:ArchitectureBudget):ArchitectureBudget { return Object.freeze({id:budget.id.trim()||`budget-${budget.metric}`,metric:budget.metric,limit:normalizeLimit(budget.limit),warningRatio:clampRatio(budget.warningRatio),enabled:Boolean(budget.enabled)}); }
export function createDefaultArchitectureBudgets():ArchitectureBudget[] {
  const limits:Partial<Record<GovernanceMetric,number>>={'unresolved-imports':4,'ambiguous-calls':8,'unmatched-calls':12,'import-cycles':2,'call-cycles':3,'orphan-modules':12,'isolated-modules':8,'high-risk-hotspots':6,'critical-hotspots':1,'coverage-gaps':2};
  return Object.entries(limits).map(([metric,limit])=>Object.freeze({id:`default-${metric}`,metric:metric as GovernanceMetric,limit:limit??0,warningRatio:0.75,enabled:true}));
}
export function evaluateArchitectureBudget(facts:GovernanceFacts,input:ArchitectureBudget):ArchitectureBudgetUsage {
  const budget=normalizeArchitectureBudget(input); const actual=facts.values[budget.metric]; const ratio=budget.limit===0?actual===0?0:Number.POSITIVE_INFINITY:actual/budget.limit;
  const status:ArchitectureBudgetStatus=!budget.enabled||actual<budget.limit*budget.warningRatio?'healthy':actual<=budget.limit?'near':'exceeded'; const remaining=Math.max(0,budget.limit-actual);
  return Object.freeze({budget,actual,remaining,ratio,status,message:`${governanceMetricLabel(budget.metric)}: ${actual}/${budget.limit} · ${status}.`});
}
export function evaluateArchitectureBudgets(facts:GovernanceFacts,budgets:readonly ArchitectureBudget[]):ArchitectureBudgetResult {
  const usages=budgets.slice(0,MAX_ARCHITECTURE_BUDGETS).map(item=>evaluateArchitectureBudget(facts,item)); const healthy=usages.filter(item=>item.status==='healthy').length; const near=usages.filter(item=>item.status==='near').length; const exceeded=usages.filter(item=>item.status==='exceeded').length;
  const weighted=usages.reduce((sum,item)=>sum+(item.status==='healthy'?1:item.status==='near'?0.5:0),0); const score=usages.length?Math.round(weighted/usages.length*100):100;
  return Object.freeze({usages:Object.freeze(usages),healthy,near,exceeded,score});
}
export function architectureBudgetSummary(result:ArchitectureBudgetResult):string { return `${result.score}% budget health · ${result.healthy} healthy · ${result.near} near · ${result.exceeded} exceeded`; }
export function isGovernanceMetric(value:string):value is GovernanceMetric { return GOVERNANCE_METRICS.includes(value as GovernanceMetric); }
