import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OpenEditorManager } from './OpenEditorManager';
import type { StudioDocument } from '../model/documents';

function doc(id: string, options: Partial<StudioDocument> = {}): StudioDocument {
  return {
    id, path: '/workspace/' + id + '.srp', name: id + '.srp',
    content: 'saved', savedContent: 'saved', revision: 1, ...options,
  };
}
const documents = [
  doc('one'), doc('two', { content: 'modified' }),
  doc('untitled', { path: null, content: '', savedContent: '' }),
];
function render(options: Partial<Parameters<typeof OpenEditorManager>[0]> = {}) {
  return renderToStaticMarkup(createElement(OpenEditorManager, {
    documents, activeId: 'one', busy: false, onActivate: () => {},
    onClose: () => false, initiallyExpanded: true, ...options,
  }));
}
function inputTag(html: string, label: string): string {
  return html.match(new RegExp('<input[^>]*aria-label="' + label + '"[^>]*>'))?.[0] ?? '';
}
describe('open editor manager rendered controls', () => {
  it('is collapsed by default', () => {
    const html = render({ initiallyExpanded: false });
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('editor-manager-row');
  });
  it('provides metadata filters, aggregate counts and explicit close controls', () => {
    const html = render();
    expect(html).toContain('3 open · 1 modified · 1 untitled');
    expect(html).toContain('Search open editor tabs');
    expect(html).toContain('Filter editor tabs by state');
    expect(html).toContain('Sort open editor tabs');
    expect(html).toContain('Close selected (0)');
    expect(html).toContain('Select saved on page');
    expect(html).toContain('aria-current="true"');
  });
  it('only enables checkboxes for clean named documents', () => {
    const html = render();
    expect(inputTag(html, 'Select saved tab one.srp')).not.toContain('disabled');
    expect(inputTag(html, 'Select saved tab two.srp')).toContain('disabled');
    expect(inputTag(html, 'Select saved tab untitled.srp')).toContain('disabled');
  });
  it('blocks all tab selection when a native operation is active', () => {
    const html = render({ busy: true });
    expect(inputTag(html, 'Select saved tab one.srp')).toContain('disabled');
  });
  it('shows page limits and does not render off-page tab rows', () => {
    const html = render({ documents: Array.from({ length: 205 }, (_, i) => doc('source' + i)) });
    expect(html).toContain('Only the first 200 open tabs');
    expect(html).toContain('Page 1 / 10');
    expect(html).toContain('Select saved tab source19.srp');
    expect(html).not.toContain('Select saved tab source20.srp');
  });
  it('escapes filenames and never renders source contents', () => {
    const html = render({ documents: [doc('special', { name: '<script>name</script>.srp', content: 'PRIVATE_BUFFER', savedContent: 'PRIVATE_BUFFER' })] });
    expect(html).toContain('&lt;script&gt;name&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('PRIVATE_BUFFER');
  });
  it('shows an empty result without enabling a bulk close', () => {
    const html = render({ documents: [], activeId: null });
    expect(html).toContain('No open tabs match these filters.');
    expect(html).toContain('0 open · 0 modified · 0 untitled');
  });
});

describe('pinned editor manager presentation', () => {
  it('shows a pinned filter and disables selection of a pinned saved tab', () => {
    const html = render({ pinnedIds: ['one'] });
    expect(html).toContain('1 pinned');
    expect(html).toContain('Pinned tabs');
    expect(html).toContain('Pinned · Saved');
    expect(inputTag(html, 'Select saved tab one.srp')).toContain('disabled');
  });
});
