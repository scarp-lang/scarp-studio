import { describe,it,expect } from 'vitest';
import { evaluateArchitectureScenario,normalizeArchitectureScenario } from './workspaceArchitectureScenario';
import { architectureFixture } from '../test/workspaceArchitectureGovernanceFixtures';
describe('architecture scenarios',()=>{
  it("module and edge suppression 0", () => {
    const architecture=architectureFixture({modules:3,unresolved:0,ambiguous:0,unmatched:0,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s0',label:'scenario 0',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 1", () => {
    const architecture=architectureFixture({modules:4,unresolved:1,ambiguous:1,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s1',label:'scenario 1',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 2", () => {
    const architecture=architectureFixture({modules:5,unresolved:2,ambiguous:2,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s2',label:'scenario 2',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 3", () => {
    const architecture=architectureFixture({modules:6,unresolved:3,ambiguous:0,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s3',label:'scenario 3',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 4", () => {
    const architecture=architectureFixture({modules:7,unresolved:0,ambiguous:1,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s4',label:'scenario 4',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 5", () => {
    const architecture=architectureFixture({modules:8,unresolved:1,ambiguous:2,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s5',label:'scenario 5',removeModuleIds:['module:5'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 6", () => {
    const architecture=architectureFixture({modules:9,unresolved:2,ambiguous:0,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s6',label:'scenario 6',removeModuleIds:['module:6'],suppressCallEdgeIds:['call-edge:6'],suppressImportEdgeIds:['import:6'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 7", () => {
    const architecture=architectureFixture({modules:3,unresolved:3,ambiguous:1,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s7',label:'scenario 7',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 8", () => {
    const architecture=architectureFixture({modules:4,unresolved:0,ambiguous:2,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s8',label:'scenario 8',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 9", () => {
    const architecture=architectureFixture({modules:5,unresolved:1,ambiguous:0,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s9',label:'scenario 9',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 10", () => {
    const architecture=architectureFixture({modules:6,unresolved:2,ambiguous:1,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s10',label:'scenario 10',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 11", () => {
    const architecture=architectureFixture({modules:7,unresolved:3,ambiguous:2,unmatched:1,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s11',label:'scenario 11',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 12", () => {
    const architecture=architectureFixture({modules:8,unresolved:0,ambiguous:0,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s12',label:'scenario 12',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 13", () => {
    const architecture=architectureFixture({modules:9,unresolved:1,ambiguous:1,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s13',label:'scenario 13',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 14", () => {
    const architecture=architectureFixture({modules:3,unresolved:2,ambiguous:2,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s14',label:'scenario 14',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 15", () => {
    const architecture=architectureFixture({modules:4,unresolved:3,ambiguous:0,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s15',label:'scenario 15',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 16", () => {
    const architecture=architectureFixture({modules:5,unresolved:0,ambiguous:1,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s16',label:'scenario 16',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 17", () => {
    const architecture=architectureFixture({modules:6,unresolved:1,ambiguous:2,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s17',label:'scenario 17',removeModuleIds:['module:5'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 18", () => {
    const architecture=architectureFixture({modules:7,unresolved:2,ambiguous:0,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s18',label:'scenario 18',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 19", () => {
    const architecture=architectureFixture({modules:8,unresolved:3,ambiguous:1,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s19',label:'scenario 19',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 20", () => {
    const architecture=architectureFixture({modules:9,unresolved:0,ambiguous:2,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s20',label:'scenario 20',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 21", () => {
    const architecture=architectureFixture({modules:3,unresolved:1,ambiguous:0,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s21',label:'scenario 21',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 22", () => {
    const architecture=architectureFixture({modules:4,unresolved:2,ambiguous:1,unmatched:2,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s22',label:'scenario 22',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 23", () => {
    const architecture=architectureFixture({modules:5,unresolved:3,ambiguous:2,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s23',label:'scenario 23',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 24", () => {
    const architecture=architectureFixture({modules:6,unresolved:0,ambiguous:0,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s24',label:'scenario 24',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 25", () => {
    const architecture=architectureFixture({modules:7,unresolved:1,ambiguous:1,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s25',label:'scenario 25',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 26", () => {
    const architecture=architectureFixture({modules:8,unresolved:2,ambiguous:2,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s26',label:'scenario 26',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 27", () => {
    const architecture=architectureFixture({modules:9,unresolved:3,ambiguous:0,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s27',label:'scenario 27',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 28", () => {
    const architecture=architectureFixture({modules:3,unresolved:0,ambiguous:1,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s28',label:'scenario 28',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 29", () => {
    const architecture=architectureFixture({modules:4,unresolved:1,ambiguous:2,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s29',label:'scenario 29',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 30", () => {
    const architecture=architectureFixture({modules:5,unresolved:2,ambiguous:0,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s30',label:'scenario 30',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 31", () => {
    const architecture=architectureFixture({modules:6,unresolved:3,ambiguous:1,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s31',label:'scenario 31',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 32", () => {
    const architecture=architectureFixture({modules:7,unresolved:0,ambiguous:2,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s32',label:'scenario 32',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 33", () => {
    const architecture=architectureFixture({modules:8,unresolved:1,ambiguous:0,unmatched:3,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s33',label:'scenario 33',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 34", () => {
    const architecture=architectureFixture({modules:9,unresolved:2,ambiguous:1,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s34',label:'scenario 34',removeModuleIds:['module:7'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 35", () => {
    const architecture=architectureFixture({modules:3,unresolved:3,ambiguous:2,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s35',label:'scenario 35',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 36", () => {
    const architecture=architectureFixture({modules:4,unresolved:0,ambiguous:0,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s36',label:'scenario 36',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 37", () => {
    const architecture=architectureFixture({modules:5,unresolved:1,ambiguous:1,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s37',label:'scenario 37',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 38", () => {
    const architecture=architectureFixture({modules:6,unresolved:2,ambiguous:2,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s38',label:'scenario 38',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 39", () => {
    const architecture=architectureFixture({modules:7,unresolved:3,ambiguous:0,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s39',label:'scenario 39',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 40", () => {
    const architecture=architectureFixture({modules:8,unresolved:0,ambiguous:1,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s40',label:'scenario 40',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 41", () => {
    const architecture=architectureFixture({modules:9,unresolved:1,ambiguous:2,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s41',label:'scenario 41',removeModuleIds:['module:5'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 42", () => {
    const architecture=architectureFixture({modules:3,unresolved:2,ambiguous:0,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s42',label:'scenario 42',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 43", () => {
    const architecture=architectureFixture({modules:4,unresolved:3,ambiguous:1,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s43',label:'scenario 43',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 44", () => {
    const architecture=architectureFixture({modules:5,unresolved:0,ambiguous:2,unmatched:4,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s44',label:'scenario 44',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 45", () => {
    const architecture=architectureFixture({modules:6,unresolved:1,ambiguous:0,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s45',label:'scenario 45',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 46", () => {
    const architecture=architectureFixture({modules:7,unresolved:2,ambiguous:1,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s46',label:'scenario 46',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 47", () => {
    const architecture=architectureFixture({modules:8,unresolved:3,ambiguous:2,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s47',label:'scenario 47',removeModuleIds:['module:7'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 48", () => {
    const architecture=architectureFixture({modules:9,unresolved:0,ambiguous:0,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s48',label:'scenario 48',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 49", () => {
    const architecture=architectureFixture({modules:3,unresolved:1,ambiguous:1,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s49',label:'scenario 49',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 50", () => {
    const architecture=architectureFixture({modules:4,unresolved:2,ambiguous:2,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s50',label:'scenario 50',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 51", () => {
    const architecture=architectureFixture({modules:5,unresolved:3,ambiguous:0,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s51',label:'scenario 51',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 52", () => {
    const architecture=architectureFixture({modules:6,unresolved:0,ambiguous:1,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s52',label:'scenario 52',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 53", () => {
    const architecture=architectureFixture({modules:7,unresolved:1,ambiguous:2,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s53',label:'scenario 53',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 54", () => {
    const architecture=architectureFixture({modules:8,unresolved:2,ambiguous:0,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s54',label:'scenario 54',removeModuleIds:['module:6'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 55", () => {
    const architecture=architectureFixture({modules:9,unresolved:3,ambiguous:1,unmatched:0,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s55',label:'scenario 55',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:7'],suppressImportEdgeIds:['import:7'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 56", () => {
    const architecture=architectureFixture({modules:3,unresolved:0,ambiguous:2,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s56',label:'scenario 56',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 57", () => {
    const architecture=architectureFixture({modules:4,unresolved:1,ambiguous:0,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s57',label:'scenario 57',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 58", () => {
    const architecture=architectureFixture({modules:5,unresolved:2,ambiguous:1,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s58',label:'scenario 58',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 59", () => {
    const architecture=architectureFixture({modules:6,unresolved:3,ambiguous:2,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s59',label:'scenario 59',removeModuleIds:['module:5'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 60", () => {
    const architecture=architectureFixture({modules:7,unresolved:0,ambiguous:0,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s60',label:'scenario 60',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 61", () => {
    const architecture=architectureFixture({modules:8,unresolved:1,ambiguous:1,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s61',label:'scenario 61',removeModuleIds:['module:5'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 62", () => {
    const architecture=architectureFixture({modules:9,unresolved:2,ambiguous:2,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s62',label:'scenario 62',removeModuleIds:['module:8'],suppressCallEdgeIds:['call-edge:6'],suppressImportEdgeIds:['import:6'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 63", () => {
    const architecture=architectureFixture({modules:3,unresolved:3,ambiguous:0,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s63',label:'scenario 63',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 64", () => {
    const architecture=architectureFixture({modules:4,unresolved:0,ambiguous:1,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s64',label:'scenario 64',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 65", () => {
    const architecture=architectureFixture({modules:5,unresolved:1,ambiguous:2,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s65',label:'scenario 65',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 66", () => {
    const architecture=architectureFixture({modules:6,unresolved:2,ambiguous:0,unmatched:1,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s66',label:'scenario 66',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 67", () => {
    const architecture=architectureFixture({modules:7,unresolved:3,ambiguous:1,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s67',label:'scenario 67',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 68", () => {
    const architecture=architectureFixture({modules:8,unresolved:0,ambiguous:2,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s68',label:'scenario 68',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 69", () => {
    const architecture=architectureFixture({modules:9,unresolved:1,ambiguous:0,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s69',label:'scenario 69',removeModuleIds:['module:6'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 70", () => {
    const architecture=architectureFixture({modules:3,unresolved:2,ambiguous:1,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s70',label:'scenario 70',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 71", () => {
    const architecture=architectureFixture({modules:4,unresolved:3,ambiguous:2,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s71',label:'scenario 71',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 72", () => {
    const architecture=architectureFixture({modules:5,unresolved:0,ambiguous:0,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s72',label:'scenario 72',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 73", () => {
    const architecture=architectureFixture({modules:6,unresolved:1,ambiguous:1,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s73',label:'scenario 73',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 74", () => {
    const architecture=architectureFixture({modules:7,unresolved:2,ambiguous:2,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s74',label:'scenario 74',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 75", () => {
    const architecture=architectureFixture({modules:8,unresolved:3,ambiguous:0,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s75',label:'scenario 75',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 76", () => {
    const architecture=architectureFixture({modules:9,unresolved:0,ambiguous:1,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s76',label:'scenario 76',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 77", () => {
    const architecture=architectureFixture({modules:3,unresolved:1,ambiguous:2,unmatched:2,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s77',label:'scenario 77',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 78", () => {
    const architecture=architectureFixture({modules:4,unresolved:2,ambiguous:0,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s78',label:'scenario 78',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 79", () => {
    const architecture=architectureFixture({modules:5,unresolved:3,ambiguous:1,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s79',label:'scenario 79',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 80", () => {
    const architecture=architectureFixture({modules:6,unresolved:0,ambiguous:2,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s80',label:'scenario 80',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 81", () => {
    const architecture=architectureFixture({modules:7,unresolved:1,ambiguous:0,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s81',label:'scenario 81',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 82", () => {
    const architecture=architectureFixture({modules:8,unresolved:2,ambiguous:1,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s82',label:'scenario 82',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 83", () => {
    const architecture=architectureFixture({modules:9,unresolved:3,ambiguous:2,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s83',label:'scenario 83',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 84", () => {
    const architecture=architectureFixture({modules:3,unresolved:0,ambiguous:0,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s84',label:'scenario 84',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 85", () => {
    const architecture=architectureFixture({modules:4,unresolved:1,ambiguous:1,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s85',label:'scenario 85',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 86", () => {
    const architecture=architectureFixture({modules:5,unresolved:2,ambiguous:2,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s86',label:'scenario 86',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 87", () => {
    const architecture=architectureFixture({modules:6,unresolved:3,ambiguous:0,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s87',label:'scenario 87',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 88", () => {
    const architecture=architectureFixture({modules:7,unresolved:0,ambiguous:1,unmatched:3,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s88',label:'scenario 88',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 89", () => {
    const architecture=architectureFixture({modules:8,unresolved:1,ambiguous:2,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s89',label:'scenario 89',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 90", () => {
    const architecture=architectureFixture({modules:9,unresolved:2,ambiguous:0,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s90',label:'scenario 90',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 91", () => {
    const architecture=architectureFixture({modules:3,unresolved:3,ambiguous:1,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s91',label:'scenario 91',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 92", () => {
    const architecture=architectureFixture({modules:4,unresolved:0,ambiguous:2,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s92',label:'scenario 92',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 93", () => {
    const architecture=architectureFixture({modules:5,unresolved:1,ambiguous:0,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s93',label:'scenario 93',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 94", () => {
    const architecture=architectureFixture({modules:6,unresolved:2,ambiguous:1,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s94',label:'scenario 94',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 95", () => {
    const architecture=architectureFixture({modules:7,unresolved:3,ambiguous:2,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s95',label:'scenario 95',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 96", () => {
    const architecture=architectureFixture({modules:8,unresolved:0,ambiguous:0,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s96',label:'scenario 96',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 97", () => {
    const architecture=architectureFixture({modules:9,unresolved:1,ambiguous:1,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s97',label:'scenario 97',removeModuleIds:['module:7'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 98", () => {
    const architecture=architectureFixture({modules:3,unresolved:2,ambiguous:2,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s98',label:'scenario 98',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 99", () => {
    const architecture=architectureFixture({modules:4,unresolved:3,ambiguous:0,unmatched:4,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s99',label:'scenario 99',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 100", () => {
    const architecture=architectureFixture({modules:5,unresolved:0,ambiguous:1,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s100',label:'scenario 100',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 101", () => {
    const architecture=architectureFixture({modules:6,unresolved:1,ambiguous:2,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s101',label:'scenario 101',removeModuleIds:['module:5'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 102", () => {
    const architecture=architectureFixture({modules:7,unresolved:2,ambiguous:0,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s102',label:'scenario 102',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 103", () => {
    const architecture=architectureFixture({modules:8,unresolved:3,ambiguous:1,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s103',label:'scenario 103',removeModuleIds:['module:7'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 104", () => {
    const architecture=architectureFixture({modules:9,unresolved:0,ambiguous:2,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s104',label:'scenario 104',removeModuleIds:['module:5'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 105", () => {
    const architecture=architectureFixture({modules:3,unresolved:1,ambiguous:0,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s105',label:'scenario 105',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 106", () => {
    const architecture=architectureFixture({modules:4,unresolved:2,ambiguous:1,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s106',label:'scenario 106',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 107", () => {
    const architecture=architectureFixture({modules:5,unresolved:3,ambiguous:2,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s107',label:'scenario 107',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 108", () => {
    const architecture=architectureFixture({modules:6,unresolved:0,ambiguous:0,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s108',label:'scenario 108',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 109", () => {
    const architecture=architectureFixture({modules:7,unresolved:1,ambiguous:1,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s109',label:'scenario 109',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 110", () => {
    const architecture=architectureFixture({modules:8,unresolved:2,ambiguous:2,unmatched:0,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s110',label:'scenario 110',removeModuleIds:['module:6'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 111", () => {
    const architecture=architectureFixture({modules:9,unresolved:3,ambiguous:0,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s111',label:'scenario 111',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:7'],suppressImportEdgeIds:['import:7'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 112", () => {
    const architecture=architectureFixture({modules:3,unresolved:0,ambiguous:1,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s112',label:'scenario 112',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 113", () => {
    const architecture=architectureFixture({modules:4,unresolved:1,ambiguous:2,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s113',label:'scenario 113',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 114", () => {
    const architecture=architectureFixture({modules:5,unresolved:2,ambiguous:0,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s114',label:'scenario 114',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 115", () => {
    const architecture=architectureFixture({modules:6,unresolved:3,ambiguous:1,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s115',label:'scenario 115',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 116", () => {
    const architecture=architectureFixture({modules:7,unresolved:0,ambiguous:2,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s116',label:'scenario 116',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 117", () => {
    const architecture=architectureFixture({modules:8,unresolved:1,ambiguous:0,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s117',label:'scenario 117',removeModuleIds:['module:5'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 118", () => {
    const architecture=architectureFixture({modules:9,unresolved:2,ambiguous:1,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s118',label:'scenario 118',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:6'],suppressImportEdgeIds:['import:6'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 119", () => {
    const architecture=architectureFixture({modules:3,unresolved:3,ambiguous:2,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s119',label:'scenario 119',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 120", () => {
    const architecture=architectureFixture({modules:4,unresolved:0,ambiguous:0,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s120',label:'scenario 120',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 121", () => {
    const architecture=architectureFixture({modules:5,unresolved:1,ambiguous:1,unmatched:1,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s121',label:'scenario 121',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 122", () => {
    const architecture=architectureFixture({modules:6,unresolved:2,ambiguous:2,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s122',label:'scenario 122',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 123", () => {
    const architecture=architectureFixture({modules:7,unresolved:3,ambiguous:0,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s123',label:'scenario 123',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 124", () => {
    const architecture=architectureFixture({modules:8,unresolved:0,ambiguous:1,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s124',label:'scenario 124',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 125", () => {
    const architecture=architectureFixture({modules:9,unresolved:1,ambiguous:2,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s125',label:'scenario 125',removeModuleIds:['module:8'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 126", () => {
    const architecture=architectureFixture({modules:3,unresolved:2,ambiguous:0,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s126',label:'scenario 126',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 127", () => {
    const architecture=architectureFixture({modules:4,unresolved:3,ambiguous:1,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s127',label:'scenario 127',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 128", () => {
    const architecture=architectureFixture({modules:5,unresolved:0,ambiguous:2,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s128',label:'scenario 128',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 129", () => {
    const architecture=architectureFixture({modules:6,unresolved:1,ambiguous:0,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s129',label:'scenario 129',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 130", () => {
    const architecture=architectureFixture({modules:7,unresolved:2,ambiguous:1,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s130',label:'scenario 130',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 131", () => {
    const architecture=architectureFixture({modules:8,unresolved:3,ambiguous:2,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s131',label:'scenario 131',removeModuleIds:['module:3'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 132", () => {
    const architecture=architectureFixture({modules:9,unresolved:0,ambiguous:0,unmatched:2,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s132',label:'scenario 132',removeModuleIds:['module:6'],suppressCallEdgeIds:['call-edge:4'],suppressImportEdgeIds:['import:4'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 133", () => {
    const architecture=architectureFixture({modules:3,unresolved:1,ambiguous:1,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s133',label:'scenario 133',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 134", () => {
    const architecture=architectureFixture({modules:4,unresolved:2,ambiguous:2,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s134',label:'scenario 134',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 135", () => {
    const architecture=architectureFixture({modules:5,unresolved:3,ambiguous:0,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s135',label:'scenario 135',removeModuleIds:['module:0'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 136", () => {
    const architecture=architectureFixture({modules:6,unresolved:0,ambiguous:1,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s136',label:'scenario 136',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:1'],suppressImportEdgeIds:['import:1'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 137", () => {
    const architecture=architectureFixture({modules:7,unresolved:1,ambiguous:2,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s137',label:'scenario 137',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 138", () => {
    const architecture=architectureFixture({modules:8,unresolved:2,ambiguous:0,unmatched:3,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s138',label:'scenario 138',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:5'],suppressImportEdgeIds:['import:5'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(7);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 139", () => {
    const architecture=architectureFixture({modules:9,unresolved:3,ambiguous:1,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s139',label:'scenario 139',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(8);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 140", () => {
    const architecture=architectureFixture({modules:3,unresolved:0,ambiguous:2,unmatched:0,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s140',label:'scenario 140',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(2);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 141", () => {
    const architecture=architectureFixture({modules:4,unresolved:1,ambiguous:0,unmatched:1,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s141',label:'scenario 141',removeModuleIds:['module:1'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(3);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 142", () => {
    const architecture=architectureFixture({modules:5,unresolved:2,ambiguous:1,unmatched:2,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s142',label:'scenario 142',removeModuleIds:['module:2'],suppressCallEdgeIds:['call-edge:2'],suppressImportEdgeIds:['import:2'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(4);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 143", () => {
    const architecture=architectureFixture({modules:6,unresolved:3,ambiguous:2,unmatched:3,coverage:1});
    const result=evaluateArchitectureScenario(architecture,{id:'s143',label:'scenario 143',removeModuleIds:['module:5'],suppressCallEdgeIds:['call-edge:3'],suppressImportEdgeIds:['import:3'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(5);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("module and edge suppression 144", () => {
    const architecture=architectureFixture({modules:7,unresolved:0,ambiguous:0,unmatched:4,coverage:0});
    const result=evaluateArchitectureScenario(architecture,{id:'s144',label:'scenario 144',removeModuleIds:['module:4'],suppressCallEdgeIds:['call-edge:0'],suppressImportEdgeIds:['import:0'],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.after.values.modules).toBe(6);
    expect(result.affectedModules).toBe(1);
    expect(result.after.values.symbols).toBeLessThanOrEqual(result.before.values.symbols);
    expect(result.after.values['call-edges']).toBeLessThanOrEqual(result.before.values['call-edges']);
    expect(result.deltas.length).toBeGreaterThan(10);
  });
  it("deduplicates scenario inputs", () => {
    const result=normalizeArchitectureScenario({id:'',label:'',removeModuleIds:['a','a','b'],suppressCallEdgeIds:['x','x'],suppressImportEdgeIds:[],assumeResolvedImportIds:[],assumeUnambiguousCallSiteIds:[]});
    expect(result.id).toBe('scenario');
    expect(result.removeModuleIds).toEqual(['a','b']);
    expect(result.suppressCallEdgeIds).toEqual(['x']);
  });
});
