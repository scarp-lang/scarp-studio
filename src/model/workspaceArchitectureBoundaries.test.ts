import { describe,it,expect } from 'vitest';
import { architectureBoundaryZoneForModule,evaluateArchitectureBoundaries,deriveArchitectureBoundaryZones,type ArchitectureBoundaryRule,type ArchitectureBoundaryZone } from './workspaceArchitectureBoundaries';
import { architectureFixture } from '../test/workspaceArchitectureGovernanceFixtures';
describe('architecture boundaries',()=>{
  it("classifies longest prefix 0", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file0.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 0", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 1", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file1.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 1", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 2", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file2.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 2", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 3", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file3.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 3", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 4", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file4.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 4", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 5", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file5.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 5", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 6", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file6.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 6", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 7", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file7.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 7", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 8", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file8.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 8", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 9", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file9.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 9", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 10", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file10.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 10", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 11", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file11.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 11", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 12", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file12.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 12", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 13", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file13.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 13", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 14", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file14.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 14", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 15", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file15.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 15", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 16", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file16.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 16", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 17", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file17.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 17", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 18", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file18.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 18", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 19", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file19.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 19", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 20", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file20.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 20", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 21", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file21.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 21", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 22", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file22.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 22", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 23", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file23.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 23", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 24", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file24.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 24", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 25", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file25.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 25", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 26", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file26.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 26", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 27", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file27.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 27", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 28", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file28.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 28", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 29", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file29.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 29", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 30", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file30.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 30", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 31", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file31.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 31", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 32", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file32.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 32", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 33", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file33.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 33", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 34", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file34.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 34", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 35", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file35.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 35", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 36", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file36.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 36", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 37", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file37.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 37", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 38", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file38.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 38", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 39", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file39.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 39", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 40", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file40.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 40", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 41", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file41.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 41", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 42", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file42.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 42", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 43", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file43.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 43", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 44", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file44.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 44", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 45", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file45.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 45", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 46", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file46.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 46", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 47", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file47.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 47", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 48", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file48.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 48", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 49", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file49.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 49", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 50", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file50.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 50", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 51", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file51.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 51", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 52", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file52.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 52", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 53", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file53.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 53", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 54", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file54.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 54", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 55", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file55.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 55", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 56", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file56.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 56", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 57", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file57.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 57", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 58", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file58.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 58", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 59", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file59.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 59", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 60", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file60.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 60", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 61", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file61.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 61", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 62", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file62.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 62", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 63", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file63.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 63", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 64", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file64.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 64", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 65", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file65.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 65", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 66", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file66.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 66", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 67", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file67.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 67", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 68", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file68.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 68", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 69", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file69.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 69", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 70", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file70.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 70", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 71", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file71.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 71", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 72", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file72.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 72", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 73", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file73.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 73", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 74", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file74.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 74", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 75", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file75.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 75", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 76", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file76.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 76", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 77", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file77.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 77", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 78", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file78.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 78", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 79", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file79.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 79", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 80", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file80.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 80", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 81", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file81.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 81", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 82", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file82.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 82", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 83", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file83.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 83", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 84", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file84.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 84", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 85", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file85.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 85", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 86", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file86.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 86", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 87", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file87.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 87", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 88", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file88.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 88", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 89", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file89.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 89", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 90", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file90.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 90", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 91", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file91.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 91", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 92", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file92.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 92", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 93", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file93.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 93", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 94", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file94.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 94", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 95", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file95.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 95", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 96", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file96.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 96", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 97", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file97.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 97", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 98", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file98.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 98", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 99", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file99.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 99", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 100", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file100.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 100", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 101", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file101.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 101", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 102", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file102.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 102", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 103", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file103.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 103", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 104", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file104.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 104", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 105", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file105.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 105", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 106", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file106.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 106", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 107", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file107.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 107", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 108", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file108.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 108", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 109", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[1];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file109.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 109", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 110", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[2];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file110.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 110", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 111", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[3];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file111.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 111", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 112", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[4];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer1',label:'layer1',prefixes:['layer1']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer1/file112.srp'},zones);
    expect(actual?.id).toBe('layer1');
  });
  it("evaluates cross-zone rule 112", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z1',to:'z2',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 113", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[5];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer2',label:'layer2',prefixes:['layer2']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer2/file113.srp'},zones);
    expect(actual?.id).toBe('layer2');
  });
  it("evaluates cross-zone rule 113", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z2',to:'z0',edgeKinds:['import','call'],effect:'deny',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("classifies longest prefix 114", () => {
    const architecture=architectureFixture({modules:6});
    const module=architecture.modules[0];
    const zones:ArchitectureBoundaryZone[]=[{id:'root',label:'root',prefixes:['layer']},{id:'layer0',label:'layer0',prefixes:['layer0']}];
    const actual=architectureBoundaryZoneForModule({...module,listedName:'layer0/file114.srp'},zones);
    expect(actual?.id).toBe('layer0');
  });
  it("evaluates cross-zone rule 114", () => {
    const architecture=architectureFixture({modules:6});
    const zones:ArchitectureBoundaryZone[]=[{id:'z0',label:'z0',prefixes:['layer0']},{id:'z1',label:'z1',prefixes:['layer1']},{id:'z2',label:'z2',prefixes:['layer2']}];
    const rules:ArchitectureBoundaryRule[]=[{id:'r',from:'z0',to:'z1',edgeKinds:['import','call'],effect:'allow',note:'case'}];
    const result=evaluateArchitectureBoundaries(architecture,zones,rules);
    expect(result.classifiedModules).toBe(6);
    expect(result.violations.length).toBeLessThanOrEqual(result.denied);
  });
  it("derives roots", () => {
    const zones=deriveArchitectureBoundaryZones(architectureFixture({modules:9}));
    expect(zones.map(item=>item.label)).toEqual(['layer0','layer1','layer2']);
  });
});
