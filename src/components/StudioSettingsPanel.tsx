import { useState, type ReactNode } from 'react';
import { EDITOR_FONTS, FONT_SIZES, TAB_SIZES, type EditorFont, type EditorPreferences } from '../model/editorPreferences';
import type { AutoSaveDelay, AutoSavePreferences } from '../model/autoSaveSettings';
import { EXPLORER_MIN, EXPLORER_MAX, OUTPUT_MIN, OUTPUT_MAX, type LayoutDimension, type WorkspaceLayout } from '../model/workspaceLayout';
import { matchingSettingsGroups, MAX_SETTINGS_QUERY_UNITS, type SettingsGroup } from '../model/settingsSearch';

interface Props {
  theme: 'dark' | 'light';
  editor: EditorPreferences;
  autoSave: AutoSavePreferences;
  layout: WorkspaceLayout;
  recovery: ReactNode;
  compiler: ReactNode;
  intelliSense: ReactNode;
  portability?: ReactNode;
  shortcuts?: ReactNode;
  recoveryNeedsReview: boolean;
  onTheme: (theme: 'dark' | 'light') => void;
  onEditorChange: (patch: Partial<EditorPreferences>) => void;
  onAutoSaveChange: (patch: Partial<AutoSavePreferences>) => void;
  onLayoutChange: (dimension: LayoutDimension, value: number) => void;
  onResetEditor: () => void;
  onResetAutoSave: () => void;
  onResetLayout: () => void;
  onResetAll: () => void;
  onClose: () => void;
}
const fontLabels: Record<EditorFont, string> = {
  consolas: 'Consolas',
  cascadiacode: 'Cascadia Code',
  monospace: 'System monospace',
};
type EditorFlag = 'wordWrap' | 'minimap' | 'showWhitespace' | 'lineNumbers' |
  'highlightActiveLine' | 'indentationGuides' | 'bracketColors' | 'smoothScrolling';
const editorFlags: readonly { key: EditorFlag; label: string; id: string }[] = [
  { key: 'wordWrap', label: 'Wrap long lines', id: 'editor-word-wrap' },
  { key: 'minimap', label: 'Show code minimap', id: 'editor-minimap' },
  { key: 'showWhitespace', label: 'Show spaces and tabs', id: 'editor-whitespace' },
  { key: 'lineNumbers', label: 'Show line numbers', id: 'editor-line-numbers' },
  { key: 'highlightActiveLine', label: 'Highlight active line', id: 'editor-highlight-line' },
  { key: 'indentationGuides', label: 'Show indentation guides', id: 'editor-indent-guides' },
  { key: 'bracketColors', label: 'Color matching bracket pairs', id: 'editor-bracket-colors' },
  { key: 'smoothScrolling', label: 'Smooth scrolling', id: 'editor-smooth-scroll' },
];

/** Controlled settings view. File permissions, recovery and persistence
 * remain owned by App; this view never accesses storage or the filesystem. */
export function StudioSettingsPanel(props: Props) {
  const { editor, autoSave, layout } = props;
  const [query, setQuery] = useState('');
  const matches = matchingSettingsGroups(query, props.recoveryNeedsReview);
  const hidden = (id: SettingsGroup) => !matches.includes(id);
  return (
    <section id="editor-settings" className="editor-settings studio-settings-center" aria-label="Scarp Studio settings">
      <header className="studio-settings-header">
        <div><h2>Settings</h2><p>Local preferences · changes apply immediately</p></div>
        <div className="studio-settings-search">
          <input type="search" aria-label="Search settings" placeholder="Search settings"
            value={query} maxLength={MAX_SETTINGS_QUERY_UNITS}
            onChange={event => setQuery(event.target.value.slice(0, MAX_SETTINGS_QUERY_UNITS))} />
          {query && <button className="settings-reset" type="button" onClick={() => setQuery('')}>Clear search</button>}
        </div>
        <button className="settings-reset" type="button" onClick={props.onClose}>Close settings</button>
      </header>
      <p className="settings-empty" role="status" aria-live="polite">
        {matches.length ? matches.length + ' settings group(s)' : 'No settings match your search.'}
        {props.recoveryNeedsReview && ' Recovery review remains visible.'}
      </p>
      <div className="settings-grid">
        <fieldset className="settings-group" hidden={hidden('appearance')}>
          <legend>Appearance</legend>
          <p>Choose the Studio interface and editor theme.</p>
          <div className="settings-control-row">
            <label htmlFor="studio-theme">Color theme</label>
            <select id="studio-theme" value={props.theme} onChange={event => {
              const value = event.target.value;
              if (value === 'light' || value === 'dark') props.onTheme(value);
            }}>
              <option value="dark">Dark (default)</option><option value="light">Light</option>
            </select>
          </div>
        </fieldset>
        <fieldset className="settings-group" hidden={hidden('editor')}>
          <legend>Code editor</legend>
          <p>Display preferences only. Changing these settings never rewrites source text.</p>
          <div className="settings-controls">
            <div className="settings-control-row">
              <label htmlFor="editor-font-family">Font family</label>
              <select id="editor-font-family" value={editor.font} onChange={event => {
                const value = event.target.value;
                if (Object.hasOwn(EDITOR_FONTS, value)) props.onEditorChange({ font: value as EditorFont });
              }}>
                {(Object.keys(EDITOR_FONTS) as EditorFont[]).map(font =>
                  <option key={font} value={font}>{fontLabels[font]}</option>)}
              </select>
            </div>
            <div className="settings-control-row">
              <label htmlFor="editor-font-size">Font size</label>
              <select id="editor-font-size" value={editor.fontSize} onChange={event => {
                const size = FONT_SIZES.find(value => value === Number(event.target.value));
                if (size !== undefined) props.onEditorChange({ fontSize: size });
              }}>{FONT_SIZES.map(size => <option key={size} value={size}>{size} px</option>)}</select>
            </div>
            <div className="settings-control-row">
              <label htmlFor="editor-tab-size">Tab width</label>
              <select id="editor-tab-size" value={editor.tabSize} onChange={event => {
                const size = TAB_SIZES.find(value => value === Number(event.target.value));
                if (size !== undefined) props.onEditorChange({ tabSize: size });
              }}>{TAB_SIZES.map(size => <option key={size} value={size}>{size} spaces</option>)}</select>
            </div>
            <div className="settings-checkbox-grid">
              {editorFlags.map(flag => <label key={flag.key} htmlFor={flag.id} className="editor-setting-checkbox">
                <input id={flag.id} type="checkbox" checked={editor[flag.key]}
                  onChange={event => props.onEditorChange({ [flag.key]: event.target.checked })} />
                {flag.label}
              </label>)}
            </div>
            <button className="settings-reset" type="button" onClick={props.onResetEditor}>Reset editor only</button>
          </div>
        </fieldset>
        <fieldset className="settings-group settings-intellisense" hidden={hidden('intellisense')}>
          <legend>IntelliSense and language assistance</legend>
          {props.intelliSense}
        </fieldset>
        <fieldset className="settings-group" hidden={hidden('files')}>
          <legend>Files and Auto Save</legend>
          <p>Auto Save is off by default. It never opens Save As, pauses during compiler commands and rejects external disk changes.</p>
          <div className="settings-controls">
            <label htmlFor="studio-auto-save" className="editor-setting-checkbox">
              <input id="studio-auto-save" type="checkbox" checked={autoSave.enabled}
                onChange={event => props.onAutoSaveChange({ enabled: event.target.checked })} />
              Auto Save (named .srp files only)
            </label>
            <div className="settings-control-row">
              <label htmlFor="studio-auto-save-delay">Save after inactivity</label>
              <select id="studio-auto-save-delay" aria-label="Auto Save delay" value={autoSave.delay} disabled={!autoSave.enabled}
                onChange={event => {
                  const delay = Number(event.target.value);
                  if (delay === 1000 || delay === 3000 || delay === 5000) {
                    props.onAutoSaveChange({ delay: delay as AutoSaveDelay });
                  }
                }}>
                <option value={1000}>1 second</option><option value={3000}>3 seconds (default)</option><option value={5000}>5 seconds</option>
              </select>
            </div>
            <button className="settings-reset" type="button" onClick={props.onResetAutoSave}>Reset Auto Save only</button>
          </div>
        </fieldset>
        <fieldset className="settings-group" hidden={hidden('layout')}>
          <legend>Workspace layout</legend>
          <p>Preferred panel sizes are limited by available editor space.</p>
          <div className="settings-controls">
            <label htmlFor="studio-explorer-width">Explorer width <output>{layout.explorerWidth}px</output></label>
            <input id="studio-explorer-width" type="range" min={EXPLORER_MIN} max={EXPLORER_MAX} step={1}
              value={layout.explorerWidth} onChange={event => props.onLayoutChange('explorerWidth', Number(event.target.value))} />
            <label htmlFor="studio-output-height">Output height <output>{layout.outputHeight}px</output></label>
            <input id="studio-output-height" type="range" min={OUTPUT_MIN} max={OUTPUT_MAX} step={1}
              value={layout.outputHeight} onChange={event => props.onLayoutChange('outputHeight', Number(event.target.value))} />
            <button className="settings-reset" type="button" onClick={props.onResetLayout}>Reset layout only</button>
          </div>
        </fieldset>
        <fieldset className="settings-group settings-compiler" hidden={hidden('compiler')}>
          <legend>Compiler configuration</legend>
          {props.compiler}
        </fieldset>
        <fieldset className="settings-group settings-shortcuts" hidden={hidden('shortcuts')}>
          <legend>Keyboard shortcuts</legend>
          {props.shortcuts ?? <p>Shortcut configuration is unavailable.</p>}
        </fieldset>
        <fieldset className="settings-group settings-portability" hidden={hidden('portability')}>
          <legend>Studio preference transfer</legend>
          {props.portability ?? <p>Preference transfer is unavailable.</p>}
        </fieldset>
        <div className="settings-recovery settings-group" hidden={hidden('recovery')}>{props.recovery}</div>
      </div>
      <footer className="settings-footer">
        <button className="settings-reset" type="button" onClick={props.onResetAll}>Restore preference defaults</button>
        <span>Resets theme, editor, IntelliSense, keyboard shortcuts, workspace layout, Auto Save and startup discovery. Compiler approval is unchanged. Recovery copies and remembered workspace data are unchanged.</span>
      </footer>
    </section>
  );
}
