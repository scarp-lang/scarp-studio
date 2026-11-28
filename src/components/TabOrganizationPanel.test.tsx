import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TabOrganizationPanel } from './TabOrganizationPanel';
import type { EditorState } from '../model/editorState';
import { createUntitled } from '../model/documents';

const documents = [createUntitled(1), createUntitled(2), createUntitled(3)];
const editor: EditorState = { documents, activeId: documents[1].id, nextUntitled: 4, sessionRevision: 3 };
function render(state = editor, busy = false, expanded = true) {
  return renderToStaticMarkup(createElement(TabOrganizationPanel, {
    editor: state, busy, initiallyExpanded: expanded, onOrganize: () => false,
  }));
}
function button(html: string, text: string) {
  return [...html.matchAll(/<button[^>]*>[^<]*<\/button>/g)].map(match => match[0])
    .find(tag => tag.endsWith('>' + text + '</button>')) ?? '';
}

describe('tab organization rendered controls', () => {
  it('provides a compact toolbar even when the organization tools are collapsed', () => {
    const html = render(editor, false, false);
    expect(html).toContain('Organize tabs');
    expect(html).toContain('3 open · 0 pinned');
    expect(html).toContain('Pin active tab');
    expect(html).not.toContain('Review tab sort');
  });

  it('exposes both movement directions and reviewed sort choices for a middle tab', () => {
    const html = render();
    expect(button(html, 'Move active left')).not.toContain('disabled');
    expect(button(html, 'Move active right')).not.toContain('disabled');
    expect(html).toContain('Filename (natural order)');
    expect(html).toContain('Parent folder, then filename');
    expect(html).toContain('Modified first, then filename');
    expect(html).not.toContain('Confirm tab sort');
  });

  it('marks the active pinned tab and prevents movement across the group boundary', () => {
    const state = { ...editor, documents: [documents[1], documents[0], documents[2]], pinnedTabIds: [documents[1].id] };
    const html = render(state);
    expect(html).toContain('3 open · 1 pinned');
    expect(button(html, 'Unpin active tab')).toContain('aria-pressed="true"');
    expect(button(html, 'Move active left')).toContain('disabled');
    expect(button(html, 'Move active right')).toContain('disabled');
  });

  it('disables all mutating controls while the editor is busy', () => {
    const html = render(editor, true);
    for (const label of ['Pin active tab', 'Move active left', 'Move active right', 'Review tab sort']) {
      expect(button(html, label)).toContain('disabled');
    }
    expect(html).toMatch(/<select[^>]*aria-label="Unpinned tab sort order"[^>]*disabled/);
  });

  it('handles an empty editor and never renders source contents in previews', () => {
    const empty = render({ ...editor, documents: [], activeId: null });
    expect(empty).toContain('0 open · 0 pinned');
    expect(empty).not.toContain('Pin active tab');
    expect(button(empty, 'Review tab sort')).toContain('disabled');
    const privateSource = { ...documents[1], content: 'PRIVATE_CONTENT', savedContent: 'PRIVATE_SAVED_CONTENT' };
    const html = render({ ...editor, documents: [documents[0], privateSource, documents[2]] });
    expect(html).not.toContain('PRIVATE_CONTENT');
    expect(html).not.toContain('PRIVATE_SAVED_CONTENT');
  });
});
