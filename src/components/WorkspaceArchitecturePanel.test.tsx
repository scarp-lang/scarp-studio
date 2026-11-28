import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceArchitecturePanel } from './WorkspaceArchitecturePanel';
import {
  ambiguousCallFixture,
  importChainFixture,
  smallArchitectureFixture,
  studioDocument,
  listed,
} from '../test/workspaceArchitectureFixtures';

describe('WorkspaceArchitecturePanel server rendering', () => {
  it('renders a collapsed read-only tool by default without eagerly rendering graph views', () => {
    const fixture = smallArchitectureFixture();
    const html = renderToStaticMarkup(<WorkspaceArchitecturePanel
      documents={fixture.documents}
      listed={fixture.listing}
      activeId="main"
      busy={false}
      onNavigate={vi.fn()}
    />);

    expect(html).toContain('WORKSPACE ARCHITECTURE');
    expect(html).toContain('Analyze open architecture');
    expect(html).toContain('4 open sources');
    expect(html).not.toContain('MODULE COUPLING');
    expect(html).not.toContain('Architecture report format');
  });

  it('renders the overview when initially expanded', () => {
    const fixture = smallArchitectureFixture();
    const html = renderToStaticMarkup(<WorkspaceArchitecturePanel
      documents={fixture.documents}
      listed={fixture.listing}
      activeId="main"
      busy={false}
      onNavigate={vi.fn()}
      initiallyExpanded
    />);

    expect(html).toContain('Hide architecture');
    expect(html).toContain('Bounded lexical observations');
    expect(html).toContain('Open modules');
    expect(html).toContain('Declarations');
    expect(html).toContain('Call candidates');
    expect(html).toContain('MODULE COUPLING');
    expect(html).toContain('HOTSPOTS');
    expect(html).toContain('OBSERVED ENTRYPOINTS');
  });

  it('renders all architecture view tabs in the expanded tool', () => {
    const fixture = smallArchitectureFixture();
    const html = renderToStaticMarkup(<WorkspaceArchitecturePanel
      documents={fixture.documents}
      listed={fixture.listing}
      activeId="main"
      busy={false}
      onNavigate={vi.fn()}
      initiallyExpanded
    />);

    for (const label of ['Overview', 'Search', 'Review', 'Impact', 'Routes', 'Snapshots', 'Report']) {
      expect(html).toContain('>' + label + '<');
    }
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Workspace architecture views"');
  });

  it('uses singular open-source wording for one buffer', () => {
    const document = studioDocument('one', 'one.srp', 'C:\\one\\one.srp', 'funcra main() { return; }\n');
    const html = renderToStaticMarkup(<WorkspaceArchitecturePanel
      documents={[document]}
      listed={[listed('one.srp', document.path!)]}
      activeId="one"
      busy={false}
      onNavigate={vi.fn()}
    />);
    expect(html).toContain('1 open source');
    expect(html).not.toContain('1 open sources');
  });

  it('renders zero-buffer state without throwing', () => {
    const html = renderToStaticMarkup(<WorkspaceArchitecturePanel
      documents={[]}
      listed={[]}
      activeId={null}
      busy={false}
      onNavigate={vi.fn()}
      initiallyExpanded
    />);
    expect(html).toContain('0 open sources');
    expect(html).toContain('Open modules');
    expect(html).toContain('0');
  });

  it('does not render native filesystem action controls', () => {
    const fixture = smallArchitectureFixture();
    const html = renderToStaticMarkup(<WorkspaceArchitecturePanel
      documents={fixture.documents}
      listed={fixture.listing}
      activeId="main"
      busy={false}
      onNavigate={vi.fn()}
      initiallyExpanded
    />);
    expect(html).not.toContain('Open Folder');
    expect(html).not.toContain('Save File');
    expect(html).not.toContain('Write');
    expect(html).not.toContain('Run compiler');
  });

  it('does not expose native absolute paths in the default overview', () => {
    const fixture = smallArchitectureFixture();
    const html = renderToStaticMarkup(<WorkspaceArchitecturePanel
      documents={fixture.documents}
      listed={fixture.listing}
      activeId="main"
      busy={false}
      onNavigate={vi.fn()}
      initiallyExpanded
    />);
    expect(html).not.toContain('C:\\work\\src\\service.srp');
    expect(html).toContain('src/service.srp');
  });

  it('renders bounded import and call cycle metrics for the standard fixture', () => {
    const fixture = smallArchitectureFixture();
    const html = renderToStaticMarkup(<WorkspaceArchitecturePanel
      documents={fixture.documents}
      listed={fixture.listing}
      activeId="main"
      busy={false}
      onNavigate={vi.fn()}
      initiallyExpanded
    />);
    expect(html).toContain('Import cycles');
    expect(html).toContain('Call cycles');
  });

  it('renders architecture metrics for a pure import chain', () => {
    const fixture = importChainFixture(5, false);
    const html = renderToStaticMarkup(<WorkspaceArchitecturePanel
      documents={fixture.documents}
      listed={fixture.listing}
      activeId="module-0"
      busy={false}
      onNavigate={vi.fn()}
      initiallyExpanded
    />);
    expect(html).toContain('module density');
    expect(html).toContain('import density');
    expect(html).toContain('max dependency depth');
  });

  it('renders ambiguous-call counts without presenting them as compiler diagnostics', () => {
    const fixture = ambiguousCallFixture();
    const html = renderToStaticMarkup(<WorkspaceArchitecturePanel
      documents={fixture.documents}
      listed={fixture.listing}
      activeId="caller"
      busy={false}
      onNavigate={vi.fn()}
      initiallyExpanded
    />);
    expect(html).toContain('Ambiguous calls');
    expect(html).toContain('name candidates, not compiler-resolved edges');
    expect(html).not.toContain('compiler error');
  });
});
