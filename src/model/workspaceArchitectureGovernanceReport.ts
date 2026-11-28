import type { ArchitectureBoundaryResult } from './workspaceArchitectureBoundaries';
import type { ArchitectureBudgetResult } from './workspaceArchitectureBudgets';
import type { ArchitectureGovernanceDecision } from './workspaceArchitectureDecision';
import type { GovernancePolicyResult } from './workspaceArchitectureGovernance';
import { governanceMetricLabel } from './workspaceArchitectureGovernance';
import type { GovernanceTrendAnalysis } from './workspaceArchitectureTrends';
export type ArchitectureGovernanceReportFormat='text'|'markdown'|'csv'|'json';
export interface ArchitectureGovernanceReport { readonly format:ArchitectureGovernanceReportFormat; readonly text:string; readonly rows:number; }
function csv(value:unknown):string { const text=String(value??'');return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text; }
function safe(value:string):string { return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,''); }
export function buildArchitectureGovernanceReport(policy:GovernancePolicyResult,budgets:ArchitectureBudgetResult,boundaries:ArchitectureBoundaryResult,trends:GovernanceTrendAnalysis|null,decision:ArchitectureGovernanceDecision,format:ArchitectureGovernanceReportFormat):ArchitectureGovernanceReport {
  const rows:{section:string;item:string;status:string;value:string}[]=[];rows.push({section:'summary',item:'decision',status:decision.verdict,value:String(decision.score)});
  for(const item of policy.evaluations)rows.push({section:'policy',item:item.rule.label,status:item.passed?'pass':item.rule.severity,value:`${item.actual} ${item.rule.comparator} ${item.rule.threshold}`});
  for(const item of budgets.usages)rows.push({section:'budget',item:governanceMetricLabel(item.budget.metric),status:item.status,value:`${item.actual}/${item.budget.limit}`});
  for(const item of boundaries.violations)rows.push({section:'boundary',item:`${item.fromZone} → ${item.toZone}`,status:'violation',value:item.edgeKind});
  if(trends)for(const item of trends.metrics)rows.push({section:'trend',item:governanceMetricLabel(item.metric),status:item.direction,value:`${item.first} → ${item.latest}`});
  let text='';if(format==='json')text=JSON.stringify({decision,policy:policy.evaluations,budgets:budgets.usages,boundaries:boundaries.violations,trends:trends?.metrics??[]},null,2);
  else if(format==='csv')text=['section,item,status,value',...rows.map(row=>[row.section,row.item,row.status,row.value].map(csv).join(','))].join('\n');
  else if(format==='markdown')text=[`# Architecture governance`,'',`**${decision.verdict.toUpperCase()} · ${decision.score}/100**`,'','| Section | Item | Status | Value |','|---|---|---|---|',...rows.map(row=>`| ${row.section} | ${row.item.replace(/\|/g,'\\|')} | ${row.status} | ${row.value.replace(/\|/g,'\\|')} |`)].join('\n');
  else text=[`ARCHITECTURE GOVERNANCE`,`${decision.verdict.toUpperCase()} · ${decision.score}/100`,'',...rows.map(row=>`[${row.section.toUpperCase()}] ${row.item} · ${row.status} · ${row.value}`)].join('\n');
  return Object.freeze({format,text:safe(text),rows:rows.length});
}
