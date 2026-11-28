import { describe,it,expect } from 'vitest';
import { collectGovernanceFacts,evaluateGovernancePolicy,createGovernanceProfile,GOVERNANCE_METRICS } from './workspaceArchitectureGovernance';
import { evaluateArchitectureScenario } from './workspaceArchitectureScenario';
import { architectureFixture } from '../test/workspaceArchitectureGovernanceFixtures';
describe('governance invariants',()=>{
  it("determinism and non-negative 0", () => {
    const architecture=architectureFixture({modules:1,unresolved:0,ambiguous:0,unmatched:0,importCycles:0,callCycles:0,hotspots:0,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i0',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 1", () => {
    const architecture=architectureFixture({modules:2,unresolved:1,ambiguous:1,unmatched:1,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i1',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 2", () => {
    const architecture=architectureFixture({modules:3,unresolved:2,ambiguous:2,unmatched:2,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i2',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 3", () => {
    const architecture=architectureFixture({modules:4,unresolved:3,ambiguous:3,unmatched:3,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i3',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 4", () => {
    const architecture=architectureFixture({modules:5,unresolved:4,ambiguous:4,unmatched:4,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i4',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 5", () => {
    const architecture=architectureFixture({modules:6,unresolved:0,ambiguous:5,unmatched:5,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i5',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 6", () => {
    const architecture=architectureFixture({modules:7,unresolved:1,ambiguous:6,unmatched:6,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i6',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 7", () => {
    const architecture=architectureFixture({modules:8,unresolved:2,ambiguous:0,unmatched:7,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i7',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 8", () => {
    const architecture=architectureFixture({modules:9,unresolved:3,ambiguous:1,unmatched:8,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i8',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 9", () => {
    const architecture=architectureFixture({modules:10,unresolved:4,ambiguous:2,unmatched:0,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i9',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 10", () => {
    const architecture=architectureFixture({modules:11,unresolved:0,ambiguous:3,unmatched:1,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i10',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 11", () => {
    const architecture=architectureFixture({modules:12,unresolved:1,ambiguous:4,unmatched:2,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i11',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 12", () => {
    const architecture=architectureFixture({modules:1,unresolved:2,ambiguous:5,unmatched:3,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i12',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 13", () => {
    const architecture=architectureFixture({modules:2,unresolved:3,ambiguous:6,unmatched:4,importCycles:1,callCycles:1,hotspots:1,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i13',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 14", () => {
    const architecture=architectureFixture({modules:3,unresolved:4,ambiguous:0,unmatched:5,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i14',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 15", () => {
    const architecture=architectureFixture({modules:4,unresolved:0,ambiguous:1,unmatched:6,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i15',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 16", () => {
    const architecture=architectureFixture({modules:5,unresolved:1,ambiguous:2,unmatched:7,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i16',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 17", () => {
    const architecture=architectureFixture({modules:6,unresolved:2,ambiguous:3,unmatched:8,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i17',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 18", () => {
    const architecture=architectureFixture({modules:7,unresolved:3,ambiguous:4,unmatched:0,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i18',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 19", () => {
    const architecture=architectureFixture({modules:8,unresolved:4,ambiguous:5,unmatched:1,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i19',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 20", () => {
    const architecture=architectureFixture({modules:9,unresolved:0,ambiguous:6,unmatched:2,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i20',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 21", () => {
    const architecture=architectureFixture({modules:10,unresolved:1,ambiguous:0,unmatched:3,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i21',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 22", () => {
    const architecture=architectureFixture({modules:11,unresolved:2,ambiguous:1,unmatched:4,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i22',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 23", () => {
    const architecture=architectureFixture({modules:12,unresolved:3,ambiguous:2,unmatched:5,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i23',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 24", () => {
    const architecture=architectureFixture({modules:1,unresolved:4,ambiguous:3,unmatched:6,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i24',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 25", () => {
    const architecture=architectureFixture({modules:2,unresolved:0,ambiguous:4,unmatched:7,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i25',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 26", () => {
    const architecture=architectureFixture({modules:3,unresolved:1,ambiguous:5,unmatched:8,importCycles:2,callCycles:2,hotspots:2,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i26',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 27", () => {
    const architecture=architectureFixture({modules:4,unresolved:2,ambiguous:6,unmatched:0,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i27',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 28", () => {
    const architecture=architectureFixture({modules:5,unresolved:3,ambiguous:0,unmatched:1,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i28',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 29", () => {
    const architecture=architectureFixture({modules:6,unresolved:4,ambiguous:1,unmatched:2,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i29',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 30", () => {
    const architecture=architectureFixture({modules:7,unresolved:0,ambiguous:2,unmatched:3,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i30',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 31", () => {
    const architecture=architectureFixture({modules:8,unresolved:1,ambiguous:3,unmatched:4,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i31',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 32", () => {
    const architecture=architectureFixture({modules:9,unresolved:2,ambiguous:4,unmatched:5,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i32',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 33", () => {
    const architecture=architectureFixture({modules:10,unresolved:3,ambiguous:5,unmatched:6,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i33',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 34", () => {
    const architecture=architectureFixture({modules:11,unresolved:4,ambiguous:6,unmatched:7,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i34',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 35", () => {
    const architecture=architectureFixture({modules:12,unresolved:0,ambiguous:0,unmatched:8,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i35',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 36", () => {
    const architecture=architectureFixture({modules:1,unresolved:1,ambiguous:1,unmatched:0,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i36',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 37", () => {
    const architecture=architectureFixture({modules:2,unresolved:2,ambiguous:2,unmatched:1,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i37',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 38", () => {
    const architecture=architectureFixture({modules:3,unresolved:3,ambiguous:3,unmatched:2,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i38',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 39", () => {
    const architecture=architectureFixture({modules:4,unresolved:4,ambiguous:4,unmatched:3,importCycles:0,callCycles:3,hotspots:3,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i39',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 40", () => {
    const architecture=architectureFixture({modules:5,unresolved:0,ambiguous:5,unmatched:4,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i40',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 41", () => {
    const architecture=architectureFixture({modules:6,unresolved:1,ambiguous:6,unmatched:5,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i41',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 42", () => {
    const architecture=architectureFixture({modules:7,unresolved:2,ambiguous:0,unmatched:6,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i42',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 43", () => {
    const architecture=architectureFixture({modules:8,unresolved:3,ambiguous:1,unmatched:7,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i43',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 44", () => {
    const architecture=architectureFixture({modules:9,unresolved:4,ambiguous:2,unmatched:8,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i44',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 45", () => {
    const architecture=architectureFixture({modules:10,unresolved:0,ambiguous:3,unmatched:0,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i45',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 46", () => {
    const architecture=architectureFixture({modules:11,unresolved:1,ambiguous:4,unmatched:1,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i46',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 47", () => {
    const architecture=architectureFixture({modules:12,unresolved:2,ambiguous:5,unmatched:2,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i47',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 48", () => {
    const architecture=architectureFixture({modules:1,unresolved:3,ambiguous:6,unmatched:3,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i48',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 49", () => {
    const architecture=architectureFixture({modules:2,unresolved:4,ambiguous:0,unmatched:4,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i49',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 50", () => {
    const architecture=architectureFixture({modules:3,unresolved:0,ambiguous:1,unmatched:5,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i50',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 51", () => {
    const architecture=architectureFixture({modules:4,unresolved:1,ambiguous:2,unmatched:6,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i51',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 52", () => {
    const architecture=architectureFixture({modules:5,unresolved:2,ambiguous:3,unmatched:7,importCycles:1,callCycles:0,hotspots:4,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i52',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 53", () => {
    const architecture=architectureFixture({modules:6,unresolved:3,ambiguous:4,unmatched:8,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i53',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 54", () => {
    const architecture=architectureFixture({modules:7,unresolved:4,ambiguous:5,unmatched:0,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i54',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 55", () => {
    const architecture=architectureFixture({modules:8,unresolved:0,ambiguous:6,unmatched:1,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i55',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 56", () => {
    const architecture=architectureFixture({modules:9,unresolved:1,ambiguous:0,unmatched:2,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i56',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 57", () => {
    const architecture=architectureFixture({modules:10,unresolved:2,ambiguous:1,unmatched:3,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i57',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 58", () => {
    const architecture=architectureFixture({modules:11,unresolved:3,ambiguous:2,unmatched:4,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i58',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 59", () => {
    const architecture=architectureFixture({modules:12,unresolved:4,ambiguous:3,unmatched:5,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i59',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 60", () => {
    const architecture=architectureFixture({modules:1,unresolved:0,ambiguous:4,unmatched:6,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i60',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 61", () => {
    const architecture=architectureFixture({modules:2,unresolved:1,ambiguous:5,unmatched:7,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i61',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 62", () => {
    const architecture=architectureFixture({modules:3,unresolved:2,ambiguous:6,unmatched:8,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i62',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 63", () => {
    const architecture=architectureFixture({modules:4,unresolved:3,ambiguous:0,unmatched:0,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i63',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 64", () => {
    const architecture=architectureFixture({modules:5,unresolved:4,ambiguous:1,unmatched:1,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i64',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 65", () => {
    const architecture=architectureFixture({modules:6,unresolved:0,ambiguous:2,unmatched:2,importCycles:2,callCycles:1,hotspots:5,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i65',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 66", () => {
    const architecture=architectureFixture({modules:7,unresolved:1,ambiguous:3,unmatched:3,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i66',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 67", () => {
    const architecture=architectureFixture({modules:8,unresolved:2,ambiguous:4,unmatched:4,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i67',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 68", () => {
    const architecture=architectureFixture({modules:9,unresolved:3,ambiguous:5,unmatched:5,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i68',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 69", () => {
    const architecture=architectureFixture({modules:10,unresolved:4,ambiguous:6,unmatched:6,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i69',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 70", () => {
    const architecture=architectureFixture({modules:11,unresolved:0,ambiguous:0,unmatched:7,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i70',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 71", () => {
    const architecture=architectureFixture({modules:12,unresolved:1,ambiguous:1,unmatched:8,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i71',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 72", () => {
    const architecture=architectureFixture({modules:1,unresolved:2,ambiguous:2,unmatched:0,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i72',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 73", () => {
    const architecture=architectureFixture({modules:2,unresolved:3,ambiguous:3,unmatched:1,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i73',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 74", () => {
    const architecture=architectureFixture({modules:3,unresolved:4,ambiguous:4,unmatched:2,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i74',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 75", () => {
    const architecture=architectureFixture({modules:4,unresolved:0,ambiguous:5,unmatched:3,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i75',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 76", () => {
    const architecture=architectureFixture({modules:5,unresolved:1,ambiguous:6,unmatched:4,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i76',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 77", () => {
    const architecture=architectureFixture({modules:6,unresolved:2,ambiguous:0,unmatched:5,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i77',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 78", () => {
    const architecture=architectureFixture({modules:7,unresolved:3,ambiguous:1,unmatched:6,importCycles:0,callCycles:2,hotspots:0,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i78',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 79", () => {
    const architecture=architectureFixture({modules:8,unresolved:4,ambiguous:2,unmatched:7,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i79',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 80", () => {
    const architecture=architectureFixture({modules:9,unresolved:0,ambiguous:3,unmatched:8,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i80',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 81", () => {
    const architecture=architectureFixture({modules:10,unresolved:1,ambiguous:4,unmatched:0,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i81',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 82", () => {
    const architecture=architectureFixture({modules:11,unresolved:2,ambiguous:5,unmatched:1,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i82',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 83", () => {
    const architecture=architectureFixture({modules:12,unresolved:3,ambiguous:6,unmatched:2,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i83',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 84", () => {
    const architecture=architectureFixture({modules:1,unresolved:4,ambiguous:0,unmatched:3,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i84',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 85", () => {
    const architecture=architectureFixture({modules:2,unresolved:0,ambiguous:1,unmatched:4,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i85',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 86", () => {
    const architecture=architectureFixture({modules:3,unresolved:1,ambiguous:2,unmatched:5,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i86',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 87", () => {
    const architecture=architectureFixture({modules:4,unresolved:2,ambiguous:3,unmatched:6,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i87',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 88", () => {
    const architecture=architectureFixture({modules:5,unresolved:3,ambiguous:4,unmatched:7,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i88',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 89", () => {
    const architecture=architectureFixture({modules:6,unresolved:4,ambiguous:5,unmatched:8,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i89',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 90", () => {
    const architecture=architectureFixture({modules:7,unresolved:0,ambiguous:6,unmatched:0,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i90',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 91", () => {
    const architecture=architectureFixture({modules:8,unresolved:1,ambiguous:0,unmatched:1,importCycles:1,callCycles:3,hotspots:1,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i91',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 92", () => {
    const architecture=architectureFixture({modules:9,unresolved:2,ambiguous:1,unmatched:2,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i92',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 93", () => {
    const architecture=architectureFixture({modules:10,unresolved:3,ambiguous:2,unmatched:3,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i93',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 94", () => {
    const architecture=architectureFixture({modules:11,unresolved:4,ambiguous:3,unmatched:4,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i94',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 95", () => {
    const architecture=architectureFixture({modules:12,unresolved:0,ambiguous:4,unmatched:5,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i95',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 96", () => {
    const architecture=architectureFixture({modules:1,unresolved:1,ambiguous:5,unmatched:6,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i96',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 97", () => {
    const architecture=architectureFixture({modules:2,unresolved:2,ambiguous:6,unmatched:7,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i97',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 98", () => {
    const architecture=architectureFixture({modules:3,unresolved:3,ambiguous:0,unmatched:8,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i98',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 99", () => {
    const architecture=architectureFixture({modules:4,unresolved:4,ambiguous:1,unmatched:0,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i99',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 100", () => {
    const architecture=architectureFixture({modules:5,unresolved:0,ambiguous:2,unmatched:1,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i100',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 101", () => {
    const architecture=architectureFixture({modules:6,unresolved:1,ambiguous:3,unmatched:2,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i101',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 102", () => {
    const architecture=architectureFixture({modules:7,unresolved:2,ambiguous:4,unmatched:3,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i102',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 103", () => {
    const architecture=architectureFixture({modules:8,unresolved:3,ambiguous:5,unmatched:4,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i103',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 104", () => {
    const architecture=architectureFixture({modules:9,unresolved:4,ambiguous:6,unmatched:5,importCycles:2,callCycles:0,hotspots:2,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i104',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 105", () => {
    const architecture=architectureFixture({modules:10,unresolved:0,ambiguous:0,unmatched:6,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i105',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 106", () => {
    const architecture=architectureFixture({modules:11,unresolved:1,ambiguous:1,unmatched:7,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i106',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 107", () => {
    const architecture=architectureFixture({modules:12,unresolved:2,ambiguous:2,unmatched:8,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i107',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 108", () => {
    const architecture=architectureFixture({modules:1,unresolved:3,ambiguous:3,unmatched:0,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i108',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 109", () => {
    const architecture=architectureFixture({modules:2,unresolved:4,ambiguous:4,unmatched:1,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i109',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 110", () => {
    const architecture=architectureFixture({modules:3,unresolved:0,ambiguous:5,unmatched:2,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i110',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 111", () => {
    const architecture=architectureFixture({modules:4,unresolved:1,ambiguous:6,unmatched:3,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i111',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 112", () => {
    const architecture=architectureFixture({modules:5,unresolved:2,ambiguous:0,unmatched:4,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i112',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 113", () => {
    const architecture=architectureFixture({modules:6,unresolved:3,ambiguous:1,unmatched:5,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i113',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 114", () => {
    const architecture=architectureFixture({modules:7,unresolved:4,ambiguous:2,unmatched:6,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i114',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 115", () => {
    const architecture=architectureFixture({modules:8,unresolved:0,ambiguous:3,unmatched:7,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i115',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 116", () => {
    const architecture=architectureFixture({modules:9,unresolved:1,ambiguous:4,unmatched:8,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i116',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 117", () => {
    const architecture=architectureFixture({modules:10,unresolved:2,ambiguous:5,unmatched:0,importCycles:0,callCycles:1,hotspots:3,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i117',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 118", () => {
    const architecture=architectureFixture({modules:11,unresolved:3,ambiguous:6,unmatched:1,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i118',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 119", () => {
    const architecture=architectureFixture({modules:12,unresolved:4,ambiguous:0,unmatched:2,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i119',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 120", () => {
    const architecture=architectureFixture({modules:1,unresolved:0,ambiguous:1,unmatched:3,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i120',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 121", () => {
    const architecture=architectureFixture({modules:2,unresolved:1,ambiguous:2,unmatched:4,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i121',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 122", () => {
    const architecture=architectureFixture({modules:3,unresolved:2,ambiguous:3,unmatched:5,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i122',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 123", () => {
    const architecture=architectureFixture({modules:4,unresolved:3,ambiguous:4,unmatched:6,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i123',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 124", () => {
    const architecture=architectureFixture({modules:5,unresolved:4,ambiguous:5,unmatched:7,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i124',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 125", () => {
    const architecture=architectureFixture({modules:6,unresolved:0,ambiguous:6,unmatched:8,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i125',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 126", () => {
    const architecture=architectureFixture({modules:7,unresolved:1,ambiguous:0,unmatched:0,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i126',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 127", () => {
    const architecture=architectureFixture({modules:8,unresolved:2,ambiguous:1,unmatched:1,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i127',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 128", () => {
    const architecture=architectureFixture({modules:9,unresolved:3,ambiguous:2,unmatched:2,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i128',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 129", () => {
    const architecture=architectureFixture({modules:10,unresolved:4,ambiguous:3,unmatched:3,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i129',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 130", () => {
    const architecture=architectureFixture({modules:11,unresolved:0,ambiguous:4,unmatched:4,importCycles:1,callCycles:2,hotspots:4,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i130',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 131", () => {
    const architecture=architectureFixture({modules:12,unresolved:1,ambiguous:5,unmatched:5,importCycles:2,callCycles:3,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i131',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 132", () => {
    const architecture=architectureFixture({modules:1,unresolved:2,ambiguous:6,unmatched:6,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i132',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 133", () => {
    const architecture=architectureFixture({modules:2,unresolved:3,ambiguous:0,unmatched:7,importCycles:1,callCycles:1,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i133',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 134", () => {
    const architecture=architectureFixture({modules:3,unresolved:4,ambiguous:1,unmatched:8,importCycles:2,callCycles:2,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i134',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 135", () => {
    const architecture=architectureFixture({modules:4,unresolved:0,ambiguous:2,unmatched:0,importCycles:0,callCycles:3,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i135',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 136", () => {
    const architecture=architectureFixture({modules:5,unresolved:1,ambiguous:3,unmatched:1,importCycles:1,callCycles:0,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i136',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 137", () => {
    const architecture=architectureFixture({modules:6,unresolved:2,ambiguous:4,unmatched:2,importCycles:2,callCycles:1,hotspots:5,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i137',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 138", () => {
    const architecture=architectureFixture({modules:7,unresolved:3,ambiguous:5,unmatched:3,importCycles:0,callCycles:2,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i138',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 139", () => {
    const architecture=architectureFixture({modules:8,unresolved:4,ambiguous:6,unmatched:4,importCycles:1,callCycles:3,hotspots:1,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i139',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 140", () => {
    const architecture=architectureFixture({modules:9,unresolved:0,ambiguous:0,unmatched:5,importCycles:2,callCycles:0,hotspots:2,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i140',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 141", () => {
    const architecture=architectureFixture({modules:10,unresolved:1,ambiguous:1,unmatched:6,importCycles:0,callCycles:1,hotspots:3,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i141',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 142", () => {
    const architecture=architectureFixture({modules:11,unresolved:2,ambiguous:2,unmatched:7,importCycles:1,callCycles:2,hotspots:4,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i142',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 143", () => {
    const architecture=architectureFixture({modules:12,unresolved:3,ambiguous:3,unmatched:8,importCycles:2,callCycles:3,hotspots:5,coverage:1});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i143',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
  it("determinism and non-negative 144", () => {
    const architecture=architectureFixture({modules:1,unresolved:4,ambiguous:4,unmatched:0,importCycles:0,callCycles:0,hotspots:0,coverage:0});
    const first=collectGovernanceFacts(architecture);
    const second=collectGovernanceFacts(architecture);
    expect(first).toEqual(second);
    for(const metric of GOVERNANCE_METRICS)expect(first.values[metric]).toBeGreaterThanOrEqual(0);
    expect(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict'))).toEqual(evaluateGovernancePolicy(architecture,createGovernanceProfile('strict')));
    const scenario=evaluateArchitectureScenario(architecture,{id:'i144',label:'i',removeModuleIds:[],suppressCallEdgeIds:[],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(scenario.after.values).toEqual(first.values);
  });
});
