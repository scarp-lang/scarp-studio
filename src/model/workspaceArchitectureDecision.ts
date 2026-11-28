import type { ArchitectureBoundaryResult } from './workspaceArchitectureBoundaries';
import type { ArchitectureBudgetResult } from './workspaceArchitectureBudgets';
import type { GovernancePolicyResult } from './workspaceArchitectureGovernance';
import type { GovernanceTrendAnalysis } from './workspaceArchitectureTrends';
export type ArchitectureDecisionVerdict='pass'|'review'|'block'; export type ArchitectureDecisionReasonKind='policy'|'budget'|'boundary'|'trend'|'coverage';
export interface ArchitectureDecisionReason { readonly kind:ArchitectureDecisionReasonKind; readonly severity:'info'|'warning'|'error'; readonly message:string; }
export interface ArchitectureGovernanceDecision { readonly verdict:ArchitectureDecisionVerdict; readonly score:number; readonly reasons:readonly ArchitectureDecisionReason[]; readonly blocking:number; readonly warnings:number; }
export interface ArchitectureDecisionOptions { readonly blockOnBoundaryViolation:boolean; readonly blockOnExceededBudget:boolean; readonly warnOnRegression:boolean; }
export const DEFAULT_ARCHITECTURE_DECISION_OPTIONS:ArchitectureDecisionOptions=Object.freeze({blockOnBoundaryViolation:true,blockOnExceededBudget:true,warnOnRegression:true});
export function decideArchitectureGovernance(policy:GovernancePolicyResult,budgets:ArchitectureBudgetResult,boundaries:ArchitectureBoundaryResult,trends:GovernanceTrendAnalysis|null,options:ArchitectureDecisionOptions=DEFAULT_ARCHITECTURE_DECISION_OPTIONS):ArchitectureGovernanceDecision {
  const reasons:ArchitectureDecisionReason[]=[];for(const evaluation of policy.evaluations.filter(item=>!item.passed))reasons.push(Object.freeze({kind:'policy',severity:evaluation.rule.severity,message:evaluation.message}));
  if(budgets.exceeded>0)reasons.push(Object.freeze({kind:'budget',severity:options.blockOnExceededBudget?'error':'warning',message:`${budgets.exceeded} architecture budgets are exceeded.`}));
  if(boundaries.violations.length>0)reasons.push(Object.freeze({kind:'boundary',severity:options.blockOnBoundaryViolation?'error':'warning',message:`${boundaries.violations.length} architecture boundary violations require review.`}));
  if(trends&&trends.regressions>0&&options.warnOnRegression)reasons.push(Object.freeze({kind:'trend',severity:'warning',message:`${trends.regressions} tracked architecture metrics are regressing.`}));
  if(!policy.facts.complete)reasons.push(Object.freeze({kind:'coverage',severity:'warning',message:'The bounded architecture capture is incomplete; governance conclusions are conservative.'}));
  const blocking=reasons.filter(item=>item.severity==='error').length,warnings=reasons.filter(item=>item.severity==='warning').length,verdict:ArchitectureDecisionVerdict=blocking?'block':warnings?'review':'pass';const penalty=blocking*20+warnings*7+Math.max(0,100-budgets.score)*0.25,score=Math.max(0,Math.min(100,Math.round(100-penalty)));
  return Object.freeze({verdict,score,reasons:Object.freeze(reasons.slice(0,128)),blocking,warnings});
}
export function architectureDecisionSummary(decision:ArchitectureGovernanceDecision):string { return `${decision.verdict.toUpperCase()} · score ${decision.score}/100 · ${decision.blocking} blocking · ${decision.warnings} warnings`; }
