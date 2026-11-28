import { describe, expect, it } from 'vitest';
import { buildWorkspaceArchitecture } from './workspaceArchitecture';
import { buildArchitectureSearchItems } from './workspaceArchitectureQuery';
import { calculateArchitectureMetrics } from './workspaceArchitectureMetrics';
import { reviewWorkspaceArchitecture } from './workspaceArchitectureReview';
import { captureArchitectureSnapshot } from './workspaceArchitectureSnapshot';
import { findArchitectureRoutes } from './workspaceArchitectureRoutes';
import { buildArchitectureReport } from './workspaceArchitectureReport';
import { listed, studioDocument, smallArchitectureFixture, moduleId, functionId } from '../test/workspaceArchitectureFixtures';

function assertPlainData(value: unknown, path = 'root'): void {
  if (value === null || value === undefined) return;
  const type = typeof value;
  expect(['string', 'number', 'boolean', 'object']).toContain(type);
  if (type !== 'object') return;
  expect(value).not.toBeInstanceOf(Map);
  expect(value).not.toBeInstanceOf(Set);
  expect(value).not.toBeInstanceOf(Date);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainData(item, path + '[' + index + ']'));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    expect(typeof key).toBe('string');
    assertPlainData(child, path + '.' + key);
  }
}

describe('workspace architecture serializable data contracts', () => {
  it('keeps the architecture surface composed of JSON-safe values', () => {
    const { architecture } = smallArchitectureFixture();
    expect(() => JSON.stringify(architecture)).not.toThrow();
    assertPlainData(architecture);
  });

  it('keeps derived search items JSON-safe', () => {
    const items = buildArchitectureSearchItems(smallArchitectureFixture().architecture);
    expect(() => JSON.stringify(items)).not.toThrow();
    assertPlainData(items);
  });

  it('keeps metrics JSON-safe', () => {
    const metrics = calculateArchitectureMetrics(smallArchitectureFixture().architecture);
    expect(() => JSON.stringify(metrics)).not.toThrow();
    assertPlainData(metrics);
  });

  it('keeps review findings JSON-safe', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    expect(() => JSON.stringify(review)).not.toThrow();
    assertPlainData(review);
  });

  it('keeps session snapshots JSON-safe', () => {
    const snapshot = captureArchitectureSnapshot(smallArchitectureFixture().architecture, 'Snapshot', 1);
    expect(() => JSON.stringify(snapshot)).not.toThrow();
    assertPlainData(snapshot);
  });

  it('keeps route results JSON-safe', () => {
    const { architecture } = smallArchitectureFixture();
    const route = findArchitectureRoutes(architecture,
      moduleId(architecture, 'main'), moduleId(architecture, 'service'));
    expect(() => JSON.stringify(route)).not.toThrow();
    assertPlainData(route);
  });
});

describe('workspace architecture immutable result contracts', () => {
  it('freezes top-level architecture collections', () => {
    const { architecture } = smallArchitectureFixture();
    expect(Object.isFrozen(architecture.modules)).toBe(true);
    expect(Object.isFrozen(architecture.symbols)).toBe(true);
    expect(Object.isFrozen(architecture.callSites)).toBe(true);
    expect(Object.isFrozen(architecture.callEdges)).toBe(true);
    expect(Object.isFrozen(architecture.importEdges)).toBe(true);
    expect(Object.isFrozen(architecture.cycles)).toBe(true);
    expect(Object.isFrozen(architecture.hotspots)).toBe(true);
  });

  it('freezes derived metric collections', () => {
    const metrics = calculateArchitectureMetrics(smallArchitectureFixture().architecture);
    expect(Object.isFrozen(metrics.modules)).toBe(true);
    expect(Object.isFrozen(metrics.symbols)).toBe(true);
  });

  it('freezes review finding collections', () => {
    const review = reviewWorkspaceArchitecture(smallArchitectureFixture().architecture);
    expect(Object.isFrozen(review.findings)).toBe(true);
    expect(Object.isFrozen(review.summary.byCategory)).toBe(true);
  });

  it('freezes snapshot entity collections', () => {
    const snapshot = captureArchitectureSnapshot(smallArchitectureFixture().architecture, 'Snapshot', 1);
    expect(Object.isFrozen(snapshot.modules)).toBe(true);
    expect(Object.isFrozen(snapshot.symbols)).toBe(true);
    expect(Object.isFrozen(snapshot.calls)).toBe(true);
    expect(Object.isFrozen(snapshot.imports)).toBe(true);
  });

  it('freezes route path and step collections', () => {
    const { architecture } = smallArchitectureFixture();
    const route = findArchitectureRoutes(architecture,
      functionId(architecture, 'main', 'main'), functionId(architecture, 'load', 'service'), { mode: 'calls' });
    expect(Object.isFrozen(route.paths)).toBe(true);
    for (const path of route.paths) expect(Object.isFrozen(path.steps)).toBe(true);
  });
});

describe('workspace architecture report export safety', () => {
  it('does not embed source body text in a default report', () => {
    const secret = 'DO_NOT_EXPORT_SOURCE_BODY_987654';
    const document = studioDocument('secret', 'secret.srp', 'C:\\serialization\\secret.srp',
      'funcra main() { print("' + secret + '"); }\n');
    const architecture = buildWorkspaceArchitecture([document], [listed('secret.srp', document.path!)], 'secret');
    const report = buildArchitectureReport(architecture);
    expect(report.text).not.toContain(secret);
  });

  it('does not embed savedContent in reports', () => {
    const document = studioDocument('saved', 'saved.srp', 'C:\\serialization\\saved.srp', 'funcra main() { return; }\n');
    const modified = { ...document, savedContent: 'SAVED_CONTENT_SHOULD_NOT_APPEAR' };
    const architecture = buildWorkspaceArchitecture([modified], [listed('saved.srp', modified.path!)], 'saved');
    expect(buildArchitectureReport(architecture).text).not.toContain('SAVED_CONTENT_SHOULD_NOT_APPEAR');
  });

  it('keeps full native paths opt-in', () => {
    const { architecture } = smallArchitectureFixture();
    const normal = buildArchitectureReport(architecture, { sections: ['modules'] });
    const explicit = buildArchitectureReport(architecture, { sections: ['modules'], includePaths: true });
    expect(normal.text).not.toContain('C:\\work\\src\\service.srp');
    expect(explicit.text).toContain('C:\\work\\src\\service.srp');
  });

  it('keeps internal observation IDs opt-in', () => {
    const { architecture } = smallArchitectureFixture();
    const normal = buildArchitectureReport(architecture, { sections: ['symbols'] });
    const explicit = buildArchitectureReport(architecture, { sections: ['symbols'], includeIds: true });
    expect(normal.text).not.toContain(architecture.symbols[0].id);
    expect(explicit.text).toContain(architecture.symbols[0].id);
  });
});

describe('workspace architecture source capture boundaries', () => {
  it('captures source text only in the live architecture object for freshness guards', () => {
    const fixture = smallArchitectureFixture();
    expect(fixture.architecture.documents[0].content).toBe(fixture.documents[0].content);
    const snapshot = captureArchitectureSnapshot(fixture.architecture, 'Safe', 1);
    expect(JSON.stringify(snapshot)).not.toContain(fixture.documents[0].content);
  });

  it('does not copy savedContent into the architecture document capture', () => {
    const document = studioDocument('x', 'x.srp', 'C:\\serialization\\x.srp', 'funcra main() { return; }\n');
    const modified = { ...document, savedContent: 'different saved text' };
    const architecture = buildWorkspaceArchitecture([modified], [listed('x.srp', modified.path!)], 'x');
    expect(Object.hasOwn(architecture.documents[0], 'savedContent')).toBe(false);
  });
});
