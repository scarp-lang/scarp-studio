import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudioSavedProfilePanel } from './StudioSavedProfilePanel';
import { createStudioProfilesStore } from '../model/studioSavedProfiles';
import { DEFAULT_STUDIO_PORTABLE } from '../model/studioPreferenceTransfer';
describe('named Studio configurations UI', () => {
  it('renders a compact collapsed summary without inspecting source or mutating preferences', () => {
    const store = createStudioProfilesStore(null);
    store.mutate({ kind: 'create', name: 'Learning', preferences: DEFAULT_STUDIO_PORTABLE }, 0);
    const html = renderToStaticMarkup(createElement(StudioSavedProfilePanel, {
      current: DEFAULT_STUDIO_PORTABLE, store, onReview: () => { throw Error('unexpected review'); },
    }));
    expect(html).toContain('Named Studio configurations');
    expect(html).toContain('1 / 12 saved configurations');
    expect(html).toContain('Session only');
    expect(html).not.toContain('Review configuration switch');
  });
});
