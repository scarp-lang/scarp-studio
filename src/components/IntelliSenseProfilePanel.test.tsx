import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IntelliSenseProfilePanel } from './IntelliSenseProfilePanel';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults } from '../model/intelliSensePreferences';
import { createSavedProfilesStore } from '../model/intelliSenseProfiles';

function render(store = createSavedProfilesStore(null)) {
  return renderToStaticMarkup(createElement(IntelliSenseProfilePanel, {
    preferences: defaults, onApply: () => {}, store,
  }));
}
function button(html: string, label: string) {
  const tag = html.match(new RegExp('<button[^>]*>' + label + '</button>'));
  if (!tag) throw Error('Missing button: ' + label);
  return tag[0];
}
describe('profile management controls', () => {
  it('renders clearly labeled empty state and disables unavailable operations', () => {
    const html = render();
    expect(html).toContain('0 / 16 profiles');
    expect(html).toContain('Session only');
    expect(html).toContain('for="intellisense-profile-name"');
    expect(html).toContain('for="intellisense-profile-select"');
    for (const label of ['Save current as profile', 'Review and apply', 'Review replace with current', 'Review remove profile']) {
      expect(button(html, label)).toContain('disabled');
    }
    expect(html).toContain('Export configuration');
    expect(html).toContain('Import configuration');
    expect(html).not.toContain('Confirm apply');
  });
  it('lists saved profiles without dumping preferences or sensitive data', () => {
    const store = createSavedProfilesStore(null);
    store.mutate({ kind: 'create', name: 'Learning mode', preferences: defaults });
    const html = render(store);
    expect(html).toContain('1 / 16 profiles');
    expect(html).toContain('Learning mode');
    expect(html).not.toContain('completionMode');
  });
  it('explains blocked profile storage and offers explicit recovery', () => {
    const store = createSavedProfilesStore({ getItem: () => '{', setItem: () => { throw Error('must not write while rendering'); } });
    const html = render(store);
    expect(html).toContain('Profile storage blocked');
    expect(html).toContain('Reload saved profiles');
    expect(html).toContain('Review discard unreadable record');
    expect(html).not.toContain('Confirm discard');
    expect(button(html, 'Save current as profile')).toContain('disabled');
  });
});
