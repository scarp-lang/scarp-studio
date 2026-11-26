import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudioShortcutSettings } from './StudioShortcutSettings';
import { DEFAULT_SHORTCUTS, SHORTCUT_COMMANDS, changeShortcut } from '../model/studioShortcuts';
describe('shortcut configuration UI', () => {
  it('labels every command and keeps recovery controls fixed', () => {
    const html = renderToStaticMarkup(createElement(StudioShortcutSettings, {
      bindings: DEFAULT_SHORTCUTS, persistence: 'available',
      onChange: (id, binding) => changeShortcut(DEFAULT_SHORTCUTS, id, binding), onReset: () => {},
    }));
    for (const item of SHORTCUT_COMMANDS) expect(html).toContain('for="studio-shortcut-' + item.id + '"');
    for (const id of ['settings', 'stop-scarp']) {
      expect(html.match(new RegExp('<select[^>]*id="studio-shortcut-' + id + '"[^>]*>'))?.[0]).toContain('disabled');
    }
    expect(html).toContain('23 / 23 commands');
    expect(html).not.toContain('Confirm shortcut reset');
  });
});
