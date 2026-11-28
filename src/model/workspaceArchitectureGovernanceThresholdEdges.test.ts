import { describe,it,expect } from 'vitest';
import { evaluateArchitectureBudget } from './workspaceArchitectureBudgets';
import { evaluateGovernanceRule,type GovernanceRule } from './workspaceArchitectureGovernance';
import { facts } from '../test/workspaceArchitectureGovernanceFixtures';
describe('governance threshold edges',()=>{
  it("threshold edge unresolved-imports 1 -1", () => {
    const rule:GovernanceRule={id:'t0',metric:"unresolved-imports",comparator:'<=',threshold:1,severity:'error',label:'edge 0',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(evaluation.actual).toBe(0);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":0}),{id:'b0',metric:"unresolved-imports",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(0);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge unresolved-imports 1 0", () => {
    const rule:GovernanceRule={id:'t1',metric:"unresolved-imports",comparator:'<=',threshold:1,severity:'error',label:'edge 1',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":1}),{id:'b1',metric:"unresolved-imports",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unresolved-imports 1 1", () => {
    const rule:GovernanceRule={id:'t2',metric:"unresolved-imports",comparator:'<=',threshold:1,severity:'error',label:'edge 2',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":2}),{id:'b2',metric:"unresolved-imports",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge unresolved-imports 2 -1", () => {
    const rule:GovernanceRule={id:'t3',metric:"unresolved-imports",comparator:'<=',threshold:2,severity:'error',label:'edge 3',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":1}),{id:'b3',metric:"unresolved-imports",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge unresolved-imports 2 0", () => {
    const rule:GovernanceRule={id:'t4',metric:"unresolved-imports",comparator:'<=',threshold:2,severity:'error',label:'edge 4',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":2}),{id:'b4',metric:"unresolved-imports",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unresolved-imports 2 1", () => {
    const rule:GovernanceRule={id:'t5',metric:"unresolved-imports",comparator:'<=',threshold:2,severity:'error',label:'edge 5',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":3}),{id:'b5',metric:"unresolved-imports",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge unresolved-imports 4 -1", () => {
    const rule:GovernanceRule={id:'t6',metric:"unresolved-imports",comparator:'<=',threshold:4,severity:'error',label:'edge 6',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":3}),{id:'b6',metric:"unresolved-imports",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unresolved-imports 4 0", () => {
    const rule:GovernanceRule={id:'t7',metric:"unresolved-imports",comparator:'<=',threshold:4,severity:'error',label:'edge 7',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":4}),rule);
    expect(evaluation.actual).toBe(4);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":4}),{id:'b7',metric:"unresolved-imports",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(4);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unresolved-imports 4 1", () => {
    const rule:GovernanceRule={id:'t8',metric:"unresolved-imports",comparator:'<=',threshold:4,severity:'error',label:'edge 8',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":5}),rule);
    expect(evaluation.actual).toBe(5);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":5}),{id:'b8',metric:"unresolved-imports",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(5);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge unresolved-imports 8 -1", () => {
    const rule:GovernanceRule={id:'t9',metric:"unresolved-imports",comparator:'<=',threshold:8,severity:'error',label:'edge 9',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":7}),rule);
    expect(evaluation.actual).toBe(7);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":7}),{id:'b9',metric:"unresolved-imports",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(7);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unresolved-imports 8 0", () => {
    const rule:GovernanceRule={id:'t10',metric:"unresolved-imports",comparator:'<=',threshold:8,severity:'error',label:'edge 10',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":8}),rule);
    expect(evaluation.actual).toBe(8);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":8}),{id:'b10',metric:"unresolved-imports",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(8);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unresolved-imports 8 1", () => {
    const rule:GovernanceRule={id:'t11',metric:"unresolved-imports",comparator:'<=',threshold:8,severity:'error',label:'edge 11',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":9}),rule);
    expect(evaluation.actual).toBe(9);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":9}),{id:'b11',metric:"unresolved-imports",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(9);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge unresolved-imports 16 -1", () => {
    const rule:GovernanceRule={id:'t12',metric:"unresolved-imports",comparator:'<=',threshold:16,severity:'error',label:'edge 12',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":15}),rule);
    expect(evaluation.actual).toBe(15);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":15}),{id:'b12',metric:"unresolved-imports",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(15);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unresolved-imports 16 0", () => {
    const rule:GovernanceRule={id:'t13',metric:"unresolved-imports",comparator:'<=',threshold:16,severity:'error',label:'edge 13',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":16}),rule);
    expect(evaluation.actual).toBe(16);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":16}),{id:'b13',metric:"unresolved-imports",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(16);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unresolved-imports 16 1", () => {
    const rule:GovernanceRule={id:'t14',metric:"unresolved-imports",comparator:'<=',threshold:16,severity:'error',label:'edge 14',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unresolved-imports":17}),rule);
    expect(evaluation.actual).toBe(17);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"unresolved-imports":17}),{id:'b14',metric:"unresolved-imports",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(17);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge ambiguous-calls 1 -1", () => {
    const rule:GovernanceRule={id:'t15',metric:"ambiguous-calls",comparator:'<=',threshold:1,severity:'error',label:'edge 15',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(evaluation.actual).toBe(0);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":0}),{id:'b15',metric:"ambiguous-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(0);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge ambiguous-calls 1 0", () => {
    const rule:GovernanceRule={id:'t16',metric:"ambiguous-calls",comparator:'<=',threshold:1,severity:'error',label:'edge 16',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":1}),{id:'b16',metric:"ambiguous-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('near');
  });
  it("threshold edge ambiguous-calls 1 1", () => {
    const rule:GovernanceRule={id:'t17',metric:"ambiguous-calls",comparator:'<=',threshold:1,severity:'error',label:'edge 17',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":2}),{id:'b17',metric:"ambiguous-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge ambiguous-calls 2 -1", () => {
    const rule:GovernanceRule={id:'t18',metric:"ambiguous-calls",comparator:'<=',threshold:2,severity:'error',label:'edge 18',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":1}),{id:'b18',metric:"ambiguous-calls",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge ambiguous-calls 2 0", () => {
    const rule:GovernanceRule={id:'t19',metric:"ambiguous-calls",comparator:'<=',threshold:2,severity:'error',label:'edge 19',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":2}),{id:'b19',metric:"ambiguous-calls",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('near');
  });
  it("threshold edge ambiguous-calls 2 1", () => {
    const rule:GovernanceRule={id:'t20',metric:"ambiguous-calls",comparator:'<=',threshold:2,severity:'error',label:'edge 20',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":3}),{id:'b20',metric:"ambiguous-calls",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge ambiguous-calls 4 -1", () => {
    const rule:GovernanceRule={id:'t21',metric:"ambiguous-calls",comparator:'<=',threshold:4,severity:'error',label:'edge 21',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":3}),{id:'b21',metric:"ambiguous-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('near');
  });
  it("threshold edge ambiguous-calls 4 0", () => {
    const rule:GovernanceRule={id:'t22',metric:"ambiguous-calls",comparator:'<=',threshold:4,severity:'error',label:'edge 22',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":4}),rule);
    expect(evaluation.actual).toBe(4);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":4}),{id:'b22',metric:"ambiguous-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(4);
    expect(budget.status).toBe('near');
  });
  it("threshold edge ambiguous-calls 4 1", () => {
    const rule:GovernanceRule={id:'t23',metric:"ambiguous-calls",comparator:'<=',threshold:4,severity:'error',label:'edge 23',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":5}),rule);
    expect(evaluation.actual).toBe(5);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":5}),{id:'b23',metric:"ambiguous-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(5);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge ambiguous-calls 8 -1", () => {
    const rule:GovernanceRule={id:'t24',metric:"ambiguous-calls",comparator:'<=',threshold:8,severity:'error',label:'edge 24',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":7}),rule);
    expect(evaluation.actual).toBe(7);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":7}),{id:'b24',metric:"ambiguous-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(7);
    expect(budget.status).toBe('near');
  });
  it("threshold edge ambiguous-calls 8 0", () => {
    const rule:GovernanceRule={id:'t25',metric:"ambiguous-calls",comparator:'<=',threshold:8,severity:'error',label:'edge 25',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":8}),rule);
    expect(evaluation.actual).toBe(8);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":8}),{id:'b25',metric:"ambiguous-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(8);
    expect(budget.status).toBe('near');
  });
  it("threshold edge ambiguous-calls 8 1", () => {
    const rule:GovernanceRule={id:'t26',metric:"ambiguous-calls",comparator:'<=',threshold:8,severity:'error',label:'edge 26',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":9}),rule);
    expect(evaluation.actual).toBe(9);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":9}),{id:'b26',metric:"ambiguous-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(9);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge ambiguous-calls 16 -1", () => {
    const rule:GovernanceRule={id:'t27',metric:"ambiguous-calls",comparator:'<=',threshold:16,severity:'error',label:'edge 27',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":15}),rule);
    expect(evaluation.actual).toBe(15);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":15}),{id:'b27',metric:"ambiguous-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(15);
    expect(budget.status).toBe('near');
  });
  it("threshold edge ambiguous-calls 16 0", () => {
    const rule:GovernanceRule={id:'t28',metric:"ambiguous-calls",comparator:'<=',threshold:16,severity:'error',label:'edge 28',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":16}),rule);
    expect(evaluation.actual).toBe(16);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":16}),{id:'b28',metric:"ambiguous-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(16);
    expect(budget.status).toBe('near');
  });
  it("threshold edge ambiguous-calls 16 1", () => {
    const rule:GovernanceRule={id:'t29',metric:"ambiguous-calls",comparator:'<=',threshold:16,severity:'error',label:'edge 29',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"ambiguous-calls":17}),rule);
    expect(evaluation.actual).toBe(17);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"ambiguous-calls":17}),{id:'b29',metric:"ambiguous-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(17);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge unmatched-calls 1 -1", () => {
    const rule:GovernanceRule={id:'t30',metric:"unmatched-calls",comparator:'<=',threshold:1,severity:'error',label:'edge 30',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(evaluation.actual).toBe(0);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":0}),{id:'b30',metric:"unmatched-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(0);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge unmatched-calls 1 0", () => {
    const rule:GovernanceRule={id:'t31',metric:"unmatched-calls",comparator:'<=',threshold:1,severity:'error',label:'edge 31',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":1}),{id:'b31',metric:"unmatched-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unmatched-calls 1 1", () => {
    const rule:GovernanceRule={id:'t32',metric:"unmatched-calls",comparator:'<=',threshold:1,severity:'error',label:'edge 32',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":2}),{id:'b32',metric:"unmatched-calls",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge unmatched-calls 2 -1", () => {
    const rule:GovernanceRule={id:'t33',metric:"unmatched-calls",comparator:'<=',threshold:2,severity:'error',label:'edge 33',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":1}),{id:'b33',metric:"unmatched-calls",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge unmatched-calls 2 0", () => {
    const rule:GovernanceRule={id:'t34',metric:"unmatched-calls",comparator:'<=',threshold:2,severity:'error',label:'edge 34',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":2}),{id:'b34',metric:"unmatched-calls",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unmatched-calls 2 1", () => {
    const rule:GovernanceRule={id:'t35',metric:"unmatched-calls",comparator:'<=',threshold:2,severity:'error',label:'edge 35',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":3}),{id:'b35',metric:"unmatched-calls",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge unmatched-calls 4 -1", () => {
    const rule:GovernanceRule={id:'t36',metric:"unmatched-calls",comparator:'<=',threshold:4,severity:'error',label:'edge 36',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":3}),{id:'b36',metric:"unmatched-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unmatched-calls 4 0", () => {
    const rule:GovernanceRule={id:'t37',metric:"unmatched-calls",comparator:'<=',threshold:4,severity:'error',label:'edge 37',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":4}),rule);
    expect(evaluation.actual).toBe(4);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":4}),{id:'b37',metric:"unmatched-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(4);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unmatched-calls 4 1", () => {
    const rule:GovernanceRule={id:'t38',metric:"unmatched-calls",comparator:'<=',threshold:4,severity:'error',label:'edge 38',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":5}),rule);
    expect(evaluation.actual).toBe(5);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":5}),{id:'b38',metric:"unmatched-calls",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(5);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge unmatched-calls 8 -1", () => {
    const rule:GovernanceRule={id:'t39',metric:"unmatched-calls",comparator:'<=',threshold:8,severity:'error',label:'edge 39',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":7}),rule);
    expect(evaluation.actual).toBe(7);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":7}),{id:'b39',metric:"unmatched-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(7);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unmatched-calls 8 0", () => {
    const rule:GovernanceRule={id:'t40',metric:"unmatched-calls",comparator:'<=',threshold:8,severity:'error',label:'edge 40',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":8}),rule);
    expect(evaluation.actual).toBe(8);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":8}),{id:'b40',metric:"unmatched-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(8);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unmatched-calls 8 1", () => {
    const rule:GovernanceRule={id:'t41',metric:"unmatched-calls",comparator:'<=',threshold:8,severity:'error',label:'edge 41',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":9}),rule);
    expect(evaluation.actual).toBe(9);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":9}),{id:'b41',metric:"unmatched-calls",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(9);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge unmatched-calls 16 -1", () => {
    const rule:GovernanceRule={id:'t42',metric:"unmatched-calls",comparator:'<=',threshold:16,severity:'error',label:'edge 42',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":15}),rule);
    expect(evaluation.actual).toBe(15);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":15}),{id:'b42',metric:"unmatched-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(15);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unmatched-calls 16 0", () => {
    const rule:GovernanceRule={id:'t43',metric:"unmatched-calls",comparator:'<=',threshold:16,severity:'error',label:'edge 43',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":16}),rule);
    expect(evaluation.actual).toBe(16);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":16}),{id:'b43',metric:"unmatched-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(16);
    expect(budget.status).toBe('near');
  });
  it("threshold edge unmatched-calls 16 1", () => {
    const rule:GovernanceRule={id:'t44',metric:"unmatched-calls",comparator:'<=',threshold:16,severity:'error',label:'edge 44',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"unmatched-calls":17}),rule);
    expect(evaluation.actual).toBe(17);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"unmatched-calls":17}),{id:'b44',metric:"unmatched-calls",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(17);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge import-cycles 1 -1", () => {
    const rule:GovernanceRule={id:'t45',metric:"import-cycles",comparator:'<=',threshold:1,severity:'error',label:'edge 45',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(evaluation.actual).toBe(0);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":0}),{id:'b45',metric:"import-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(0);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge import-cycles 1 0", () => {
    const rule:GovernanceRule={id:'t46',metric:"import-cycles",comparator:'<=',threshold:1,severity:'error',label:'edge 46',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":1}),{id:'b46',metric:"import-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('near');
  });
  it("threshold edge import-cycles 1 1", () => {
    const rule:GovernanceRule={id:'t47',metric:"import-cycles",comparator:'<=',threshold:1,severity:'error',label:'edge 47',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":2}),{id:'b47',metric:"import-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge import-cycles 2 -1", () => {
    const rule:GovernanceRule={id:'t48',metric:"import-cycles",comparator:'<=',threshold:2,severity:'error',label:'edge 48',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":1}),{id:'b48',metric:"import-cycles",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge import-cycles 2 0", () => {
    const rule:GovernanceRule={id:'t49',metric:"import-cycles",comparator:'<=',threshold:2,severity:'error',label:'edge 49',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":2}),{id:'b49',metric:"import-cycles",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('near');
  });
  it("threshold edge import-cycles 2 1", () => {
    const rule:GovernanceRule={id:'t50',metric:"import-cycles",comparator:'<=',threshold:2,severity:'error',label:'edge 50',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":3}),{id:'b50',metric:"import-cycles",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge import-cycles 4 -1", () => {
    const rule:GovernanceRule={id:'t51',metric:"import-cycles",comparator:'<=',threshold:4,severity:'error',label:'edge 51',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":3}),{id:'b51',metric:"import-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('near');
  });
  it("threshold edge import-cycles 4 0", () => {
    const rule:GovernanceRule={id:'t52',metric:"import-cycles",comparator:'<=',threshold:4,severity:'error',label:'edge 52',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":4}),rule);
    expect(evaluation.actual).toBe(4);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":4}),{id:'b52',metric:"import-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(4);
    expect(budget.status).toBe('near');
  });
  it("threshold edge import-cycles 4 1", () => {
    const rule:GovernanceRule={id:'t53',metric:"import-cycles",comparator:'<=',threshold:4,severity:'error',label:'edge 53',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":5}),rule);
    expect(evaluation.actual).toBe(5);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":5}),{id:'b53',metric:"import-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(5);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge import-cycles 8 -1", () => {
    const rule:GovernanceRule={id:'t54',metric:"import-cycles",comparator:'<=',threshold:8,severity:'error',label:'edge 54',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":7}),rule);
    expect(evaluation.actual).toBe(7);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":7}),{id:'b54',metric:"import-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(7);
    expect(budget.status).toBe('near');
  });
  it("threshold edge import-cycles 8 0", () => {
    const rule:GovernanceRule={id:'t55',metric:"import-cycles",comparator:'<=',threshold:8,severity:'error',label:'edge 55',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":8}),rule);
    expect(evaluation.actual).toBe(8);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":8}),{id:'b55',metric:"import-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(8);
    expect(budget.status).toBe('near');
  });
  it("threshold edge import-cycles 8 1", () => {
    const rule:GovernanceRule={id:'t56',metric:"import-cycles",comparator:'<=',threshold:8,severity:'error',label:'edge 56',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":9}),rule);
    expect(evaluation.actual).toBe(9);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":9}),{id:'b56',metric:"import-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(9);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge import-cycles 16 -1", () => {
    const rule:GovernanceRule={id:'t57',metric:"import-cycles",comparator:'<=',threshold:16,severity:'error',label:'edge 57',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":15}),rule);
    expect(evaluation.actual).toBe(15);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":15}),{id:'b57',metric:"import-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(15);
    expect(budget.status).toBe('near');
  });
  it("threshold edge import-cycles 16 0", () => {
    const rule:GovernanceRule={id:'t58',metric:"import-cycles",comparator:'<=',threshold:16,severity:'error',label:'edge 58',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":16}),rule);
    expect(evaluation.actual).toBe(16);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":16}),{id:'b58',metric:"import-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(16);
    expect(budget.status).toBe('near');
  });
  it("threshold edge import-cycles 16 1", () => {
    const rule:GovernanceRule={id:'t59',metric:"import-cycles",comparator:'<=',threshold:16,severity:'error',label:'edge 59',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"import-cycles":17}),rule);
    expect(evaluation.actual).toBe(17);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"import-cycles":17}),{id:'b59',metric:"import-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(17);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge call-cycles 1 -1", () => {
    const rule:GovernanceRule={id:'t60',metric:"call-cycles",comparator:'<=',threshold:1,severity:'error',label:'edge 60',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(evaluation.actual).toBe(0);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":0}),{id:'b60',metric:"call-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(0);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge call-cycles 1 0", () => {
    const rule:GovernanceRule={id:'t61',metric:"call-cycles",comparator:'<=',threshold:1,severity:'error',label:'edge 61',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":1}),{id:'b61',metric:"call-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('near');
  });
  it("threshold edge call-cycles 1 1", () => {
    const rule:GovernanceRule={id:'t62',metric:"call-cycles",comparator:'<=',threshold:1,severity:'error',label:'edge 62',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":2}),{id:'b62',metric:"call-cycles",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge call-cycles 2 -1", () => {
    const rule:GovernanceRule={id:'t63',metric:"call-cycles",comparator:'<=',threshold:2,severity:'error',label:'edge 63',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":1}),{id:'b63',metric:"call-cycles",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge call-cycles 2 0", () => {
    const rule:GovernanceRule={id:'t64',metric:"call-cycles",comparator:'<=',threshold:2,severity:'error',label:'edge 64',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":2}),{id:'b64',metric:"call-cycles",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('near');
  });
  it("threshold edge call-cycles 2 1", () => {
    const rule:GovernanceRule={id:'t65',metric:"call-cycles",comparator:'<=',threshold:2,severity:'error',label:'edge 65',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":3}),{id:'b65',metric:"call-cycles",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge call-cycles 4 -1", () => {
    const rule:GovernanceRule={id:'t66',metric:"call-cycles",comparator:'<=',threshold:4,severity:'error',label:'edge 66',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":3}),{id:'b66',metric:"call-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('near');
  });
  it("threshold edge call-cycles 4 0", () => {
    const rule:GovernanceRule={id:'t67',metric:"call-cycles",comparator:'<=',threshold:4,severity:'error',label:'edge 67',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":4}),rule);
    expect(evaluation.actual).toBe(4);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":4}),{id:'b67',metric:"call-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(4);
    expect(budget.status).toBe('near');
  });
  it("threshold edge call-cycles 4 1", () => {
    const rule:GovernanceRule={id:'t68',metric:"call-cycles",comparator:'<=',threshold:4,severity:'error',label:'edge 68',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":5}),rule);
    expect(evaluation.actual).toBe(5);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":5}),{id:'b68',metric:"call-cycles",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(5);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge call-cycles 8 -1", () => {
    const rule:GovernanceRule={id:'t69',metric:"call-cycles",comparator:'<=',threshold:8,severity:'error',label:'edge 69',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":7}),rule);
    expect(evaluation.actual).toBe(7);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":7}),{id:'b69',metric:"call-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(7);
    expect(budget.status).toBe('near');
  });
  it("threshold edge call-cycles 8 0", () => {
    const rule:GovernanceRule={id:'t70',metric:"call-cycles",comparator:'<=',threshold:8,severity:'error',label:'edge 70',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":8}),rule);
    expect(evaluation.actual).toBe(8);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":8}),{id:'b70',metric:"call-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(8);
    expect(budget.status).toBe('near');
  });
  it("threshold edge call-cycles 8 1", () => {
    const rule:GovernanceRule={id:'t71',metric:"call-cycles",comparator:'<=',threshold:8,severity:'error',label:'edge 71',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":9}),rule);
    expect(evaluation.actual).toBe(9);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":9}),{id:'b71',metric:"call-cycles",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(9);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge call-cycles 16 -1", () => {
    const rule:GovernanceRule={id:'t72',metric:"call-cycles",comparator:'<=',threshold:16,severity:'error',label:'edge 72',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":15}),rule);
    expect(evaluation.actual).toBe(15);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":15}),{id:'b72',metric:"call-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(15);
    expect(budget.status).toBe('near');
  });
  it("threshold edge call-cycles 16 0", () => {
    const rule:GovernanceRule={id:'t73',metric:"call-cycles",comparator:'<=',threshold:16,severity:'error',label:'edge 73',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":16}),rule);
    expect(evaluation.actual).toBe(16);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":16}),{id:'b73',metric:"call-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(16);
    expect(budget.status).toBe('near');
  });
  it("threshold edge call-cycles 16 1", () => {
    const rule:GovernanceRule={id:'t74',metric:"call-cycles",comparator:'<=',threshold:16,severity:'error',label:'edge 74',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"call-cycles":17}),rule);
    expect(evaluation.actual).toBe(17);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"call-cycles":17}),{id:'b74',metric:"call-cycles",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(17);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge critical-hotspots 1 -1", () => {
    const rule:GovernanceRule={id:'t75',metric:"critical-hotspots",comparator:'<=',threshold:1,severity:'error',label:'edge 75',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(evaluation.actual).toBe(0);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":0}),{id:'b75',metric:"critical-hotspots",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(0);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge critical-hotspots 1 0", () => {
    const rule:GovernanceRule={id:'t76',metric:"critical-hotspots",comparator:'<=',threshold:1,severity:'error',label:'edge 76',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":1}),{id:'b76',metric:"critical-hotspots",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('near');
  });
  it("threshold edge critical-hotspots 1 1", () => {
    const rule:GovernanceRule={id:'t77',metric:"critical-hotspots",comparator:'<=',threshold:1,severity:'error',label:'edge 77',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":2}),{id:'b77',metric:"critical-hotspots",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge critical-hotspots 2 -1", () => {
    const rule:GovernanceRule={id:'t78',metric:"critical-hotspots",comparator:'<=',threshold:2,severity:'error',label:'edge 78',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":1}),{id:'b78',metric:"critical-hotspots",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge critical-hotspots 2 0", () => {
    const rule:GovernanceRule={id:'t79',metric:"critical-hotspots",comparator:'<=',threshold:2,severity:'error',label:'edge 79',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":2}),{id:'b79',metric:"critical-hotspots",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('near');
  });
  it("threshold edge critical-hotspots 2 1", () => {
    const rule:GovernanceRule={id:'t80',metric:"critical-hotspots",comparator:'<=',threshold:2,severity:'error',label:'edge 80',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":3}),{id:'b80',metric:"critical-hotspots",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge critical-hotspots 4 -1", () => {
    const rule:GovernanceRule={id:'t81',metric:"critical-hotspots",comparator:'<=',threshold:4,severity:'error',label:'edge 81',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":3}),{id:'b81',metric:"critical-hotspots",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('near');
  });
  it("threshold edge critical-hotspots 4 0", () => {
    const rule:GovernanceRule={id:'t82',metric:"critical-hotspots",comparator:'<=',threshold:4,severity:'error',label:'edge 82',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":4}),rule);
    expect(evaluation.actual).toBe(4);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":4}),{id:'b82',metric:"critical-hotspots",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(4);
    expect(budget.status).toBe('near');
  });
  it("threshold edge critical-hotspots 4 1", () => {
    const rule:GovernanceRule={id:'t83',metric:"critical-hotspots",comparator:'<=',threshold:4,severity:'error',label:'edge 83',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":5}),rule);
    expect(evaluation.actual).toBe(5);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":5}),{id:'b83',metric:"critical-hotspots",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(5);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge critical-hotspots 8 -1", () => {
    const rule:GovernanceRule={id:'t84',metric:"critical-hotspots",comparator:'<=',threshold:8,severity:'error',label:'edge 84',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":7}),rule);
    expect(evaluation.actual).toBe(7);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":7}),{id:'b84',metric:"critical-hotspots",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(7);
    expect(budget.status).toBe('near');
  });
  it("threshold edge critical-hotspots 8 0", () => {
    const rule:GovernanceRule={id:'t85',metric:"critical-hotspots",comparator:'<=',threshold:8,severity:'error',label:'edge 85',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":8}),rule);
    expect(evaluation.actual).toBe(8);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":8}),{id:'b85',metric:"critical-hotspots",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(8);
    expect(budget.status).toBe('near');
  });
  it("threshold edge critical-hotspots 8 1", () => {
    const rule:GovernanceRule={id:'t86',metric:"critical-hotspots",comparator:'<=',threshold:8,severity:'error',label:'edge 86',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":9}),rule);
    expect(evaluation.actual).toBe(9);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":9}),{id:'b86',metric:"critical-hotspots",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(9);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge critical-hotspots 16 -1", () => {
    const rule:GovernanceRule={id:'t87',metric:"critical-hotspots",comparator:'<=',threshold:16,severity:'error',label:'edge 87',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":15}),rule);
    expect(evaluation.actual).toBe(15);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":15}),{id:'b87',metric:"critical-hotspots",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(15);
    expect(budget.status).toBe('near');
  });
  it("threshold edge critical-hotspots 16 0", () => {
    const rule:GovernanceRule={id:'t88',metric:"critical-hotspots",comparator:'<=',threshold:16,severity:'error',label:'edge 88',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":16}),rule);
    expect(evaluation.actual).toBe(16);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":16}),{id:'b88',metric:"critical-hotspots",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(16);
    expect(budget.status).toBe('near');
  });
  it("threshold edge critical-hotspots 16 1", () => {
    const rule:GovernanceRule={id:'t89',metric:"critical-hotspots",comparator:'<=',threshold:16,severity:'error',label:'edge 89',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"critical-hotspots":17}),rule);
    expect(evaluation.actual).toBe(17);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"critical-hotspots":17}),{id:'b89',metric:"critical-hotspots",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(17);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge coverage-gaps 1 -1", () => {
    const rule:GovernanceRule={id:'t90',metric:"coverage-gaps",comparator:'<=',threshold:1,severity:'error',label:'edge 90',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(evaluation.actual).toBe(0);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":0}),{id:'b90',metric:"coverage-gaps",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(0);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge coverage-gaps 1 0", () => {
    const rule:GovernanceRule={id:'t91',metric:"coverage-gaps",comparator:'<=',threshold:1,severity:'error',label:'edge 91',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":1}),{id:'b91',metric:"coverage-gaps",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('near');
  });
  it("threshold edge coverage-gaps 1 1", () => {
    const rule:GovernanceRule={id:'t92',metric:"coverage-gaps",comparator:'<=',threshold:1,severity:'error',label:'edge 92',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":2}),{id:'b92',metric:"coverage-gaps",limit:1,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge coverage-gaps 2 -1", () => {
    const rule:GovernanceRule={id:'t93',metric:"coverage-gaps",comparator:'<=',threshold:2,severity:'error',label:'edge 93',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":1}),rule);
    expect(evaluation.actual).toBe(1);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":1}),{id:'b93',metric:"coverage-gaps",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(1);
    expect(budget.status).toBe('healthy');
  });
  it("threshold edge coverage-gaps 2 0", () => {
    const rule:GovernanceRule={id:'t94',metric:"coverage-gaps",comparator:'<=',threshold:2,severity:'error',label:'edge 94',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":2}),rule);
    expect(evaluation.actual).toBe(2);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":2}),{id:'b94',metric:"coverage-gaps",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(2);
    expect(budget.status).toBe('near');
  });
  it("threshold edge coverage-gaps 2 1", () => {
    const rule:GovernanceRule={id:'t95',metric:"coverage-gaps",comparator:'<=',threshold:2,severity:'error',label:'edge 95',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":3}),{id:'b95',metric:"coverage-gaps",limit:2,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge coverage-gaps 4 -1", () => {
    const rule:GovernanceRule={id:'t96',metric:"coverage-gaps",comparator:'<=',threshold:4,severity:'error',label:'edge 96',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":3}),rule);
    expect(evaluation.actual).toBe(3);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":3}),{id:'b96',metric:"coverage-gaps",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(3);
    expect(budget.status).toBe('near');
  });
  it("threshold edge coverage-gaps 4 0", () => {
    const rule:GovernanceRule={id:'t97',metric:"coverage-gaps",comparator:'<=',threshold:4,severity:'error',label:'edge 97',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":4}),rule);
    expect(evaluation.actual).toBe(4);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":4}),{id:'b97',metric:"coverage-gaps",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(4);
    expect(budget.status).toBe('near');
  });
  it("threshold edge coverage-gaps 4 1", () => {
    const rule:GovernanceRule={id:'t98',metric:"coverage-gaps",comparator:'<=',threshold:4,severity:'error',label:'edge 98',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":5}),rule);
    expect(evaluation.actual).toBe(5);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":5}),{id:'b98',metric:"coverage-gaps",limit:4,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(5);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge coverage-gaps 8 -1", () => {
    const rule:GovernanceRule={id:'t99',metric:"coverage-gaps",comparator:'<=',threshold:8,severity:'error',label:'edge 99',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":7}),rule);
    expect(evaluation.actual).toBe(7);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":7}),{id:'b99',metric:"coverage-gaps",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(7);
    expect(budget.status).toBe('near');
  });
  it("threshold edge coverage-gaps 8 0", () => {
    const rule:GovernanceRule={id:'t100',metric:"coverage-gaps",comparator:'<=',threshold:8,severity:'error',label:'edge 100',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":8}),rule);
    expect(evaluation.actual).toBe(8);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":8}),{id:'b100',metric:"coverage-gaps",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(8);
    expect(budget.status).toBe('near');
  });
  it("threshold edge coverage-gaps 8 1", () => {
    const rule:GovernanceRule={id:'t101',metric:"coverage-gaps",comparator:'<=',threshold:8,severity:'error',label:'edge 101',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":9}),rule);
    expect(evaluation.actual).toBe(9);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":9}),{id:'b101',metric:"coverage-gaps",limit:8,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(9);
    expect(budget.status).toBe('exceeded');
  });
  it("threshold edge coverage-gaps 16 -1", () => {
    const rule:GovernanceRule={id:'t102',metric:"coverage-gaps",comparator:'<=',threshold:16,severity:'error',label:'edge 102',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":15}),rule);
    expect(evaluation.actual).toBe(15);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":15}),{id:'b102',metric:"coverage-gaps",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(15);
    expect(budget.status).toBe('near');
  });
  it("threshold edge coverage-gaps 16 0", () => {
    const rule:GovernanceRule={id:'t103',metric:"coverage-gaps",comparator:'<=',threshold:16,severity:'error',label:'edge 103',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":16}),rule);
    expect(evaluation.actual).toBe(16);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.distance).toBe(0);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":16}),{id:'b103',metric:"coverage-gaps",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(16);
    expect(budget.status).toBe('near');
  });
  it("threshold edge coverage-gaps 16 1", () => {
    const rule:GovernanceRule={id:'t104',metric:"coverage-gaps",comparator:'<=',threshold:16,severity:'error',label:'edge 104',enabled:true};
    const evaluation=evaluateGovernanceRule(facts({"coverage-gaps":17}),rule);
    expect(evaluation.actual).toBe(17);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.distance).toBe(1);
    const budget=evaluateArchitectureBudget(facts({"coverage-gaps":17}),{id:'b104',metric:"coverage-gaps",limit:16,warningRatio:0.75,enabled:true});
    expect(budget.actual).toBe(17);
    expect(budget.status).toBe('exceeded');
  });
});
