import { describe,it,expect } from 'vitest';
import { evaluateArchitectureBudget,evaluateArchitectureBudgets,normalizeArchitectureBudget,createDefaultArchitectureBudgets } from './workspaceArchitectureBudgets';
import { facts } from '../test/workspaceArchitectureGovernanceFixtures';
describe('architecture budgets',()=>{
  it("unresolved-imports budget 0/0", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":0}),{id:'b0',metric:"unresolved-imports",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("unresolved-imports budget 1/0", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":1}),{id:'b1',metric:"unresolved-imports",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("unresolved-imports budget 3/0", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":3}),{id:'b2',metric:"unresolved-imports",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("unresolved-imports budget 8/0", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":8}),{id:'b3',metric:"unresolved-imports",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("unresolved-imports budget 17/0", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":17}),{id:'b4',metric:"unresolved-imports",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("unresolved-imports budget 0/1", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":0}),{id:'b5',metric:"unresolved-imports",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("unresolved-imports budget 1/1", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":1}),{id:'b6',metric:"unresolved-imports",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("unresolved-imports budget 3/1", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":3}),{id:'b7',metric:"unresolved-imports",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("unresolved-imports budget 8/1", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":8}),{id:'b8',metric:"unresolved-imports",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("unresolved-imports budget 17/1", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":17}),{id:'b9',metric:"unresolved-imports",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("unresolved-imports budget 0/4", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":0}),{id:'b10',metric:"unresolved-imports",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(4);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("unresolved-imports budget 1/4", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":1}),{id:'b11',metric:"unresolved-imports",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(3);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("unresolved-imports budget 3/4", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":3}),{id:'b12',metric:"unresolved-imports",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("unresolved-imports budget 8/4", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":8}),{id:'b13',metric:"unresolved-imports",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("unresolved-imports budget 17/4", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":17}),{id:'b14',metric:"unresolved-imports",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("unresolved-imports budget 0/8", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":0}),{id:'b15',metric:"unresolved-imports",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("unresolved-imports budget 1/8", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":1}),{id:'b16',metric:"unresolved-imports",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(7);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("unresolved-imports budget 3/8", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":3}),{id:'b17',metric:"unresolved-imports",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(5);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("unresolved-imports budget 8/8", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":8}),{id:'b18',metric:"unresolved-imports",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("unresolved-imports budget 17/8", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":17}),{id:'b19',metric:"unresolved-imports",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("unresolved-imports budget 0/16", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":0}),{id:'b20',metric:"unresolved-imports",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(16);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("unresolved-imports budget 1/16", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":1}),{id:'b21',metric:"unresolved-imports",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(15);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("unresolved-imports budget 3/16", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":3}),{id:'b22',metric:"unresolved-imports",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(13);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("unresolved-imports budget 8/16", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":8}),{id:'b23',metric:"unresolved-imports",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("unresolved-imports budget 17/16", () => {
    const usage=evaluateArchitectureBudget(facts({"unresolved-imports":17}),{id:'b24',metric:"unresolved-imports",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("ambiguous-calls budget 0/0", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":0}),{id:'b25',metric:"ambiguous-calls",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("ambiguous-calls budget 1/0", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":1}),{id:'b26',metric:"ambiguous-calls",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("ambiguous-calls budget 3/0", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":3}),{id:'b27',metric:"ambiguous-calls",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("ambiguous-calls budget 8/0", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":8}),{id:'b28',metric:"ambiguous-calls",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("ambiguous-calls budget 17/0", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":17}),{id:'b29',metric:"ambiguous-calls",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("ambiguous-calls budget 0/1", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":0}),{id:'b30',metric:"ambiguous-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("ambiguous-calls budget 1/1", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":1}),{id:'b31',metric:"ambiguous-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("ambiguous-calls budget 3/1", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":3}),{id:'b32',metric:"ambiguous-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("ambiguous-calls budget 8/1", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":8}),{id:'b33',metric:"ambiguous-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("ambiguous-calls budget 17/1", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":17}),{id:'b34',metric:"ambiguous-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("ambiguous-calls budget 0/4", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":0}),{id:'b35',metric:"ambiguous-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(4);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("ambiguous-calls budget 1/4", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":1}),{id:'b36',metric:"ambiguous-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(3);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("ambiguous-calls budget 3/4", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":3}),{id:'b37',metric:"ambiguous-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("ambiguous-calls budget 8/4", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":8}),{id:'b38',metric:"ambiguous-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("ambiguous-calls budget 17/4", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":17}),{id:'b39',metric:"ambiguous-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("ambiguous-calls budget 0/8", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":0}),{id:'b40',metric:"ambiguous-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("ambiguous-calls budget 1/8", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":1}),{id:'b41',metric:"ambiguous-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(7);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("ambiguous-calls budget 3/8", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":3}),{id:'b42',metric:"ambiguous-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(5);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("ambiguous-calls budget 8/8", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":8}),{id:'b43',metric:"ambiguous-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("ambiguous-calls budget 17/8", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":17}),{id:'b44',metric:"ambiguous-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("ambiguous-calls budget 0/16", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":0}),{id:'b45',metric:"ambiguous-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(16);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("ambiguous-calls budget 1/16", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":1}),{id:'b46',metric:"ambiguous-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(15);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("ambiguous-calls budget 3/16", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":3}),{id:'b47',metric:"ambiguous-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(13);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("ambiguous-calls budget 8/16", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":8}),{id:'b48',metric:"ambiguous-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("ambiguous-calls budget 17/16", () => {
    const usage=evaluateArchitectureBudget(facts({"ambiguous-calls":17}),{id:'b49',metric:"ambiguous-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("unmatched-calls budget 0/0", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":0}),{id:'b50',metric:"unmatched-calls",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("unmatched-calls budget 1/0", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":1}),{id:'b51',metric:"unmatched-calls",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("unmatched-calls budget 3/0", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":3}),{id:'b52',metric:"unmatched-calls",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("unmatched-calls budget 8/0", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":8}),{id:'b53',metric:"unmatched-calls",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("unmatched-calls budget 17/0", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":17}),{id:'b54',metric:"unmatched-calls",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("unmatched-calls budget 0/1", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":0}),{id:'b55',metric:"unmatched-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("unmatched-calls budget 1/1", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":1}),{id:'b56',metric:"unmatched-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("unmatched-calls budget 3/1", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":3}),{id:'b57',metric:"unmatched-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("unmatched-calls budget 8/1", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":8}),{id:'b58',metric:"unmatched-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("unmatched-calls budget 17/1", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":17}),{id:'b59',metric:"unmatched-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("unmatched-calls budget 0/4", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":0}),{id:'b60',metric:"unmatched-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(4);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("unmatched-calls budget 1/4", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":1}),{id:'b61',metric:"unmatched-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(3);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("unmatched-calls budget 3/4", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":3}),{id:'b62',metric:"unmatched-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("unmatched-calls budget 8/4", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":8}),{id:'b63',metric:"unmatched-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("unmatched-calls budget 17/4", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":17}),{id:'b64',metric:"unmatched-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("unmatched-calls budget 0/8", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":0}),{id:'b65',metric:"unmatched-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("unmatched-calls budget 1/8", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":1}),{id:'b66',metric:"unmatched-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(7);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("unmatched-calls budget 3/8", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":3}),{id:'b67',metric:"unmatched-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(5);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("unmatched-calls budget 8/8", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":8}),{id:'b68',metric:"unmatched-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("unmatched-calls budget 17/8", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":17}),{id:'b69',metric:"unmatched-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("unmatched-calls budget 0/16", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":0}),{id:'b70',metric:"unmatched-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(16);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("unmatched-calls budget 1/16", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":1}),{id:'b71',metric:"unmatched-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(15);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("unmatched-calls budget 3/16", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":3}),{id:'b72',metric:"unmatched-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(13);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("unmatched-calls budget 8/16", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":8}),{id:'b73',metric:"unmatched-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("unmatched-calls budget 17/16", () => {
    const usage=evaluateArchitectureBudget(facts({"unmatched-calls":17}),{id:'b74',metric:"unmatched-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("import-cycles budget 0/0", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":0}),{id:'b75',metric:"import-cycles",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("import-cycles budget 1/0", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":1}),{id:'b76',metric:"import-cycles",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("import-cycles budget 3/0", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":3}),{id:'b77',metric:"import-cycles",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("import-cycles budget 8/0", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":8}),{id:'b78',metric:"import-cycles",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("import-cycles budget 17/0", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":17}),{id:'b79',metric:"import-cycles",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("import-cycles budget 0/1", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":0}),{id:'b80',metric:"import-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("import-cycles budget 1/1", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":1}),{id:'b81',metric:"import-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("import-cycles budget 3/1", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":3}),{id:'b82',metric:"import-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("import-cycles budget 8/1", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":8}),{id:'b83',metric:"import-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("import-cycles budget 17/1", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":17}),{id:'b84',metric:"import-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("import-cycles budget 0/4", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":0}),{id:'b85',metric:"import-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(4);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("import-cycles budget 1/4", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":1}),{id:'b86',metric:"import-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(3);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("import-cycles budget 3/4", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":3}),{id:'b87',metric:"import-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("import-cycles budget 8/4", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":8}),{id:'b88',metric:"import-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("import-cycles budget 17/4", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":17}),{id:'b89',metric:"import-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("import-cycles budget 0/8", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":0}),{id:'b90',metric:"import-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("import-cycles budget 1/8", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":1}),{id:'b91',metric:"import-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(7);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("import-cycles budget 3/8", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":3}),{id:'b92',metric:"import-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(5);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("import-cycles budget 8/8", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":8}),{id:'b93',metric:"import-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("import-cycles budget 17/8", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":17}),{id:'b94',metric:"import-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("import-cycles budget 0/16", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":0}),{id:'b95',metric:"import-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(16);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("import-cycles budget 1/16", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":1}),{id:'b96',metric:"import-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(15);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("import-cycles budget 3/16", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":3}),{id:'b97',metric:"import-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(13);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("import-cycles budget 8/16", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":8}),{id:'b98',metric:"import-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("import-cycles budget 17/16", () => {
    const usage=evaluateArchitectureBudget(facts({"import-cycles":17}),{id:'b99',metric:"import-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("call-cycles budget 0/0", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":0}),{id:'b100',metric:"call-cycles",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("call-cycles budget 1/0", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":1}),{id:'b101',metric:"call-cycles",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("call-cycles budget 3/0", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":3}),{id:'b102',metric:"call-cycles",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("call-cycles budget 8/0", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":8}),{id:'b103',metric:"call-cycles",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("call-cycles budget 17/0", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":17}),{id:'b104',metric:"call-cycles",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("call-cycles budget 0/1", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":0}),{id:'b105',metric:"call-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("call-cycles budget 1/1", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":1}),{id:'b106',metric:"call-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("call-cycles budget 3/1", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":3}),{id:'b107',metric:"call-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("call-cycles budget 8/1", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":8}),{id:'b108',metric:"call-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("call-cycles budget 17/1", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":17}),{id:'b109',metric:"call-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("call-cycles budget 0/4", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":0}),{id:'b110',metric:"call-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(4);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("call-cycles budget 1/4", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":1}),{id:'b111',metric:"call-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(3);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("call-cycles budget 3/4", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":3}),{id:'b112',metric:"call-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("call-cycles budget 8/4", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":8}),{id:'b113',metric:"call-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("call-cycles budget 17/4", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":17}),{id:'b114',metric:"call-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("call-cycles budget 0/8", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":0}),{id:'b115',metric:"call-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("call-cycles budget 1/8", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":1}),{id:'b116',metric:"call-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(7);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("call-cycles budget 3/8", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":3}),{id:'b117',metric:"call-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(5);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("call-cycles budget 8/8", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":8}),{id:'b118',metric:"call-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("call-cycles budget 17/8", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":17}),{id:'b119',metric:"call-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("call-cycles budget 0/16", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":0}),{id:'b120',metric:"call-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(16);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("call-cycles budget 1/16", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":1}),{id:'b121',metric:"call-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(15);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("call-cycles budget 3/16", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":3}),{id:'b122',metric:"call-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(13);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("call-cycles budget 8/16", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":8}),{id:'b123',metric:"call-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("call-cycles budget 17/16", () => {
    const usage=evaluateArchitectureBudget(facts({"call-cycles":17}),{id:'b124',metric:"call-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("critical-hotspots budget 0/0", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":0}),{id:'b125',metric:"critical-hotspots",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("critical-hotspots budget 1/0", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":1}),{id:'b126',metric:"critical-hotspots",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("critical-hotspots budget 3/0", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":3}),{id:'b127',metric:"critical-hotspots",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("critical-hotspots budget 8/0", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":8}),{id:'b128',metric:"critical-hotspots",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("critical-hotspots budget 17/0", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":17}),{id:'b129',metric:"critical-hotspots",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("critical-hotspots budget 0/1", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":0}),{id:'b130',metric:"critical-hotspots",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("critical-hotspots budget 1/1", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":1}),{id:'b131',metric:"critical-hotspots",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("critical-hotspots budget 3/1", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":3}),{id:'b132',metric:"critical-hotspots",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("critical-hotspots budget 8/1", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":8}),{id:'b133',metric:"critical-hotspots",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("critical-hotspots budget 17/1", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":17}),{id:'b134',metric:"critical-hotspots",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("critical-hotspots budget 0/4", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":0}),{id:'b135',metric:"critical-hotspots",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(4);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("critical-hotspots budget 1/4", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":1}),{id:'b136',metric:"critical-hotspots",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(3);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("critical-hotspots budget 3/4", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":3}),{id:'b137',metric:"critical-hotspots",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("critical-hotspots budget 8/4", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":8}),{id:'b138',metric:"critical-hotspots",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("critical-hotspots budget 17/4", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":17}),{id:'b139',metric:"critical-hotspots",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("critical-hotspots budget 0/8", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":0}),{id:'b140',metric:"critical-hotspots",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("critical-hotspots budget 1/8", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":1}),{id:'b141',metric:"critical-hotspots",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(7);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("critical-hotspots budget 3/8", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":3}),{id:'b142',metric:"critical-hotspots",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(5);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("critical-hotspots budget 8/8", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":8}),{id:'b143',metric:"critical-hotspots",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("critical-hotspots budget 17/8", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":17}),{id:'b144',metric:"critical-hotspots",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("critical-hotspots budget 0/16", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":0}),{id:'b145',metric:"critical-hotspots",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(16);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("critical-hotspots budget 1/16", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":1}),{id:'b146',metric:"critical-hotspots",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(15);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("critical-hotspots budget 3/16", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":3}),{id:'b147',metric:"critical-hotspots",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(13);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("critical-hotspots budget 8/16", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":8}),{id:'b148',metric:"critical-hotspots",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("critical-hotspots budget 17/16", () => {
    const usage=evaluateArchitectureBudget(facts({"critical-hotspots":17}),{id:'b149',metric:"critical-hotspots",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("coverage-gaps budget 0/0", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":0}),{id:'b150',metric:"coverage-gaps",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("coverage-gaps budget 1/0", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":1}),{id:'b151',metric:"coverage-gaps",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("coverage-gaps budget 3/0", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":3}),{id:'b152',metric:"coverage-gaps",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("coverage-gaps budget 8/0", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":8}),{id:'b153',metric:"coverage-gaps",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("coverage-gaps budget 17/0", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":17}),{id:'b154',metric:"coverage-gaps",limit:0,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("coverage-gaps budget 0/1", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":0}),{id:'b155',metric:"coverage-gaps",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("coverage-gaps budget 1/1", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":1}),{id:'b156',metric:"coverage-gaps",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("coverage-gaps budget 3/1", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":3}),{id:'b157',metric:"coverage-gaps",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("coverage-gaps budget 8/1", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":8}),{id:'b158',metric:"coverage-gaps",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("coverage-gaps budget 17/1", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":17}),{id:'b159',metric:"coverage-gaps",limit:1,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("coverage-gaps budget 0/4", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":0}),{id:'b160',metric:"coverage-gaps",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(4);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("coverage-gaps budget 1/4", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":1}),{id:'b161',metric:"coverage-gaps",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(3);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("coverage-gaps budget 3/4", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":3}),{id:'b162',metric:"coverage-gaps",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(1);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("coverage-gaps budget 8/4", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":8}),{id:'b163',metric:"coverage-gaps",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("coverage-gaps budget 17/4", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":17}),{id:'b164',metric:"coverage-gaps",limit:4,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("coverage-gaps budget 0/8", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":0}),{id:'b165',metric:"coverage-gaps",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("coverage-gaps budget 1/8", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":1}),{id:'b166',metric:"coverage-gaps",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(7);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("coverage-gaps budget 3/8", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":3}),{id:'b167',metric:"coverage-gaps",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(5);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("coverage-gaps budget 8/8", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":8}),{id:'b168',metric:"coverage-gaps",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("coverage-gaps budget 17/8", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":17}),{id:'b169',metric:"coverage-gaps",limit:8,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("coverage-gaps budget 0/16", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":0}),{id:'b170',metric:"coverage-gaps",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(0);
    expect(usage.remaining).toBe(16);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(0));
  });
  it("coverage-gaps budget 1/16", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":1}),{id:'b171',metric:"coverage-gaps",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(1);
    expect(usage.remaining).toBe(15);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(1));
  });
  it("coverage-gaps budget 3/16", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":3}),{id:'b172',metric:"coverage-gaps",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(3);
    expect(usage.remaining).toBe(13);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(3));
  });
  it("coverage-gaps budget 8/16", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":8}),{id:'b173',metric:"coverage-gaps",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(8);
    expect(usage.remaining).toBe(8);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(8));
  });
  it("coverage-gaps budget 17/16", () => {
    const usage=evaluateArchitectureBudget(facts({"coverage-gaps":17}),{id:'b174',metric:"coverage-gaps",limit:16,warningRatio:0.75,enabled:true});
    expect(usage.actual).toBe(17);
    expect(usage.remaining).toBe(0);
    expect(['healthy','near','exceeded']).toContain(usage.status);
    expect(usage.message).toContain(String(17));
  });
  it("default budgets are unique", () => {
    const budgets=createDefaultArchitectureBudgets();
    expect(new Set(budgets.map(item=>item.id)).size).toBe(budgets.length);
    expect(evaluateArchitectureBudgets(facts(),budgets).score).toBe(100);
  });
  it("invalid budgets normalize safely", () => {
    const value=normalizeArchitectureBudget({id:'',metric:'modules',limit:-4,warningRatio:4,enabled:true});
    expect(value.limit).toBe(0);
    expect(value.warningRatio).toBe(1);
    expect(value.id).toContain('modules');
  });
});
