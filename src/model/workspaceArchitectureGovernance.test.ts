import { describe,it,expect } from 'vitest';
import { evaluateGovernanceRule,createGovernanceProfile,collectGovernanceFacts,normalizeGovernanceRule,governanceMetricLabel,GOVERNANCE_METRICS,type GovernanceRule } from './workspaceArchitectureGovernance';
import { facts,architectureFixture } from '../test/workspaceArchitectureGovernanceFixtures';
describe('workspace architecture governance policy',()=>{
  it("unresolved-imports comparator <= case 0/0", () => {
    const rule:GovernanceRule={id:'r0',metric:"unresolved-imports",comparator:"<=",threshold:0,severity:'warning',label:'case 0',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 0');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator <= case 1/0", () => {
    const rule:GovernanceRule={id:'r1',metric:"unresolved-imports",comparator:"<=",threshold:0,severity:'warning',label:'case 1',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 1');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator <= case 0/1", () => {
    const rule:GovernanceRule={id:'r2',metric:"unresolved-imports",comparator:"<=",threshold:1,severity:'warning',label:'case 2',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 2');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator <= case 4/4", () => {
    const rule:GovernanceRule={id:'r3',metric:"unresolved-imports",comparator:"<=",threshold:4,severity:'warning',label:'case 3',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 3');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator <= case 5/4", () => {
    const rule:GovernanceRule={id:'r4',metric:"unresolved-imports",comparator:"<=",threshold:4,severity:'warning',label:'case 4',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 4');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator >= case 0/0", () => {
    const rule:GovernanceRule={id:'r5',metric:"unresolved-imports",comparator:">=",threshold:0,severity:'warning',label:'case 5',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 5');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator >= case 1/0", () => {
    const rule:GovernanceRule={id:'r6',metric:"unresolved-imports",comparator:">=",threshold:0,severity:'warning',label:'case 6',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 6');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator >= case 0/1", () => {
    const rule:GovernanceRule={id:'r7',metric:"unresolved-imports",comparator:">=",threshold:1,severity:'warning',label:'case 7',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 7');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator >= case 4/4", () => {
    const rule:GovernanceRule={id:'r8',metric:"unresolved-imports",comparator:">=",threshold:4,severity:'warning',label:'case 8',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 8');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator >= case 5/4", () => {
    const rule:GovernanceRule={id:'r9',metric:"unresolved-imports",comparator:">=",threshold:4,severity:'warning',label:'case 9',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 9');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator == case 0/0", () => {
    const rule:GovernanceRule={id:'r10',metric:"unresolved-imports",comparator:"==",threshold:0,severity:'warning',label:'case 10',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 10');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator == case 1/0", () => {
    const rule:GovernanceRule={id:'r11',metric:"unresolved-imports",comparator:"==",threshold:0,severity:'warning',label:'case 11',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 11');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator == case 0/1", () => {
    const rule:GovernanceRule={id:'r12',metric:"unresolved-imports",comparator:"==",threshold:1,severity:'warning',label:'case 12',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 12');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator == case 4/4", () => {
    const rule:GovernanceRule={id:'r13',metric:"unresolved-imports",comparator:"==",threshold:4,severity:'warning',label:'case 13',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 13');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator == case 5/4", () => {
    const rule:GovernanceRule={id:'r14',metric:"unresolved-imports",comparator:"==",threshold:4,severity:'warning',label:'case 14',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 14');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator < case 0/0", () => {
    const rule:GovernanceRule={id:'r15',metric:"unresolved-imports",comparator:"<",threshold:0,severity:'warning',label:'case 15',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 15');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator < case 1/0", () => {
    const rule:GovernanceRule={id:'r16',metric:"unresolved-imports",comparator:"<",threshold:0,severity:'warning',label:'case 16',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 16');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator < case 0/1", () => {
    const rule:GovernanceRule={id:'r17',metric:"unresolved-imports",comparator:"<",threshold:1,severity:'warning',label:'case 17',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 17');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator < case 4/4", () => {
    const rule:GovernanceRule={id:'r18',metric:"unresolved-imports",comparator:"<",threshold:4,severity:'warning',label:'case 18',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 18');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator < case 5/4", () => {
    const rule:GovernanceRule={id:'r19',metric:"unresolved-imports",comparator:"<",threshold:4,severity:'warning',label:'case 19',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 19');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator > case 0/0", () => {
    const rule:GovernanceRule={id:'r20',metric:"unresolved-imports",comparator:">",threshold:0,severity:'warning',label:'case 20',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 20');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator > case 1/0", () => {
    const rule:GovernanceRule={id:'r21',metric:"unresolved-imports",comparator:">",threshold:0,severity:'warning',label:'case 21',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 21');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator > case 0/1", () => {
    const rule:GovernanceRule={id:'r22',metric:"unresolved-imports",comparator:">",threshold:1,severity:'warning',label:'case 22',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 22');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator > case 4/4", () => {
    const rule:GovernanceRule={id:'r23',metric:"unresolved-imports",comparator:">",threshold:4,severity:'warning',label:'case 23',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 23');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unresolved-imports comparator > case 5/4", () => {
    const rule:GovernanceRule={id:'r24',metric:"unresolved-imports",comparator:">",threshold:4,severity:'warning',label:'case 24',enabled:true};
    const result=evaluateGovernanceRule(facts({"unresolved-imports":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 24');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator <= case 0/0", () => {
    const rule:GovernanceRule={id:'r25',metric:"ambiguous-calls",comparator:"<=",threshold:0,severity:'warning',label:'case 25',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 25');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator <= case 1/0", () => {
    const rule:GovernanceRule={id:'r26',metric:"ambiguous-calls",comparator:"<=",threshold:0,severity:'warning',label:'case 26',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 26');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator <= case 0/1", () => {
    const rule:GovernanceRule={id:'r27',metric:"ambiguous-calls",comparator:"<=",threshold:1,severity:'warning',label:'case 27',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 27');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator <= case 4/4", () => {
    const rule:GovernanceRule={id:'r28',metric:"ambiguous-calls",comparator:"<=",threshold:4,severity:'warning',label:'case 28',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 28');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator <= case 5/4", () => {
    const rule:GovernanceRule={id:'r29',metric:"ambiguous-calls",comparator:"<=",threshold:4,severity:'warning',label:'case 29',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 29');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator >= case 0/0", () => {
    const rule:GovernanceRule={id:'r30',metric:"ambiguous-calls",comparator:">=",threshold:0,severity:'warning',label:'case 30',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 30');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator >= case 1/0", () => {
    const rule:GovernanceRule={id:'r31',metric:"ambiguous-calls",comparator:">=",threshold:0,severity:'warning',label:'case 31',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 31');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator >= case 0/1", () => {
    const rule:GovernanceRule={id:'r32',metric:"ambiguous-calls",comparator:">=",threshold:1,severity:'warning',label:'case 32',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 32');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator >= case 4/4", () => {
    const rule:GovernanceRule={id:'r33',metric:"ambiguous-calls",comparator:">=",threshold:4,severity:'warning',label:'case 33',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 33');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator >= case 5/4", () => {
    const rule:GovernanceRule={id:'r34',metric:"ambiguous-calls",comparator:">=",threshold:4,severity:'warning',label:'case 34',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 34');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator == case 0/0", () => {
    const rule:GovernanceRule={id:'r35',metric:"ambiguous-calls",comparator:"==",threshold:0,severity:'warning',label:'case 35',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 35');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator == case 1/0", () => {
    const rule:GovernanceRule={id:'r36',metric:"ambiguous-calls",comparator:"==",threshold:0,severity:'warning',label:'case 36',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 36');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator == case 0/1", () => {
    const rule:GovernanceRule={id:'r37',metric:"ambiguous-calls",comparator:"==",threshold:1,severity:'warning',label:'case 37',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 37');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator == case 4/4", () => {
    const rule:GovernanceRule={id:'r38',metric:"ambiguous-calls",comparator:"==",threshold:4,severity:'warning',label:'case 38',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 38');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator == case 5/4", () => {
    const rule:GovernanceRule={id:'r39',metric:"ambiguous-calls",comparator:"==",threshold:4,severity:'warning',label:'case 39',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 39');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator < case 0/0", () => {
    const rule:GovernanceRule={id:'r40',metric:"ambiguous-calls",comparator:"<",threshold:0,severity:'warning',label:'case 40',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 40');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator < case 1/0", () => {
    const rule:GovernanceRule={id:'r41',metric:"ambiguous-calls",comparator:"<",threshold:0,severity:'warning',label:'case 41',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 41');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator < case 0/1", () => {
    const rule:GovernanceRule={id:'r42',metric:"ambiguous-calls",comparator:"<",threshold:1,severity:'warning',label:'case 42',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 42');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator < case 4/4", () => {
    const rule:GovernanceRule={id:'r43',metric:"ambiguous-calls",comparator:"<",threshold:4,severity:'warning',label:'case 43',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 43');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator < case 5/4", () => {
    const rule:GovernanceRule={id:'r44',metric:"ambiguous-calls",comparator:"<",threshold:4,severity:'warning',label:'case 44',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 44');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator > case 0/0", () => {
    const rule:GovernanceRule={id:'r45',metric:"ambiguous-calls",comparator:">",threshold:0,severity:'warning',label:'case 45',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 45');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator > case 1/0", () => {
    const rule:GovernanceRule={id:'r46',metric:"ambiguous-calls",comparator:">",threshold:0,severity:'warning',label:'case 46',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 46');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator > case 0/1", () => {
    const rule:GovernanceRule={id:'r47',metric:"ambiguous-calls",comparator:">",threshold:1,severity:'warning',label:'case 47',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 47');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator > case 4/4", () => {
    const rule:GovernanceRule={id:'r48',metric:"ambiguous-calls",comparator:">",threshold:4,severity:'warning',label:'case 48',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 48');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("ambiguous-calls comparator > case 5/4", () => {
    const rule:GovernanceRule={id:'r49',metric:"ambiguous-calls",comparator:">",threshold:4,severity:'warning',label:'case 49',enabled:true};
    const result=evaluateGovernanceRule(facts({"ambiguous-calls":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 49');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator <= case 0/0", () => {
    const rule:GovernanceRule={id:'r50',metric:"unmatched-calls",comparator:"<=",threshold:0,severity:'warning',label:'case 50',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 50');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator <= case 1/0", () => {
    const rule:GovernanceRule={id:'r51',metric:"unmatched-calls",comparator:"<=",threshold:0,severity:'warning',label:'case 51',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 51');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator <= case 0/1", () => {
    const rule:GovernanceRule={id:'r52',metric:"unmatched-calls",comparator:"<=",threshold:1,severity:'warning',label:'case 52',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 52');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator <= case 4/4", () => {
    const rule:GovernanceRule={id:'r53',metric:"unmatched-calls",comparator:"<=",threshold:4,severity:'warning',label:'case 53',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 53');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator <= case 5/4", () => {
    const rule:GovernanceRule={id:'r54',metric:"unmatched-calls",comparator:"<=",threshold:4,severity:'warning',label:'case 54',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 54');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator >= case 0/0", () => {
    const rule:GovernanceRule={id:'r55',metric:"unmatched-calls",comparator:">=",threshold:0,severity:'warning',label:'case 55',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 55');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator >= case 1/0", () => {
    const rule:GovernanceRule={id:'r56',metric:"unmatched-calls",comparator:">=",threshold:0,severity:'warning',label:'case 56',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 56');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator >= case 0/1", () => {
    const rule:GovernanceRule={id:'r57',metric:"unmatched-calls",comparator:">=",threshold:1,severity:'warning',label:'case 57',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 57');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator >= case 4/4", () => {
    const rule:GovernanceRule={id:'r58',metric:"unmatched-calls",comparator:">=",threshold:4,severity:'warning',label:'case 58',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 58');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator >= case 5/4", () => {
    const rule:GovernanceRule={id:'r59',metric:"unmatched-calls",comparator:">=",threshold:4,severity:'warning',label:'case 59',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 59');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator == case 0/0", () => {
    const rule:GovernanceRule={id:'r60',metric:"unmatched-calls",comparator:"==",threshold:0,severity:'warning',label:'case 60',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 60');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator == case 1/0", () => {
    const rule:GovernanceRule={id:'r61',metric:"unmatched-calls",comparator:"==",threshold:0,severity:'warning',label:'case 61',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 61');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator == case 0/1", () => {
    const rule:GovernanceRule={id:'r62',metric:"unmatched-calls",comparator:"==",threshold:1,severity:'warning',label:'case 62',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 62');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator == case 4/4", () => {
    const rule:GovernanceRule={id:'r63',metric:"unmatched-calls",comparator:"==",threshold:4,severity:'warning',label:'case 63',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 63');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator == case 5/4", () => {
    const rule:GovernanceRule={id:'r64',metric:"unmatched-calls",comparator:"==",threshold:4,severity:'warning',label:'case 64',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 64');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator < case 0/0", () => {
    const rule:GovernanceRule={id:'r65',metric:"unmatched-calls",comparator:"<",threshold:0,severity:'warning',label:'case 65',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 65');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator < case 1/0", () => {
    const rule:GovernanceRule={id:'r66',metric:"unmatched-calls",comparator:"<",threshold:0,severity:'warning',label:'case 66',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 66');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator < case 0/1", () => {
    const rule:GovernanceRule={id:'r67',metric:"unmatched-calls",comparator:"<",threshold:1,severity:'warning',label:'case 67',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 67');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator < case 4/4", () => {
    const rule:GovernanceRule={id:'r68',metric:"unmatched-calls",comparator:"<",threshold:4,severity:'warning',label:'case 68',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 68');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator < case 5/4", () => {
    const rule:GovernanceRule={id:'r69',metric:"unmatched-calls",comparator:"<",threshold:4,severity:'warning',label:'case 69',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 69');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator > case 0/0", () => {
    const rule:GovernanceRule={id:'r70',metric:"unmatched-calls",comparator:">",threshold:0,severity:'warning',label:'case 70',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 70');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator > case 1/0", () => {
    const rule:GovernanceRule={id:'r71',metric:"unmatched-calls",comparator:">",threshold:0,severity:'warning',label:'case 71',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 71');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator > case 0/1", () => {
    const rule:GovernanceRule={id:'r72',metric:"unmatched-calls",comparator:">",threshold:1,severity:'warning',label:'case 72',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 72');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator > case 4/4", () => {
    const rule:GovernanceRule={id:'r73',metric:"unmatched-calls",comparator:">",threshold:4,severity:'warning',label:'case 73',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 73');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("unmatched-calls comparator > case 5/4", () => {
    const rule:GovernanceRule={id:'r74',metric:"unmatched-calls",comparator:">",threshold:4,severity:'warning',label:'case 74',enabled:true};
    const result=evaluateGovernanceRule(facts({"unmatched-calls":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 74');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator <= case 0/0", () => {
    const rule:GovernanceRule={id:'r75',metric:"import-cycles",comparator:"<=",threshold:0,severity:'warning',label:'case 75',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 75');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator <= case 1/0", () => {
    const rule:GovernanceRule={id:'r76',metric:"import-cycles",comparator:"<=",threshold:0,severity:'warning',label:'case 76',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 76');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator <= case 0/1", () => {
    const rule:GovernanceRule={id:'r77',metric:"import-cycles",comparator:"<=",threshold:1,severity:'warning',label:'case 77',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 77');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator <= case 4/4", () => {
    const rule:GovernanceRule={id:'r78',metric:"import-cycles",comparator:"<=",threshold:4,severity:'warning',label:'case 78',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 78');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator <= case 5/4", () => {
    const rule:GovernanceRule={id:'r79',metric:"import-cycles",comparator:"<=",threshold:4,severity:'warning',label:'case 79',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 79');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator >= case 0/0", () => {
    const rule:GovernanceRule={id:'r80',metric:"import-cycles",comparator:">=",threshold:0,severity:'warning',label:'case 80',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 80');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator >= case 1/0", () => {
    const rule:GovernanceRule={id:'r81',metric:"import-cycles",comparator:">=",threshold:0,severity:'warning',label:'case 81',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 81');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator >= case 0/1", () => {
    const rule:GovernanceRule={id:'r82',metric:"import-cycles",comparator:">=",threshold:1,severity:'warning',label:'case 82',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 82');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator >= case 4/4", () => {
    const rule:GovernanceRule={id:'r83',metric:"import-cycles",comparator:">=",threshold:4,severity:'warning',label:'case 83',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 83');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator >= case 5/4", () => {
    const rule:GovernanceRule={id:'r84',metric:"import-cycles",comparator:">=",threshold:4,severity:'warning',label:'case 84',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 84');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator == case 0/0", () => {
    const rule:GovernanceRule={id:'r85',metric:"import-cycles",comparator:"==",threshold:0,severity:'warning',label:'case 85',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 85');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator == case 1/0", () => {
    const rule:GovernanceRule={id:'r86',metric:"import-cycles",comparator:"==",threshold:0,severity:'warning',label:'case 86',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 86');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator == case 0/1", () => {
    const rule:GovernanceRule={id:'r87',metric:"import-cycles",comparator:"==",threshold:1,severity:'warning',label:'case 87',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 87');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator == case 4/4", () => {
    const rule:GovernanceRule={id:'r88',metric:"import-cycles",comparator:"==",threshold:4,severity:'warning',label:'case 88',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 88');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator == case 5/4", () => {
    const rule:GovernanceRule={id:'r89',metric:"import-cycles",comparator:"==",threshold:4,severity:'warning',label:'case 89',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 89');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator < case 0/0", () => {
    const rule:GovernanceRule={id:'r90',metric:"import-cycles",comparator:"<",threshold:0,severity:'warning',label:'case 90',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 90');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator < case 1/0", () => {
    const rule:GovernanceRule={id:'r91',metric:"import-cycles",comparator:"<",threshold:0,severity:'warning',label:'case 91',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 91');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator < case 0/1", () => {
    const rule:GovernanceRule={id:'r92',metric:"import-cycles",comparator:"<",threshold:1,severity:'warning',label:'case 92',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 92');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator < case 4/4", () => {
    const rule:GovernanceRule={id:'r93',metric:"import-cycles",comparator:"<",threshold:4,severity:'warning',label:'case 93',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 93');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator < case 5/4", () => {
    const rule:GovernanceRule={id:'r94',metric:"import-cycles",comparator:"<",threshold:4,severity:'warning',label:'case 94',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 94');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator > case 0/0", () => {
    const rule:GovernanceRule={id:'r95',metric:"import-cycles",comparator:">",threshold:0,severity:'warning',label:'case 95',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 95');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator > case 1/0", () => {
    const rule:GovernanceRule={id:'r96',metric:"import-cycles",comparator:">",threshold:0,severity:'warning',label:'case 96',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 96');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator > case 0/1", () => {
    const rule:GovernanceRule={id:'r97',metric:"import-cycles",comparator:">",threshold:1,severity:'warning',label:'case 97',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 97');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator > case 4/4", () => {
    const rule:GovernanceRule={id:'r98',metric:"import-cycles",comparator:">",threshold:4,severity:'warning',label:'case 98',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 98');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("import-cycles comparator > case 5/4", () => {
    const rule:GovernanceRule={id:'r99',metric:"import-cycles",comparator:">",threshold:4,severity:'warning',label:'case 99',enabled:true};
    const result=evaluateGovernanceRule(facts({"import-cycles":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 99');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator <= case 0/0", () => {
    const rule:GovernanceRule={id:'r100',metric:"call-cycles",comparator:"<=",threshold:0,severity:'warning',label:'case 100',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 100');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator <= case 1/0", () => {
    const rule:GovernanceRule={id:'r101',metric:"call-cycles",comparator:"<=",threshold:0,severity:'warning',label:'case 101',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 101');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator <= case 0/1", () => {
    const rule:GovernanceRule={id:'r102',metric:"call-cycles",comparator:"<=",threshold:1,severity:'warning',label:'case 102',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 102');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator <= case 4/4", () => {
    const rule:GovernanceRule={id:'r103',metric:"call-cycles",comparator:"<=",threshold:4,severity:'warning',label:'case 103',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 103');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator <= case 5/4", () => {
    const rule:GovernanceRule={id:'r104',metric:"call-cycles",comparator:"<=",threshold:4,severity:'warning',label:'case 104',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 104');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator >= case 0/0", () => {
    const rule:GovernanceRule={id:'r105',metric:"call-cycles",comparator:">=",threshold:0,severity:'warning',label:'case 105',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 105');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator >= case 1/0", () => {
    const rule:GovernanceRule={id:'r106',metric:"call-cycles",comparator:">=",threshold:0,severity:'warning',label:'case 106',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 106');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator >= case 0/1", () => {
    const rule:GovernanceRule={id:'r107',metric:"call-cycles",comparator:">=",threshold:1,severity:'warning',label:'case 107',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 107');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator >= case 4/4", () => {
    const rule:GovernanceRule={id:'r108',metric:"call-cycles",comparator:">=",threshold:4,severity:'warning',label:'case 108',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 108');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator >= case 5/4", () => {
    const rule:GovernanceRule={id:'r109',metric:"call-cycles",comparator:">=",threshold:4,severity:'warning',label:'case 109',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 109');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator == case 0/0", () => {
    const rule:GovernanceRule={id:'r110',metric:"call-cycles",comparator:"==",threshold:0,severity:'warning',label:'case 110',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 110');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator == case 1/0", () => {
    const rule:GovernanceRule={id:'r111',metric:"call-cycles",comparator:"==",threshold:0,severity:'warning',label:'case 111',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 111');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator == case 0/1", () => {
    const rule:GovernanceRule={id:'r112',metric:"call-cycles",comparator:"==",threshold:1,severity:'warning',label:'case 112',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 112');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator == case 4/4", () => {
    const rule:GovernanceRule={id:'r113',metric:"call-cycles",comparator:"==",threshold:4,severity:'warning',label:'case 113',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 113');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator == case 5/4", () => {
    const rule:GovernanceRule={id:'r114',metric:"call-cycles",comparator:"==",threshold:4,severity:'warning',label:'case 114',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 114');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator < case 0/0", () => {
    const rule:GovernanceRule={id:'r115',metric:"call-cycles",comparator:"<",threshold:0,severity:'warning',label:'case 115',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 115');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator < case 1/0", () => {
    const rule:GovernanceRule={id:'r116',metric:"call-cycles",comparator:"<",threshold:0,severity:'warning',label:'case 116',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 116');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator < case 0/1", () => {
    const rule:GovernanceRule={id:'r117',metric:"call-cycles",comparator:"<",threshold:1,severity:'warning',label:'case 117',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 117');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator < case 4/4", () => {
    const rule:GovernanceRule={id:'r118',metric:"call-cycles",comparator:"<",threshold:4,severity:'warning',label:'case 118',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 118');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator < case 5/4", () => {
    const rule:GovernanceRule={id:'r119',metric:"call-cycles",comparator:"<",threshold:4,severity:'warning',label:'case 119',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 119');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator > case 0/0", () => {
    const rule:GovernanceRule={id:'r120',metric:"call-cycles",comparator:">",threshold:0,severity:'warning',label:'case 120',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 120');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator > case 1/0", () => {
    const rule:GovernanceRule={id:'r121',metric:"call-cycles",comparator:">",threshold:0,severity:'warning',label:'case 121',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 121');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator > case 0/1", () => {
    const rule:GovernanceRule={id:'r122',metric:"call-cycles",comparator:">",threshold:1,severity:'warning',label:'case 122',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 122');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator > case 4/4", () => {
    const rule:GovernanceRule={id:'r123',metric:"call-cycles",comparator:">",threshold:4,severity:'warning',label:'case 123',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 123');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("call-cycles comparator > case 5/4", () => {
    const rule:GovernanceRule={id:'r124',metric:"call-cycles",comparator:">",threshold:4,severity:'warning',label:'case 124',enabled:true};
    const result=evaluateGovernanceRule(facts({"call-cycles":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 124');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator <= case 0/0", () => {
    const rule:GovernanceRule={id:'r125',metric:"critical-hotspots",comparator:"<=",threshold:0,severity:'warning',label:'case 125',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 125');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator <= case 1/0", () => {
    const rule:GovernanceRule={id:'r126',metric:"critical-hotspots",comparator:"<=",threshold:0,severity:'warning',label:'case 126',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 126');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator <= case 0/1", () => {
    const rule:GovernanceRule={id:'r127',metric:"critical-hotspots",comparator:"<=",threshold:1,severity:'warning',label:'case 127',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 127');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator <= case 4/4", () => {
    const rule:GovernanceRule={id:'r128',metric:"critical-hotspots",comparator:"<=",threshold:4,severity:'warning',label:'case 128',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 128');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator <= case 5/4", () => {
    const rule:GovernanceRule={id:'r129',metric:"critical-hotspots",comparator:"<=",threshold:4,severity:'warning',label:'case 129',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 129');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator >= case 0/0", () => {
    const rule:GovernanceRule={id:'r130',metric:"critical-hotspots",comparator:">=",threshold:0,severity:'warning',label:'case 130',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 130');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator >= case 1/0", () => {
    const rule:GovernanceRule={id:'r131',metric:"critical-hotspots",comparator:">=",threshold:0,severity:'warning',label:'case 131',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 131');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator >= case 0/1", () => {
    const rule:GovernanceRule={id:'r132',metric:"critical-hotspots",comparator:">=",threshold:1,severity:'warning',label:'case 132',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 132');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator >= case 4/4", () => {
    const rule:GovernanceRule={id:'r133',metric:"critical-hotspots",comparator:">=",threshold:4,severity:'warning',label:'case 133',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 133');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator >= case 5/4", () => {
    const rule:GovernanceRule={id:'r134',metric:"critical-hotspots",comparator:">=",threshold:4,severity:'warning',label:'case 134',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 134');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator == case 0/0", () => {
    const rule:GovernanceRule={id:'r135',metric:"critical-hotspots",comparator:"==",threshold:0,severity:'warning',label:'case 135',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 135');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator == case 1/0", () => {
    const rule:GovernanceRule={id:'r136',metric:"critical-hotspots",comparator:"==",threshold:0,severity:'warning',label:'case 136',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 136');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator == case 0/1", () => {
    const rule:GovernanceRule={id:'r137',metric:"critical-hotspots",comparator:"==",threshold:1,severity:'warning',label:'case 137',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 137');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator == case 4/4", () => {
    const rule:GovernanceRule={id:'r138',metric:"critical-hotspots",comparator:"==",threshold:4,severity:'warning',label:'case 138',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 138');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator == case 5/4", () => {
    const rule:GovernanceRule={id:'r139',metric:"critical-hotspots",comparator:"==",threshold:4,severity:'warning',label:'case 139',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 139');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator < case 0/0", () => {
    const rule:GovernanceRule={id:'r140',metric:"critical-hotspots",comparator:"<",threshold:0,severity:'warning',label:'case 140',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 140');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator < case 1/0", () => {
    const rule:GovernanceRule={id:'r141',metric:"critical-hotspots",comparator:"<",threshold:0,severity:'warning',label:'case 141',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 141');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator < case 0/1", () => {
    const rule:GovernanceRule={id:'r142',metric:"critical-hotspots",comparator:"<",threshold:1,severity:'warning',label:'case 142',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 142');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator < case 4/4", () => {
    const rule:GovernanceRule={id:'r143',metric:"critical-hotspots",comparator:"<",threshold:4,severity:'warning',label:'case 143',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 143');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator < case 5/4", () => {
    const rule:GovernanceRule={id:'r144',metric:"critical-hotspots",comparator:"<",threshold:4,severity:'warning',label:'case 144',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 144');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator > case 0/0", () => {
    const rule:GovernanceRule={id:'r145',metric:"critical-hotspots",comparator:">",threshold:0,severity:'warning',label:'case 145',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 145');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator > case 1/0", () => {
    const rule:GovernanceRule={id:'r146',metric:"critical-hotspots",comparator:">",threshold:0,severity:'warning',label:'case 146',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 146');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator > case 0/1", () => {
    const rule:GovernanceRule={id:'r147',metric:"critical-hotspots",comparator:">",threshold:1,severity:'warning',label:'case 147',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 147');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator > case 4/4", () => {
    const rule:GovernanceRule={id:'r148',metric:"critical-hotspots",comparator:">",threshold:4,severity:'warning',label:'case 148',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 148');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("critical-hotspots comparator > case 5/4", () => {
    const rule:GovernanceRule={id:'r149',metric:"critical-hotspots",comparator:">",threshold:4,severity:'warning',label:'case 149',enabled:true};
    const result=evaluateGovernanceRule(facts({"critical-hotspots":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 149');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator <= case 0/0", () => {
    const rule:GovernanceRule={id:'r150',metric:"coverage-gaps",comparator:"<=",threshold:0,severity:'warning',label:'case 150',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 150');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator <= case 1/0", () => {
    const rule:GovernanceRule={id:'r151',metric:"coverage-gaps",comparator:"<=",threshold:0,severity:'warning',label:'case 151',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 151');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator <= case 0/1", () => {
    const rule:GovernanceRule={id:'r152',metric:"coverage-gaps",comparator:"<=",threshold:1,severity:'warning',label:'case 152',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 152');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator <= case 4/4", () => {
    const rule:GovernanceRule={id:'r153',metric:"coverage-gaps",comparator:"<=",threshold:4,severity:'warning',label:'case 153',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 153');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator <= case 5/4", () => {
    const rule:GovernanceRule={id:'r154',metric:"coverage-gaps",comparator:"<=",threshold:4,severity:'warning',label:'case 154',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 154');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator >= case 0/0", () => {
    const rule:GovernanceRule={id:'r155',metric:"coverage-gaps",comparator:">=",threshold:0,severity:'warning',label:'case 155',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 155');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator >= case 1/0", () => {
    const rule:GovernanceRule={id:'r156',metric:"coverage-gaps",comparator:">=",threshold:0,severity:'warning',label:'case 156',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 156');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator >= case 0/1", () => {
    const rule:GovernanceRule={id:'r157',metric:"coverage-gaps",comparator:">=",threshold:1,severity:'warning',label:'case 157',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 157');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator >= case 4/4", () => {
    const rule:GovernanceRule={id:'r158',metric:"coverage-gaps",comparator:">=",threshold:4,severity:'warning',label:'case 158',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 158');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator >= case 5/4", () => {
    const rule:GovernanceRule={id:'r159',metric:"coverage-gaps",comparator:">=",threshold:4,severity:'warning',label:'case 159',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 159');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator == case 0/0", () => {
    const rule:GovernanceRule={id:'r160',metric:"coverage-gaps",comparator:"==",threshold:0,severity:'warning',label:'case 160',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 160');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator == case 1/0", () => {
    const rule:GovernanceRule={id:'r161',metric:"coverage-gaps",comparator:"==",threshold:0,severity:'warning',label:'case 161',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 161');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator == case 0/1", () => {
    const rule:GovernanceRule={id:'r162',metric:"coverage-gaps",comparator:"==",threshold:1,severity:'warning',label:'case 162',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 162');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator == case 4/4", () => {
    const rule:GovernanceRule={id:'r163',metric:"coverage-gaps",comparator:"==",threshold:4,severity:'warning',label:'case 163',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 163');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator == case 5/4", () => {
    const rule:GovernanceRule={id:'r164',metric:"coverage-gaps",comparator:"==",threshold:4,severity:'warning',label:'case 164',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 164');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator < case 0/0", () => {
    const rule:GovernanceRule={id:'r165',metric:"coverage-gaps",comparator:"<",threshold:0,severity:'warning',label:'case 165',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 165');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator < case 1/0", () => {
    const rule:GovernanceRule={id:'r166',metric:"coverage-gaps",comparator:"<",threshold:0,severity:'warning',label:'case 166',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 166');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator < case 0/1", () => {
    const rule:GovernanceRule={id:'r167',metric:"coverage-gaps",comparator:"<",threshold:1,severity:'warning',label:'case 167',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 167');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator < case 4/4", () => {
    const rule:GovernanceRule={id:'r168',metric:"coverage-gaps",comparator:"<",threshold:4,severity:'warning',label:'case 168',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 168');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator < case 5/4", () => {
    const rule:GovernanceRule={id:'r169',metric:"coverage-gaps",comparator:"<",threshold:4,severity:'warning',label:'case 169',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 169');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator > case 0/0", () => {
    const rule:GovernanceRule={id:'r170',metric:"coverage-gaps",comparator:">",threshold:0,severity:'warning',label:'case 170',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 170');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator > case 1/0", () => {
    const rule:GovernanceRule={id:'r171',metric:"coverage-gaps",comparator:">",threshold:0,severity:'warning',label:'case 171',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":1}),rule);
    expect(result.actual).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 171');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator > case 0/1", () => {
    const rule:GovernanceRule={id:'r172',metric:"coverage-gaps",comparator:">",threshold:1,severity:'warning',label:'case 172',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":0}),rule);
    expect(result.actual).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 172');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator > case 4/4", () => {
    const rule:GovernanceRule={id:'r173',metric:"coverage-gaps",comparator:">",threshold:4,severity:'warning',label:'case 173',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":4}),rule);
    expect(result.actual).toBe(4);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('case 173');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("coverage-gaps comparator > case 5/4", () => {
    const rule:GovernanceRule={id:'r174',metric:"coverage-gaps",comparator:">",threshold:4,severity:'warning',label:'case 174',enabled:true};
    const result=evaluateGovernanceRule(facts({"coverage-gaps":5}),rule);
    expect(result.actual).toBe(5);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('case 174');
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
  it("exploratory profile is deterministic", () => {
    const one=createGovernanceProfile("exploratory");
    const two=createGovernanceProfile("exploratory");
    expect(one).toEqual(two);
    expect(new Set(one.map(item=>item.id)).size).toBe(one.length);
  });
  it("balanced profile is deterministic", () => {
    const one=createGovernanceProfile("balanced");
    const two=createGovernanceProfile("balanced");
    expect(one).toEqual(two);
    expect(new Set(one.map(item=>item.id)).size).toBe(one.length);
  });
  it("strict profile is deterministic", () => {
    const one=createGovernanceProfile("strict");
    const two=createGovernanceProfile("strict");
    expect(one).toEqual(two);
    expect(new Set(one.map(item=>item.id)).size).toBe(one.length);
  });
  it("collects summary facts", () => {
    const result=collectGovernanceFacts(architectureFixture({modules:7,unresolved:2,ambiguous:3,unmatched:4,importCycles:1,callCycles:2,hotspots:4,coverage:1}));
    expect(result.values.modules).toBe(7);
    expect(result.values['unresolved-imports']).toBe(2);
    expect(result.values['critical-hotspots']).toBe(2);
    expect(result.complete).toBe(false);
  });
  it("labels all governance metrics", () => {
    for(const metric of GOVERNANCE_METRICS)expect(governanceMetricLabel(metric).length).toBeGreaterThan(2);
  });
  it("normalizes malformed rule thresholds", () => {
    const value=normalizeGovernanceRule({id:' x ',metric:'modules',comparator:'<=',threshold:Number.NaN,severity:'info',label:' sample  label ',enabled:true});
    expect(value.id).toBe('x');
    expect(value.threshold).toBe(0);
    expect(value.label).toBe('sample label');
  });
});
