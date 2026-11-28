import { describe, expect, it } from 'vitest';
import {
  ARCHITECTURE_FINDING_CATEGORY_LABELS,
  ARCHITECTURE_FINDING_SEVERITY_LABELS,
  ARCHITECTURE_RULE_LABELS,
  MAX_ARCHITECTURE_FINDINGS,
  architectureFindingPrimaryTarget,
  architectureFindingSummary,
  architectureFindingTargetLabel,
  architectureReviewChecklist,
  architectureReviewSettingsDescription,
  architectureReviewSummary,
  filterArchitectureFindings,
  reviewWorkspaceArchitecture,
} from './workspaceArchitectureReview';
import {
  ambiguousCallFixture,
  deepNestedFixture,
  importChainFixture,
  manySymbolsFixture,
  repeatedPublicNamesFixture,
  shadowedCallFixture,
  smallArchitectureFixture,
} from '../test/workspaceArchitectureFixtures';

describe('architecture review coverage findings', () => {
  it('does not invent a limited-coverage finding for a complete small graph', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    expect(review.findings.some(item => item.rule === 'limited-coverage')).toBe(false);
    expect(review.summary.complete).toBe(true);
  });

  it('preserves architecture generation and normalized settings', () => {
    const { architecture } = smallArchitectureFixture();
    const review = reviewWorkspaceArchitecture(architecture, {
      fanInWarning: 5,
      fanOutWarning: 7,
      nestedDepthWarning: 4,
      entrypointWarning: 9,
    });
    expect(review.generation).toBe(architecture.generation);
    expect(review.settings.fanInWarning).toBe(5);
    expect(review.settings.fanOutWarning).toBe(7);
    expect(review.settings.nestedDepthWarning).toBe(4);
    expect(review.settings.entrypointWarning).toBe(9);
  });

  it('clamps unsafe threshold settings rather than accepting arbitrary values', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture, {
      fanInWarning: -100,
      fanOutWarning: 9999,
      moduleSymbolWarning: 1,
      nestedDepthWarning: 999,
      entrypointWarning: -3,
    });
    expect(review.settings.fanInWarning).toBeGreaterThanOrEqual(2);
    expect(review.settings.fanOutWarning).toBeLessThanOrEqual(100);
    expect(review.settings.moduleSymbolWarning).toBeGreaterThanOrEqual(8);
    expect(review.settings.nestedDepthWarning).toBeLessThanOrEqual(64);
    expect(review.settings.entrypointWarning).toBeGreaterThanOrEqual(2);
  });
});

describe('architecture review call findings', () => {
  it('reports ambiguous function-name candidates', () => {
    const review = reviewWorkspaceArchitecture(ambiguousCallFixture().architecture);
    const findings = review.findings.filter(item => item.rule === 'ambiguous-call');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every(item => item.category === 'calls')).toBe(true);
    expect(findings.every(item => item.evidence.some(line => line.includes('Candidates')))).toBe(true);
  });

  it('uses warning severity when a non-function declaration shares a call spelling', () => {
    const review = reviewWorkspaceArchitecture(shadowedCallFixture().architecture);
    const finding = review.findings.find(item => item.rule === 'ambiguous-call')!;
    expect(finding).toBeDefined();
    expect(finding.severity).toBe('warning');
  });

  it('reports unmatched calls as informational bounded observations', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    const finding = review.findings.find(item => item.rule === 'unmatched-call' && item.evidence.some(line => line.includes('missing_call')));
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('info');
    expect(finding?.explanation).toContain('open-buffer lexical observation');
  });

  it('can hide informational findings without changing higher-priority findings', () => {
    const architecture = smallArchitectureFixture().architecture;
    const all = reviewWorkspaceArchitecture(architecture, { includeInfo: true });
    const noInfo = reviewWorkspaceArchitecture(architecture, { includeInfo: false });
    expect(noInfo.findings.every(item => item.severity !== 'info')).toBe(true);
    expect(noInfo.summary.total).toBeLessThanOrEqual(all.summary.total);
    expect(noInfo.summary.warning).toBe(all.summary.warning);
    expect(noInfo.summary.high).toBe(all.summary.high);
  });

  it('can disable a specific call rule without suppressing unrelated findings', () => {
    const architecture = ambiguousCallFixture().architecture;
    const review = reviewWorkspaceArchitecture(architecture, { disabledRules: ['ambiguous-call'] });
    expect(review.findings.some(item => item.rule === 'ambiguous-call')).toBe(false);
    expect(review.settings.disabledRules).toContain('ambiguous-call');
  });
});

describe('architecture review cycle findings', () => {
  it('reports an observed import ring', () => {
    const review = reviewWorkspaceArchitecture(importChainFixture(5, true).architecture);
    const finding = review.findings.find(item => item.rule === 'import-cycle')!;
    expect(finding).toBeDefined();
    expect(finding.category).toBe('cycles');
    expect(finding.targets.length).toBe(5);
    expect(finding.explanation).toContain('compiler');
  });

  it('reports recursive lexical call components without calling them runtime loops', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    const finding = review.findings.find(item => item.rule === 'call-cycle')!;
    expect(finding).toBeDefined();
    expect(finding.explanation).toContain('not proof');
  });

  it('raises import-cycle severity for a larger component', () => {
    const small = reviewWorkspaceArchitecture(importChainFixture(2, true).architecture)
      .findings.find(item => item.rule === 'import-cycle')!;
    const large = reviewWorkspaceArchitecture(importChainFixture(6, true).architecture)
      .findings.find(item => item.rule === 'import-cycle')!;
    expect(['review', 'warning']).toContain(small.severity);
    expect(large.severity).toBe('high');
  });
});

describe('architecture review structure findings', () => {
  it('reports a large declaration surface at a configured threshold', () => {
    const review = reviewWorkspaceArchitecture(manySymbolsFixture(50).architecture, { moduleSymbolWarning: 40 });
    const finding = review.findings.find(item => item.rule === 'large-module-surface')!;
    expect(finding).toBeDefined();
    expect(finding.evidence.some(line => line.includes('Declarations'))).toBe(true);
  });

  it('does not report a large declaration surface below the threshold', () => {
    const review = reviewWorkspaceArchitecture(manySymbolsFixture(12).architecture, { moduleSymbolWarning: 40 });
    expect(review.findings.some(item => item.rule === 'large-module-surface')).toBe(false);
  });

  it('reports deeply nested lexical declarations', () => {
    const review = reviewWorkspaceArchitecture(deepNestedFixture(9).architecture, { nestedDepthWarning: 4 });
    const nested = review.findings.filter(item => item.rule === 'deep-nested-declaration');
    expect(nested.length).toBeGreaterThan(0);
    expect(nested.every(item => item.category === 'structure')).toBe(true);
  });

  it('reports repeated public names as a review hint rather than an error', () => {
    const review = reviewWorkspaceArchitecture(repeatedPublicNamesFixture().architecture);
    const finding = review.findings.find(item => item.rule === 'repeated-public-name')!;
    expect(finding).toBeDefined();
    expect(finding.severity).toBe('review');
    expect(finding.explanation).toContain('may be intentional');
  });

  it('reports isolated modules as informational observations', () => {
    const fixture = manySymbolsFixture(10);
    const review = reviewWorkspaceArchitecture(fixture.architecture);
    const finding = review.findings.find(item => item.rule === 'isolated-module');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('info');
  });
});

describe('architecture review entrypoint findings', () => {
  it('reports several main-named functions when a workspace contains multiple example entrypoints', () => {
    const fixture = repeatedPublicNamesFixture();
    const architecture = {
      ...fixture.architecture,
      entrypoints: Object.freeze([
        ...fixture.architecture.entrypoints,
        { symbolId: fixture.architecture.symbols[0].id, moduleId: fixture.architecture.symbols[0].moduleId,
          name: 'main', sourceName: 'a.srp', line: 1, reason: 'main-name' as const },
        { symbolId: fixture.architecture.symbols[1].id, moduleId: fixture.architecture.symbols[1].moduleId,
          name: 'main', sourceName: 'b.srp', line: 1, reason: 'main-name' as const },
      ]),
    };
    const review = reviewWorkspaceArchitecture(architecture);
    expect(review.findings.some(item => item.rule === 'multiple-main-entrypoints')).toBe(true);
  });

  it('reports a large caller-free entrypoint set only at the configured threshold', () => {
    const architecture = manySymbolsFixture(20).architecture;
    const low = reviewWorkspaceArchitecture(architecture, { entrypointWarning: 4 });
    const high = reviewWorkspaceArchitecture(architecture, { entrypointWarning: 64 });
    expect(low.findings.some(item => item.rule === 'many-observed-entrypoints')).toBe(true);
    expect(high.findings.some(item => item.rule === 'many-observed-entrypoints')).toBe(false);
  });
});

describe('architecture review filtering', () => {
  it('filters by severity', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    for (const severity of ['info', 'review', 'warning', 'high'] as const) {
      const filtered = filterArchitectureFindings(review, { severity });
      expect(filtered.every(item => item.severity === severity)).toBe(true);
    }
  });

  it('filters by category', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    for (const category of Object.keys(ARCHITECTURE_FINDING_CATEGORY_LABELS) as (keyof typeof ARCHITECTURE_FINDING_CATEGORY_LABELS)[]) {
      const filtered = filterArchitectureFindings(review, { category });
      expect(filtered.every(item => item.category === category)).toBe(true);
    }
  });

  it('filters by rule ID', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    for (const rule of Object.keys(ARCHITECTURE_RULE_LABELS) as (keyof typeof ARCHITECTURE_RULE_LABELS)[]) {
      const filtered = filterArchitectureFindings(review, { rule });
      expect(filtered.every(item => item.rule === rule)).toBe(true);
    }
  });

  it('searches titles, explanations, evidence and target labels case-insensitively', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    const result = filterArchitectureFindings(review, { query: 'COMPILER' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(item => [item.title, item.explanation, ...item.evidence, ...item.targets.map(target => target.label)]
      .join(' ').toLowerCase().includes('compiler'))).toBe(true);
  });

  it('requires every query term to appear in the combined finding surface', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    const result = filterArchitectureFindings(review, { query: 'call lexical' });
    for (const finding of result) {
      const text = [finding.title, finding.explanation, ...finding.evidence, ...finding.targets.map(target => target.label)]
        .join(' ').toLowerCase();
      expect(text).toContain('call');
      expect(text).toContain('lexical');
    }
  });
});

describe('architecture review summaries and targets', () => {
  it('keeps findings sorted by review priority', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    const rank = { high: 0, warning: 1, review: 2, info: 3 } as const;
    for (let index = 1; index < review.findings.length; index++) {
      expect(rank[review.findings[index - 1].severity]).toBeLessThanOrEqual(rank[review.findings[index].severity]);
    }
  });

  it('keeps the finding collection bounded', () => {
    const review = reviewWorkspaceArchitecture(manySymbolsFixture(120).architecture, {
      moduleSymbolWarning: 8,
      nestedDepthWarning: 2,
      fanInWarning: 2,
      fanOutWarning: 2,
    });
    expect(review.findings.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_FINDINGS);
    expect(review.omitted).toBeGreaterThanOrEqual(0);
  });

  it('returns the first finding target as the primary review location', () => {
    const review = reviewWorkspaceArchitecture(ambiguousCallFixture().architecture);
    const finding = review.findings.find(item => item.targets.length > 0)!;
    expect(architectureFindingPrimaryTarget(finding)).toBe(finding.targets[0]);
  });

  it('returns null primary target for a finding without locations', () => {
    const fixture = smallArchitectureFixture();
    const architecture = { ...fixture.architecture, summary: { ...fixture.architecture.summary, complete: false },
      coverageReasons: Object.freeze(['symbol-index-limited' as const]) };
    const finding = reviewWorkspaceArchitecture(architecture).findings.find(item => item.rule === 'limited-coverage')!;
    expect(architectureFindingPrimaryTarget(finding)).toBeNull();
  });

  it('formats every target kind with a descriptive prefix', () => {
    for (const kind of ['module', 'symbol', 'call-site', 'import-edge', 'cycle', 'hotspot'] as const) {
      expect(architectureFindingTargetLabel({ kind, id: 'x', label: 'Target' })).toContain('Target');
    }
  });

  it('formats finding and review summaries with severity counts', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    const finding = review.findings[0];
    if (finding) {
      expect(architectureFindingSummary(finding)).toContain(ARCHITECTURE_FINDING_SEVERITY_LABELS[finding.severity]);
      expect(architectureFindingSummary(finding)).toContain(finding.title);
    }
    const summary = architectureReviewSummary(review);
    expect(summary).toContain('findings');
    expect(summary).toContain('warning');
    expect(summary).toContain('info');
  });

  it('builds a bounded actionable checklist without claiming automatic fixes', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    const checklist = architectureReviewChecklist(review);
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist.length).toBeLessThanOrEqual(24);
    expect(checklist.join(' ').toLowerCase()).not.toContain('automatically refactor');
  });

  it('describes configured thresholds and disabled rules', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture, {
      fanInWarning: 3,
      fanOutWarning: 4,
      disabledRules: ['unmatched-call', 'orphan-module'],
    });
    const description = architectureReviewSettingsDescription(review.settings);
    expect(description).toContain('fan-in≥3');
    expect(description).toContain('fan-out≥4');
    expect(description).toContain('2 disabled rules');
  });
});
