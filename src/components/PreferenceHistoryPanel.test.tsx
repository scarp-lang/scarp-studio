import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PreferenceHistoryPanel } from './PreferenceHistoryPanel';
import { createPreferenceHistory } from '../model/preferenceHistory';
import { DEFAULT_STUDIO_PORTABLE } from '../model/studioPreferenceTransfer';
describe('session history panel', () => {
  it('is collapsed and never applies a preference during render', () => {
    const html = renderToStaticMarkup(createElement(PreferenceHistoryPanel, {
      current: DEFAULT_STUDIO_PORTABLE, history: createPreferenceHistory(DEFAULT_STUDIO_PORTABLE),
      onApply: () => { throw Error('unexpected apply'); },
    }));
    expect(html).toContain('Preference change history');
    expect(html).toContain('0 / 32 recent changes');
    expect(html).not.toContain('Confirm historical restore');
  });
});
