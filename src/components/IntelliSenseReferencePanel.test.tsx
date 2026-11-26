import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IntelliSenseReferencePanel } from './IntelliSenseReferencePanel';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults } from '../model/intelliSensePreferences';
describe('Settings reference panel', () => {
  it('renders a collapsed, labeled reference without exposing source or raw templates by default', () => {
    const html = renderToStaticMarkup(createElement(IntelliSenseReferencePanel, { preferences: defaults }));
    expect(html).toContain('Scarp language reference');
    expect(html).toContain('Browse language reference');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Raw insertion template');
  });
});
