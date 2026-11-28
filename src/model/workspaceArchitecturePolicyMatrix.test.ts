import { describe,it,expect } from 'vitest';
import { evaluateGovernancePolicy,type GovernanceRule } from './workspaceArchitectureGovernance';
import { architectureFixture } from '../test/workspaceArchitectureGovernanceFixtures';
describe('policy result matrix',()=>{
  it("policy verdict 0", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r0',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"error",label:'r0',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 1", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r1',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"warning",label:'r1',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 2", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r2',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"error",label:'r2',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 3", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r3',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"warning",label:'r3',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 4", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r4',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"error",label:'r4',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 5", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r5',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"warning",label:'r5',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 6", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r6',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"error",label:'r6',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 7", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r7',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"warning",label:'r7',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 8", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r8',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"error",label:'r8',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 9", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r9',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"warning",label:'r9',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 10", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r10',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"error",label:'r10',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 11", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r11',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"warning",label:'r11',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 12", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r12',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"error",label:'r12',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 13", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r13',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"warning",label:'r13',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 14", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r14',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"error",label:'r14',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 15", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r15',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"warning",label:'r15',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 16", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r16',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"error",label:'r16',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 17", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r17',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"warning",label:'r17',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 18", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r18',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"error",label:'r18',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 19", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r19',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"warning",label:'r19',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 20", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r20',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"error",label:'r20',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 21", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r21',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"warning",label:'r21',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 22", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r22',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"error",label:'r22',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 23", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r23',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"warning",label:'r23',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 24", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r24',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"error",label:'r24',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 25", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r25',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"warning",label:'r25',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 26", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r26',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"error",label:'r26',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 27", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r27',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"warning",label:'r27',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 28", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r28',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"error",label:'r28',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 29", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r29',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"warning",label:'r29',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 30", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r30',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"error",label:'r30',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 31", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r31',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"warning",label:'r31',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 32", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r32',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"error",label:'r32',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 33", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r33',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"warning",label:'r33',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 34", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r34',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"error",label:'r34',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 35", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r35',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"warning",label:'r35',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 36", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r36',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"error",label:'r36',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 37", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r37',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"warning",label:'r37',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 38", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r38',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"error",label:'r38',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 39", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r39',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"warning",label:'r39',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 40", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r40',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"error",label:'r40',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 41", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r41',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"warning",label:'r41',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 42", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r42',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"error",label:'r42',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 43", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r43',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"warning",label:'r43',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 44", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r44',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"error",label:'r44',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 45", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r45',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"warning",label:'r45',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 46", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r46',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"error",label:'r46',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 47", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r47',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"warning",label:'r47',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 48", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r48',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"error",label:'r48',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 49", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r49',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"warning",label:'r49',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 50", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r50',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"error",label:'r50',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 51", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r51',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"warning",label:'r51',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 52", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r52',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"error",label:'r52',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 53", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r53',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"warning",label:'r53',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 54", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r54',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"error",label:'r54',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 55", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r55',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"warning",label:'r55',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 56", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r56',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"error",label:'r56',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 57", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r57',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"warning",label:'r57',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 58", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r58',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"error",label:'r58',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 59", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r59',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"warning",label:'r59',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 60", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r60',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"error",label:'r60',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 61", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r61',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"warning",label:'r61',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 62", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r62',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"error",label:'r62',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 63", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r63',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"warning",label:'r63',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 64", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r64',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"error",label:'r64',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 65", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r65',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"warning",label:'r65',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 66", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r66',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"error",label:'r66',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 67", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r67',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"warning",label:'r67',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 68", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r68',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"error",label:'r68',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 69", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r69',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"warning",label:'r69',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 70", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r70',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"error",label:'r70',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 71", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r71',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"warning",label:'r71',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 72", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r72',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"error",label:'r72',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 73", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r73',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"warning",label:'r73',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 74", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r74',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"error",label:'r74',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 75", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r75',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"warning",label:'r75',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 76", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r76',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"error",label:'r76',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 77", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r77',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"warning",label:'r77',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 78", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r78',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"error",label:'r78',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 79", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r79',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"warning",label:'r79',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 80", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r80',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"error",label:'r80',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 81", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r81',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"warning",label:'r81',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 82", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r82',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"error",label:'r82',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 83", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r83',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"warning",label:'r83',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 84", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r84',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"error",label:'r84',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 85", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r85',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"warning",label:'r85',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 86", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r86',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"error",label:'r86',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 87", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r87',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"warning",label:'r87',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 88", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r88',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"error",label:'r88',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 89", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r89',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"warning",label:'r89',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 90", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r90',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"error",label:'r90',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 91", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r91',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"warning",label:'r91',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 92", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r92',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"error",label:'r92',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 93", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r93',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"warning",label:'r93',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 94", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r94',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"error",label:'r94',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 95", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r95',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"warning",label:'r95',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 96", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r96',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"error",label:'r96',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 97", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r97',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"warning",label:'r97',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 98", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r98',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"error",label:'r98',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 99", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r99',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"warning",label:'r99',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 100", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r100',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"error",label:'r100',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 101", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r101',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"warning",label:'r101',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 102", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r102',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"error",label:'r102',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 103", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r103',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"warning",label:'r103',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 104", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r104',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"error",label:'r104',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 105", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r105',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"warning",label:'r105',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 106", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r106',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"error",label:'r106',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 107", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r107',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"warning",label:'r107',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 108", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r108',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"error",label:'r108',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 109", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r109',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"warning",label:'r109',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 110", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r110',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"error",label:'r110',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 111", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r111',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"warning",label:'r111',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 112", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r112',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"error",label:'r112',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 113", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r113',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"warning",label:'r113',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 114", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r114',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"error",label:'r114',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 115", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r115',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"warning",label:'r115',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 116", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r116',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"error",label:'r116',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 117", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r117',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"warning",label:'r117',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 118", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r118',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"error",label:'r118',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 119", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r119',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"warning",label:'r119',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 120", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r120',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"error",label:'r120',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 121", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r121',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"warning",label:'r121',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 122", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r122',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"error",label:'r122',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 123", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r123',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"warning",label:'r123',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 124", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r124',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"error",label:'r124',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 125", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r125',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"warning",label:'r125',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 126", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r126',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"error",label:'r126',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 127", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r127',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"warning",label:'r127',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 128", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r128',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"error",label:'r128',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 129", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r129',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"warning",label:'r129',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 130", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r130',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"error",label:'r130',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 131", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r131',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"warning",label:'r131',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 132", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r132',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"error",label:'r132',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 133", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r133',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"warning",label:'r133',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 134", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r134',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"error",label:'r134',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 135", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r135',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"warning",label:'r135',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 136", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r136',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"error",label:'r136',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 137", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r137',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"warning",label:'r137',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 138", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r138',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"error",label:'r138',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 139", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r139',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"warning",label:'r139',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 140", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r140',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"error",label:'r140',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 141", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r141',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"warning",label:'r141',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 142", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r142',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"error",label:'r142',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 143", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r143',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"warning",label:'r143',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
  it("policy verdict 144", () => {
    const architecture=architectureFixture({unresolved:1});
    const rule:GovernanceRule={id:'r144',metric:'unresolved-imports',comparator:'<=',threshold:3,severity:"error",label:'r144',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(1);
  });
  it("policy verdict 145", () => {
    const architecture=architectureFixture({unresolved:2});
    const rule:GovernanceRule={id:'r145',metric:'unresolved-imports',comparator:'<=',threshold:6,severity:"warning",label:'r145',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(2);
  });
  it("policy verdict 146", () => {
    const architecture=architectureFixture({unresolved:3});
    const rule:GovernanceRule={id:'r146',metric:'unresolved-imports',comparator:'<=',threshold:9,severity:"error",label:'r146',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(3);
  });
  it("policy verdict 147", () => {
    const architecture=architectureFixture({unresolved:4});
    const rule:GovernanceRule={id:'r147',metric:'unresolved-imports',comparator:'<=',threshold:1,severity:"warning",label:'r147',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(4);
  });
  it("policy verdict 148", () => {
    const architecture=architectureFixture({unresolved:5});
    const rule:GovernanceRule={id:'r148',metric:'unresolved-imports',comparator:'<=',threshold:4,severity:"error",label:'r148',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(5);
  });
  it("policy verdict 149", () => {
    const architecture=architectureFixture({unresolved:6});
    const rule:GovernanceRule={id:'r149',metric:'unresolved-imports',comparator:'<=',threshold:7,severity:"warning",label:'r149',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(6);
  });
  it("policy verdict 150", () => {
    const architecture=architectureFixture({unresolved:7});
    const rule:GovernanceRule={id:'r150',metric:'unresolved-imports',comparator:'<=',threshold:10,severity:"error",label:'r150',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(7);
  });
  it("policy verdict 151", () => {
    const architecture=architectureFixture({unresolved:8});
    const rule:GovernanceRule={id:'r151',metric:'unresolved-imports',comparator:'<=',threshold:2,severity:"warning",label:'r151',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(8);
  });
  it("policy verdict 152", () => {
    const architecture=architectureFixture({unresolved:9});
    const rule:GovernanceRule={id:'r152',metric:'unresolved-imports',comparator:'<=',threshold:5,severity:"error",label:'r152',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(9);
  });
  it("policy verdict 153", () => {
    const architecture=architectureFixture({unresolved:10});
    const rule:GovernanceRule={id:'r153',metric:'unresolved-imports',comparator:'<=',threshold:8,severity:"warning",label:'r153',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(10);
  });
  it("policy verdict 154", () => {
    const architecture=architectureFixture({unresolved:0});
    const rule:GovernanceRule={id:'r154',metric:'unresolved-imports',comparator:'<=',threshold:0,severity:"error",label:'r154',enabled:true};
    const result=evaluateGovernancePolicy(architecture,[rule]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.failed+result.passed).toBe(1);
    expect(result.verdict).toBe(result.errors>0?'block':result.warnings>0?'warn':'pass');
    expect(result.facts.values['unresolved-imports']).toBe(0);
  });
});
