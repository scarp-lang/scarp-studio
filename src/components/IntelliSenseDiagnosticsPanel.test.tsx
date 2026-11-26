import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IntelliSenseDiagnosticsPanel } from './IntelliSenseDiagnosticsPanel';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults } from '../model/intelliSensePreferences';
describe('IntelliSense eligibility panel', () => {
  it('renders metadata summary without triggering inspection on render', () => {
    const html = renderToStaticMarkup(createElement(IntelliSenseDiagnosticsPanel, {
      preferences: defaults, document: { id: 'private-id', revision: 1, units: 123 },
      onInspect: () => { throw Error('must not inspect on render'); },
    }));
    expect(html).toContain('IntelliSense availability');
    expect(html).toContain('Show availability details');
    expect(html).not.toContain('private-id');
    expect(html).not.toContain('Inspect active source');
  });
  it('handles no active source', () => {
    const html = renderToStaticMarkup(createElement(IntelliSenseDiagnosticsPanel, { preferences: defaults, document: null }));
    expect(html).toContain('0 / 11 features eligible');
  });
});
