import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceSessionPanel } from './WorkspaceSessionPanel';
import { createUntitled, type StudioDocument } from '../model/documents';
import type { WorkspaceSessionView } from '../model/workspaceSessionStore';

const root = 'C:/practice';
const files = [
  { name: 'basic/main.srp', path: root + '/basic/main.srp' },
  { name: 'loops/main.srp', path: root + '/loops/main.srp' },
];
const document: StudioDocument = {
  id: 'one', name: 'main.srp', path: files[0].path, content: 'private source',
  savedContent: 'private source', revision: 1,
};
const emptyView: WorkspaceSessionView = { available: true, blocked: false, sessions: [], error: null };
const rememberedView: WorkspaceSessionView = {
  ...emptyView, sessions: [{
    root, savedAt: 1700000000000, names: ['basic/main.srp', 'loops/main.srp', 'missing.srp'],
    active: 'loops/main.srp',
  }],
};
const noop = () => {};
function render(props: Partial<Parameters<typeof WorkspaceSessionPanel>[0]> = {}) {
  return renderToStaticMarkup(createElement(WorkspaceSessionPanel, {
    root, files, documents: [document], activeId: document.id, view: emptyView,
    busy: false, initiallyExpanded: true, onRemember: noop, onRestore: noop,
    onForget: noop, onClearAll: noop, ...props,
  }));
}
describe('remembered workspace session controls', () => {
  it('explains metadata-only storage and offers manual capture', () => {
    const html = render();
    expect(html).toContain('Remember current tabs');
    expect(html).toContain('1 clean listed tab(s)');
    expect(html).toContain('not source contents');
    expect(html).not.toContain('private source');
    expect(html).not.toContain('Restore listed tabs');
  });

  it('reports dirty, untitled and unlisted omissions', () => {
    const html = render({ documents: [
      { ...document, content: 'modified' },
      createUntitled(1),
      { ...document, id: 'outside', path: 'C:/other/outside.srp' },
    ] });
    expect(html).toContain('1 modified, 1 untitled');
    expect(html).toContain('1 unlisted');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Remember current tabs/);
  });

  it('shows the remembered preview with exact relative names and unavailable sources', () => {
    const html = render({ view: rememberedView });
    expect(html).toContain('Replace remembered tabs');
    expect(html).toContain('Restore listed tabs');
    expect(html).toContain('Forget this workspace');
    expect(html).toContain('basic/main.srp');
    expect(html).toContain('loops/main.srp');
    expect(html).toContain('Ready to open · active');
    expect(html).toContain('Not currently listed');
    expect(html).toContain('1 to open · 1 already open');
    expect(html).not.toContain('private source');
  });

  it('shows stored metadata only after a workspace has been selected', () => {
    const html = render({ root: null, view: rememberedView });
    expect(html).toContain('Choose a workspace through the folder picker first');
    expect(html).not.toContain('Restore listed tabs');
    expect(html).not.toContain('loops/main.srp');
    expect(html).toContain('Clear all remembered workspaces');
  });

  it('does not offer a session from another selected workspace', () => {
    const html = render({ root: 'C:/other', view: rememberedView });
    expect(html).not.toContain('Restore listed tabs');
    expect(html).not.toContain('Forget this workspace');
  });

  it('preserves an open modified buffer in the restore preview', () => {
    const html = render({ view: rememberedView, documents: [{ ...document, content: 'unsaved' }] });
    expect(html).toContain('Open · preserve edits');
    expect(html).not.toContain('unsaved</');
  });

  it('disables storage and read actions while busy', () => {
    const html = render({ view: rememberedView, busy: true });
    for (const text of ['Replace remembered tabs', 'Restore listed tabs', 'Forget this workspace']) {
      expect(html).toMatch(new RegExp('<button[^>]*disabled=""[^>]*>' + text));
    }
  });

  it('reports corrupt metadata and offers explicit clearing rather than silent replacement', () => {
    const html = render({ view: { ...emptyView, blocked: true, error: 'Invalid metadata.' } });
    expect(html).toContain('Invalid metadata.');
    expect(html).toContain('Clear all remembered workspaces');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Remember current tabs/);
  });

  it('renders stored filenames as text, not markup', () => {
    const html = render({ view: { ...emptyView, sessions: [{
      root, savedAt: 1, names: ['<script>.srp'], active: null,
    }] } });
    expect(html).toContain('&lt;script&gt;.srp');
    expect(html).not.toContain('<script>');
  });
});
