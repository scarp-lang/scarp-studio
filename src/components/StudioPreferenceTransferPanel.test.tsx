import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudioPreferenceTransferPanel } from './StudioPreferenceTransferPanel';
import { DEFAULT_STUDIO_PORTABLE } from '../model/studioPreferenceTransfer';
describe('Studio-wide transfer panel', () => {
  it('renders collapsed controls without automatically applying or exposing raw configuration', () => {
    const html = renderToStaticMarkup(createElement(StudioPreferenceTransferPanel, {
      current: DEFAULT_STUDIO_PORTABLE, onApply: () => { throw Error('must not apply on render'); },
    }));
    expect(html).toContain('Export Studio preferences');
    expect(html).toContain('Import Studio preferences');
    expect(html).toContain('Named Studio configurations');
    expect(html).toContain('automatic-write enablement');
    expect(html).not.toContain('Confirm Studio import');
    expect(html).not.toContain('scarp-studio.preferences');
    expect(html).not.toContain('Review undo last import');
  });
});
