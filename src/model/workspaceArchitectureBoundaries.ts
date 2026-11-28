import type { ArchitectureCallEdge,ArchitectureImportEdge,ArchitectureModule,WorkspaceArchitecture } from './workspaceArchitecture';
export const MAX_BOUNDARY_ZONES=32; export const MAX_BOUNDARY_RULES=128; export const MAX_BOUNDARY_VIOLATIONS=512;
export type BoundaryEdgeKind='import'|'call'; export type BoundaryEffect='allow'|'deny';
export interface ArchitectureBoundaryZone { readonly id:string; readonly label:string; readonly prefixes:readonly string[]; }
export interface ArchitectureBoundaryRule { readonly id:string; readonly from:string; readonly to:string; readonly edgeKinds:readonly BoundaryEdgeKind[]; readonly effect:BoundaryEffect; readonly note:string; }
export interface ArchitectureBoundaryViolation { readonly id:string; readonly edgeKind:BoundaryEdgeKind; readonly edgeId:string; readonly fromModuleId:string; readonly toModuleId:string; readonly fromZone:string; readonly toZone:string; readonly ruleId:string|null; readonly message:string; }
export interface ArchitectureBoundaryResult { readonly violations:readonly ArchitectureBoundaryViolation[]; readonly checkedEdges:number; readonly classifiedModules:number; readonly unclassifiedModules:readonly string[]; readonly denied:number; readonly allowed:number; }
function normalizePath(value:string):string { return value.replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/+/g,'/').toLowerCase(); }
function moduleKey(module:ArchitectureModule):string { return normalizePath(module.listedName??module.path??module.name); }
export function architectureBoundaryZoneForModule(module:ArchitectureModule,zones:readonly ArchitectureBoundaryZone[]):ArchitectureBoundaryZone|null {
  const key=moduleKey(module); let best:{zone:ArchitectureBoundaryZone;length:number}|null=null;
  for(const zone of zones.slice(0,MAX_BOUNDARY_ZONES))for(const prefix of zone.prefixes){const normalized=normalizePath(prefix).replace(/\/$/,'');if(!normalized)continue;if(key===normalized||key.startsWith(normalized+'/'))if(!best||normalized.length>best.length)best={zone,length:normalized.length};}
  return best?.zone??null;
}
export function deriveArchitectureBoundaryZones(architecture:WorkspaceArchitecture):ArchitectureBoundaryZone[] {
  const roots=new Set<string>(); for(const module of architecture.modules){const key=normalizePath(module.listedName??module.name);roots.add(key.includes('/')?key.split('/')[0]:'(root)');}
  return [...roots].sort().slice(0,MAX_BOUNDARY_ZONES).map((root,index)=>Object.freeze({id:`zone-${index+1}-${root.replace(/[^a-z0-9-]+/g,'-')}`,label:root==='(root)'?'Root sources':root,prefixes:Object.freeze(root==='(root)'?['.']:[root])}));
}
function matchingRule(fromZone:string,toZone:string,kind:BoundaryEdgeKind,rules:readonly ArchitectureBoundaryRule[]):ArchitectureBoundaryRule|null {
  let best:ArchitectureBoundaryRule|null=null; let score=-1; for(const rule of rules.slice(0,MAX_BOUNDARY_RULES)){if(!rule.edgeKinds.includes(kind))continue;const fromMatch=rule.from==='*'||rule.from===fromZone,toMatch=rule.to==='*'||rule.to===toZone;if(!fromMatch||!toMatch)continue;const specificity=(rule.from==='*'?0:1)+(rule.to==='*'?0:1);if(specificity>score){best=rule;score=specificity;}} return best;
}
function edgeModules(edge:ArchitectureCallEdge|ArchitectureImportEdge):{from:string;to:string|null;kind:BoundaryEdgeKind} { return edge.kind==='call'?{from:edge.fromModuleId,to:edge.toModuleId,kind:'call'}:{from:edge.fromModuleId,to:edge.toModuleId,kind:'import'}; }
export function evaluateArchitectureBoundaries(architecture:WorkspaceArchitecture,zones:readonly ArchitectureBoundaryZone[],rules:readonly ArchitectureBoundaryRule[]):ArchitectureBoundaryResult {
  const zoneByModule=new Map<string,string>(),unclassified:string[]=[]; for(const module of architecture.modules){const zone=architectureBoundaryZoneForModule(module,zones);if(zone)zoneByModule.set(module.id,zone.id);else unclassified.push(module.id);}
  const violations:ArchitectureBoundaryViolation[]=[]; let checkedEdges=0,denied=0,allowed=0; const edges:(ArchitectureCallEdge|ArchitectureImportEdge)[]=[...architecture.importEdges,...architecture.callEdges];
  for(const edge of edges){const route=edgeModules(edge);if(!route.to)continue;const fromZone=zoneByModule.get(route.from),toZone=zoneByModule.get(route.to);if(!fromZone||!toZone||fromZone===toZone)continue;checkedEdges++;const rule=matchingRule(fromZone,toZone,route.kind,rules);if(rule?.effect==='allow'){allowed++;continue;}if(rule?.effect==='deny'||!rule){denied++;if(violations.length<MAX_BOUNDARY_VIOLATIONS)violations.push(Object.freeze({id:JSON.stringify(['boundary',route.kind,edge.id,fromZone,toZone]),edgeKind:route.kind,edgeId:edge.id,fromModuleId:route.from,toModuleId:route.to,fromZone,toZone,ruleId:rule?.id??null,message:rule?`${route.kind} edge crosses denied boundary ${fromZone} → ${toZone}.`:`${route.kind} edge crosses ${fromZone} → ${toZone} without an allow rule.`}));}}
  return Object.freeze({violations:Object.freeze(violations),checkedEdges,classifiedModules:zoneByModule.size,unclassifiedModules:Object.freeze(unclassified),denied,allowed});
}
export function architectureBoundarySummary(result:ArchitectureBoundaryResult):string { return `${result.violations.length} boundary violations · ${result.allowed} allowed crossings · ${result.unclassifiedModules.length} unclassified modules`; }
