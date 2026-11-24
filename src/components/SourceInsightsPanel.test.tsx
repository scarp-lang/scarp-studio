import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { SourceInsightsPanel } from './SourceInsightsPanel';
import type { StudioDocument } from '../model/documents';

function doc(content: string): StudioDocument {
  return {
    id: 'insights-document', name: 'task.srp', path: 'C:/project/task.srp',
    content, savedContent: content, revision: 1,
  };
}

describe('Source Insights panel safe initial render', () => {
  it('defaults to a collapsed panel that does not show source analysis', () => {
    const html = renderToStaticMarkup(createElement(SourceInsightsPanel, {
      document: doc('funcra main() {} // TODO: improve'), onNavigate: () => {},
    }));
    expect(html).toContain('SOURCE INSIGHTS');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('<dt>Functions</dt>');
  });

  it('supports expanded read-only source metrics', () => {
    const html = renderToStaticMarkup(createElement(SourceInsightsPanel, {
      document: doc('funcra main() { print("hi"); }\n// TODO: improve'),
      onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('<dt>Functions</dt>');
    expect(html).toContain('<dd>1</dd>');
    expect(html).toContain('1 matching task');
    expect(html).toContain('improve');
    expect(html).toContain('No disk reads or writes');
  });

  it('does not manufacture insight results for no open document', () => {
    const html = renderToStaticMarkup(createElement(SourceInsightsPanel, {
      document: null, onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect(html).toContain('Open a Scarp source');
    expect(html).not.toContain('<dt>Functions</dt>');
  });

  it('HTML-escapes user-controlled comment text in the preview', () => {
    const html = renderToStaticMarkup(createElement(SourceInsightsPanel, {
      document: doc('// TODO: <script>alert("inert")</script>'),
      onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('TODO');
  });

  it('provides explicit filters for task kind, priority and search query', () => {
    const html = renderToStaticMarkup(createElement(SourceInsightsPanel, {
      document: doc('// FIXME: bug\n// NOTE: information'),
      onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect(html).toContain('Filter source comment tasks');
    expect(html).toContain('Filter comment task kind');
    expect(html).toContain('Filter comment task priority');
    expect(html).toContain('Order comment tasks');
    expect(html).toContain('2 matching tasks');
  });

  it('avoids showing all 200 task buttons on a crowded source', () => {
    const source = Array.from({ length: 100 }, (_, i) => '// TODO: item ' + i).join('\n');
    const html = renderToStaticMarkup(createElement(SourceInsightsPanel, {
      document: doc(source), onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect((html.match(/class="insights-task insights-task-normal"/g) ?? []).length).toBe(24);
    expect(html).toContain('Page 1 / 5');
  });

  it('marks oversized editor-only analysis incomplete', () => {
    const html = renderToStaticMarkup(createElement(SourceInsightsPanel, {
      document: doc('x'.repeat(512*1024+1)), onNavigate: () => {},
      initiallyExpanded: true,
    }));
    expect(html).toContain('analysis may be incomplete');
    expect(html).toContain('Source scan incomplete');
  });
});
