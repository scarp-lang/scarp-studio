import { describe,it,expect } from 'vitest';
import { architectureBoundaryZoneForModule,type ArchitectureBoundaryZone } from './workspaceArchitectureBoundaries';
import { architectureFixture } from '../test/workspaceArchitectureGovernanceFixtures';
describe('boundary classification matrix',()=>{
  it("path normalization 0", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/file.srp",path:"C:\\\\project\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 1", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 2", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 3", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 4", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 5", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/file.srp",path:"C:\\\\project\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 6", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 7", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 8", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 9", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 10", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/file.srp",path:"C:\\\\project\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 11", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 12", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 13", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/segment7/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 14", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 15", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/file.srp",path:"C:\\\\project\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 16", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 17", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 18", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/segment3/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 19", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 20", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/file.srp",path:"C:\\\\project\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 21", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 22", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 23", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 24", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7/segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 25", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/file.srp",path:"C:\\\\project\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 26", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 27", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 28", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 29", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 30", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/file.srp",path:"C:\\\\project\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 31", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 32", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 33", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 34", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8/segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 35", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/file.srp",path:"C:\\\\project\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 36", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 37", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 38", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 39", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/segment6/segment7/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5/segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 40", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/file.srp",path:"C:\\\\project\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 41", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 42", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 43", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 44", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/segment2/segment3/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1/segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 45", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/file.srp",path:"C:\\\\project\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 46", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 47", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 48", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 49", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 50", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/file.srp",path:"C:\\\\project\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 51", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 52", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 53", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 54", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 55", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/file.srp",path:"C:\\\\project\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 56", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 57", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 58", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/segment7/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 59", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 60", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/file.srp",path:"C:\\\\project\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 61", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 62", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 63", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/segment3/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 64", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 65", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/file.srp",path:"C:\\\\project\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 66", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 67", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 68", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 69", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7/segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 70", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/file.srp",path:"C:\\\\project\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 71", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 72", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 73", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 74", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 75", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/file.srp",path:"C:\\\\project\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 76", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 77", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 78", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 79", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8/segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 80", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/file.srp",path:"C:\\\\project\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 81", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 82", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 83", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 84", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/segment6/segment7/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5/segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 85", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/file.srp",path:"C:\\\\project\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 86", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 87", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 88", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 89", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/segment2/segment3/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1/segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 90", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/file.srp",path:"C:\\\\project\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 91", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 92", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 93", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 94", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 95", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/file.srp",path:"C:\\\\project\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 96", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 97", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 98", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 99", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 100", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/file.srp",path:"C:\\\\project\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 101", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 102", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 103", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/segment7/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 104", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 105", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/file.srp",path:"C:\\\\project\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 106", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 107", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 108", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/segment3/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 109", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 110", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/file.srp",path:"C:\\\\project\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 111", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 112", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 113", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 114", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7/segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 115", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/file.srp",path:"C:\\\\project\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 116", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 117", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 118", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 119", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 120", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/file.srp",path:"C:\\\\project\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 121", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 122", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 123", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 124", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8/segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 125", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/file.srp",path:"C:\\\\project\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 126", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 127", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 128", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 129", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/segment6/segment7/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5/segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 130", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/file.srp",path:"C:\\\\project\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 131", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 132", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 133", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 134", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/segment2/segment3/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1/segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 135", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/file.srp",path:"C:\\\\project\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 136", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 137", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 138", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 139", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 140", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/file.srp",path:"C:\\\\project\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 141", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 142", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 143", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 144", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 145", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/file.srp",path:"C:\\\\project\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 146", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 147", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 148", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/segment7/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6/segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 149", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/segment8/segment0/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7/segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 150", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/file.srp",path:"C:\\\\project\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 151", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/segment8/file.srp",path:"C:\\\\project\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 152", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 153", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/segment3/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\segment3\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2/segment3"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/SEGMENT3/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 154", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/segment4/segment5/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3/segment4/segment5"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 155", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/file.srp",path:"C:\\\\project\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 156", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment3/segment4/file.srp",path:"C:\\\\project\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment3"]},{id:'deep',label:'deep',prefixes:["segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 157", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment4"]},{id:'deep',label:'deep',prefixes:["segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 158", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment5/segment6/segment7/segment8/file.srp",path:"C:\\\\project\\\\segment5\\\\segment6\\\\segment7\\\\segment8\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment5"]},{id:'deep',label:'deep',prefixes:["segment5/segment6/segment7/segment8"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT5/SEGMENT6/SEGMENT7/SEGMENT8/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 159", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment6/segment7/segment8/segment0/segment1/file.srp",path:"C:\\\\project\\\\segment6\\\\segment7\\\\segment8\\\\segment0\\\\segment1\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment6"]},{id:'deep',label:'deep',prefixes:["segment6/segment7/segment8/segment0/segment1"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT6/SEGMENT7/SEGMENT8/SEGMENT0/SEGMENT1/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 160", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment7/file.srp",path:"C:\\\\project\\\\segment7\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment7"]},{id:'deep',label:'deep',prefixes:["segment7"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT7/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 161", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment8/segment0/file.srp",path:"C:\\\\project\\\\segment8\\\\segment0\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment8"]},{id:'deep',label:'deep',prefixes:["segment8/segment0"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT8/SEGMENT0/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 162", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment0/segment1/segment2/file.srp",path:"C:\\\\project\\\\segment0\\\\segment1\\\\segment2\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment0"]},{id:'deep',label:'deep',prefixes:["segment0/segment1/segment2"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT0/SEGMENT1/SEGMENT2/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 163", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment1/segment2/segment3/segment4/file.srp",path:"C:\\\\project\\\\segment1\\\\segment2\\\\segment3\\\\segment4\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment1"]},{id:'deep',label:'deep',prefixes:["segment1/segment2/segment3/segment4"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT1/SEGMENT2/SEGMENT3/SEGMENT4/FILE.SRP"},zones)?.id).toBe('deep');
  });
  it("path normalization 164", () => {
    const module={...architectureFixture({modules:1}).modules[0],listedName:"segment2/segment3/segment4/segment5/segment6/file.srp",path:"C:\\\\project\\\\segment2\\\\segment3\\\\segment4\\\\segment5\\\\segment6\\\\file.srp"};
    const zones:ArchitectureBoundaryZone[]=[{id:'short',label:'short',prefixes:["segment2"]},{id:'deep',label:'deep',prefixes:["segment2/segment3/segment4/segment5/segment6"]}];
    expect(architectureBoundaryZoneForModule(module,zones)?.id).toBe('deep');
    expect(architectureBoundaryZoneForModule({...module,listedName:"SEGMENT2/SEGMENT3/SEGMENT4/SEGMENT5/SEGMENT6/FILE.SRP"},zones)?.id).toBe('deep');
  });
});
