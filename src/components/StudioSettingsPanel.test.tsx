import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudioSettingsPanel } from './StudioSettingsPanel';
import { DEFAULT_EDITOR_PREFERENCES } from '../model/editorPreferences';
import { DEFAULT_AUTO_SAVE } from '../model/autoSaveSettings';
import { DEFAULT_WORKSPACE_LAYOUT } from '../model/workspaceLayout';

function render(overrides: Partial<Parameters<typeof StudioSettingsPanel>[0]> = {}) {
  return renderToStaticMarkup(createElement(StudioSettingsPanel, {
    theme: 'dark', editor: DEFAULT_EDITOR_PREFERENCES, autoSave: DEFAULT_AUTO_SAVE,
    layout: DEFAULT_WORKSPACE_LAYOUT, recovery: createElement('p', null, 'Recovery controls'),
    recoveryNeedsReview: false, compiler: createElement('p', null, 'Compiler controls'),
    onTheme: () => {}, onEditorChange: () => {}, onAutoSaveChange: () => {},
    onLayoutChange: () => {}, onResetEditor: () => {}, onResetAutoSave: () => {},
    onResetLayout: () => {}, onResetAll: () => {}, onClose: () => {}, ...overrides,
  }));
}
describe('Settings center rendered controls', () => {
  it('provides searchable named categories and separate reset actions', () => {
    const html = render();
    for (const label of ['Search settings', 'Appearance', 'Code editor',
      'Files and Auto Save', 'Workspace layout', 'Recovery controls', 'Compiler configuration', 'Compiler controls',
      'Reset editor only', 'Reset Auto Save only', 'Reset layout only',
      'Restore preference defaults', 'Close settings']) expect(html).toContain(label);
    expect(html).toContain('Recovery copies and remembered workspace data are unchanged.');
    expect(html).toContain('6 settings group(s)');
  });
  it('renders explicit labels and current editor flags', () => {
    const html = render({ editor: { ...DEFAULT_EDITOR_PREFERENCES, lineNumbers: false, smoothScrolling: true } });
    for (const id of ['editor-font-family', 'editor-font-size', 'editor-tab-size',
      'editor-line-numbers', 'editor-highlight-line', 'editor-indent-guides',
      'editor-bracket-colors', 'editor-smooth-scroll']) {
      expect(html).toContain('for="' + id + '"');
      expect(html).toContain('id="' + id + '"');
    }
    expect(html.match(/<input[^>]*id="editor-line-numbers"[^>]*>/)?.[0]).not.toContain('checked');
    expect(html.match(/<input[^>]*id="editor-smooth-scroll"[^>]*>/)?.[0]).toContain('checked');
  });
  it('disables the delay until Auto Save is explicitly enabled', () => {
    expect(render().match(/<select[^>]*id="studio-auto-save-delay"[^>]*>/)?.[0]).toContain('disabled');
    expect(render({ autoSave: { enabled: true, delay: 5000 } })
      .match(/<select[^>]*id="studio-auto-save-delay"[^>]*>/)?.[0]).not.toContain('disabled');
  });
  it('clearly indicates required recovery review and keeps its controls present', () => {
    const html = render({ recoveryNeedsReview: true });
    expect(html).toContain('Recovery review remains visible.');
    expect(html).toContain('Recovery controls');
  });
});
