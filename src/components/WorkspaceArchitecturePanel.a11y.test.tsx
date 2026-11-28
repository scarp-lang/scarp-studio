import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceArchitecturePanel } from './WorkspaceArchitecturePanel';
import { smallArchitectureFixture } from '../test/workspaceArchitectureFixtures';

function expandedMarkup(): string {
  const fixture = smallArchitectureFixture();
  return renderToStaticMarkup(<WorkspaceArchitecturePanel
    documents={fixture.documents}
    listed={fixture.listing}
    activeId="main"
    busy={false}
    onNavigate={vi.fn()}
    initiallyExpanded
  />);
}

describe('WorkspaceArchitecturePanel accessibility contract', () => {
  it('labels the entire tool as a workspace architecture explorer', () => {
    const html = expandedMarkup();
    expect(html).toContain('aria-label="Workspace architecture explorer"');
  });

  it('connects the expand control to the body with aria-controls', () => {
    const html = expandedMarkup();
    expect(html).toContain('aria-controls="workspace-architecture-body"');
    expect(html).toContain('id="workspace-architecture-body"');
    expect(html).toContain('aria-expanded="true"');
  });

  it('uses a tablist with one selected tab', () => {
    const html = expandedMarkup();
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Workspace architecture views"');
    const selected = html.match(/aria-selected="true"/g) ?? [];
    expect(selected).toHaveLength(1);
  });

  it('does not encode critical information only in decorative glyphs', () => {
    const html = expandedMarkup();
    expect(html).toContain('Open modules');
    expect(html).toContain('Declarations');
    expect(html).toContain('Call sites');
    expect(html).toContain('Import cycles');
    expect(html).toContain('Call cycles');
  });

  it('renders the collapse glyph as hidden from assistive technology', () => {
    const html = expandedMarkup();
    expect(html).toContain('<span aria-hidden="true">▾</span>');
  });

  it('keeps architecture status text in semantic status regions where freshness matters', () => {
    const html = expandedMarkup();
    expect(html).toContain('role="status"');
  });

  it('does not autofocus or inject modal dialog semantics', () => {
    const html = expandedMarkup();
    expect(html).not.toContain('autofocus');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('aria-modal="true"');
  });

  it('keeps navigation view names as visible button text', () => {
    const html = expandedMarkup();
    for (const label of ['Overview', 'Search', 'Review', 'Impact', 'Routes', 'Snapshots', 'Report']) {
      expect(html).toContain('>' + label + '</button>');
    }
  });

  it('keeps the default overview understandable without CSS classes', () => {
    const html = expandedMarkup().replace(/ class="[^"]*"/g, '');
    expect(html).toContain('Bounded lexical observations');
    expect(html).toContain('MODULE COUPLING');
    expect(html).toContain('HOTSPOTS');
    expect(html).toContain('OBSERVED ENTRYPOINTS');
  });

  it('uses native buttons rather than clickable noninteractive containers', () => {
    const html = expandedMarkup();
    expect(html).not.toMatch(/<div[^>]*onclick=/i);
    expect(html).not.toMatch(/<span[^>]*onclick=/i);
  });
});
