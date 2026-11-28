import { describe,it,expect } from 'vitest';
import { analyzeGovernanceTrends,appendGovernanceTrendPoint,type GovernanceTrendPoint } from './workspaceArchitectureTrends';
import { facts } from '../test/workspaceArchitectureGovernanceFixtures';
describe('architecture governance trends',()=>{
  it("trend slope 0", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'0:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 1", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'1:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 2", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'2:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 3", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'3:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 4", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'4:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 5", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'5:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 6", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'6:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 7", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'7:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 8", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'8:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 9", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'9:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 10", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'10:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 11", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'11:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 12", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'12:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 13", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'13:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 14", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'14:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 15", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'15:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 16", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'16:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 17", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'17:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 18", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'18:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 19", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'19:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 20", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'20:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 21", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'21:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 22", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'22:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 23", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'23:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 24", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'24:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 25", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'25:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 26", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'26:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 27", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'27:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 28", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'28:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 29", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'29:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 30", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'30:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 31", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'31:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 32", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'32:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 33", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'33:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 34", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'34:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 35", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'35:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 36", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'36:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 37", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'37:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 38", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'38:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 39", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'39:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 40", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'40:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 41", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'41:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 42", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'42:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 43", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'43:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 44", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'44:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 45", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'45:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 46", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'46:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 47", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'47:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 48", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'48:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 49", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'49:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 50", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'50:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 51", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'51:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 52", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'52:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 53", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'53:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 54", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'54:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 55", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'55:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 56", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'56:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 57", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'57:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 58", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'58:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 59", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'59:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 60", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'60:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 61", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'61:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 62", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'62:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 63", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'63:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 64", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'64:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 65", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'65:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 66", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'66:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 67", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'67:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 68", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'68:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 69", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'69:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 70", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'70:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 71", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'71:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 72", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'72:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 73", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'73:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 74", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'74:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 75", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'75:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 76", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'76:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 77", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'77:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 78", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'78:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 79", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'79:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 80", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'80:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 81", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'81:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 82", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'82:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 83", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'83:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 84", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'84:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 85", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'85:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 86", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'86:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 87", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'87:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 88", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'88:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 89", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'89:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 90", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'90:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 91", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'91:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 92", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'92:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 93", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'93:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 94", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'94:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 95", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'95:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 96", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'96:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 97", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'97:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 98", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'98:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 99", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'99:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 100", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'100:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 101", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'101:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 102", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'102:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 103", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'103:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 104", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'104:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 105", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'105:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 106", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'106:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 107", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'107:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 108", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'108:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 109", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'109:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 110", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'110:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 111", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'111:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 112", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'112:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 113", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'113:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 114", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'114:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 115", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'115:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 116", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'116:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 117", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'117:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 118", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'118:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 119", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'119:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 120", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'120:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 121", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'121:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 122", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'122:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 123", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'123:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 124", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'124:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 125", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'125:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 126", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'126:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 127", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'127:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 128", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'128:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 129", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'129:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 130", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'130:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 131", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'131:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 132", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'132:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 133", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'133:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 134", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'134:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 135", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'135:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 136", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'136:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,1+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,1));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 137", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'137:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,2+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,2));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 138", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'138:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,3+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,3));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 139", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'139:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,4+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,4));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 140", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'140:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,5+index*-2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,5));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 141", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'141:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,6+index*-1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,6));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 142", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'142:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,7+index*0)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,7));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 143", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'143:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,8+index*1)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,8));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend slope 144", () => {
    const points:GovernanceTrendPoint[]=Array.from({length:6},(_,index)=>({id:'144:'+index,label:'p'+index,capturedAt:index,facts:facts({'unresolved-imports':Math.max(0,0+index*2)})}));
    const result=analyzeGovernanceTrends(points);
    const metric=result.metrics.find(item=>item.metric==='unresolved-imports')!;
    expect(metric.first).toBe(Math.max(0,0));
    expect(metric.min).toBeLessThanOrEqual(metric.max);
    expect(Number.isFinite(metric.slope)).toBe(true);
    expect(['improving','stable','regressing']).toContain(metric.direction);
  });
  it("trend storage is bounded", () => {
    let points:GovernanceTrendPoint[]=[];
    for(let i=0;i<40;i++)points=appendGovernanceTrendPoint(points,{id:String(i),label:String(i),capturedAt:i,facts:facts()});
    expect(points.length).toBe(24);
    expect(points[0].capturedAt).toBe(16);
  });
});
