import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceBookmarksPanel } from './SourceBookmarksPanel';
import { createSourceBookmark } from '../model/sourceBookmarks';
import type { StudioDocument } from '../model/documents';
const document: StudioDocument = {
  id: 'main', name: 'main.srp', path: 'C:/main.srp',
  content: 'print("hello");\nprint("world");', savedContent: '',
  revision: 1,
};
const marked = createSourceBookmark([document], [], 'main', 2, 1, 1);
function render(options: Partial<Parameters<typeof SourceBookmarksPanel>[0]> = {}) {
  return renderToStaticMarkup(createElement(SourceBookmarksPanel, {
    documents: [document], bookmarks: [marked], activeId: 'main',
    busy: false, cursor: { line:2, column:1 },
    onAdd: () => {}, onRemove: () => {}, onNavigate: () => {},
    initiallyExpanded: true, ...options,
  }));
}
describe('session bookmark UI', () => {
  it('is collapsed by default', () => {
    const html = render({ initiallyExpanded:false });
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('bookmarks-row');
  });
  it('shows an active source bookmark with read-only navigation', () => {
    const html = render();
    expect(html).toContain('print(&quot;world&quot;);');
    expect(html).toContain('Go to line 2');
    expect(html).toContain('Remove');
    expect(html).toContain('Add line 2');
  });
  it('does not navigate a stale source line', () => {
    const html = render({
      documents: [{ ...document, content:'changed\nline' }],
    });
    expect(html).toContain('stale');
    expect(html).toContain('disabled=""');
  });
  it('disables bookmark mutation while a native operation is busy', () => {
    const html = render({ busy:true });
    expect(html).toContain('Add line 2');
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it('does not show exact source text for closed documents', () => {
    const html = render({ documents:[], activeId:null });
    expect(html).toContain('No bookmarks match these filters');
    expect(html).not.toContain('Go to line 2');
  });
  it('escapes user source labels to prevent HTML injection', () => {
    const html = render({
      bookmarks:[{ ...marked, label:'<script>bad</script>' }],
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
