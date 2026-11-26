import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdvancedEditorSettings } from './AdvancedEditorSettings';
import { DEFAULT_EDITOR_PREFERENCES as defaults } from '../model/editorPreferences';
describe('advanced editor settings UI', () => {
  it('shows a collapsed summary and never changes preferences during render', () => {
    const html = renderToStaticMarkup(createElement(AdvancedEditorSettings, {
      preferences: { ...defaults, cursorStyle: 'block' }, theme: 'dark', onChange: () => { throw Error('unexpected change'); },
    }));
    expect(html).toContain('23 additional editor preferences');
    expect(html).toContain('1 modified');
    expect(html).toContain('Configure advanced editor experience');
    expect(html).not.toContain('Read-only Scarp typography sample');
  });
});
