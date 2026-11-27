import { AppearanceSettings } from './AppearanceSettings';
import type { AppearancePreferences, ResolvedAppearance, ThemeMode } from '../model/studioAppearance';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { AdvancedEditorSettings } from './AdvancedEditorSettings';
import { EDITOR_FONTS, FONT_SIZES, TAB_SIZES, type EditorFont, type EditorPreferences } from '../model/editorPreferences';
import type { AutoSaveDelay, AutoSavePreferences } from '../model/autoSaveSettings';
import { EXPLORER_MIN, EXPLORER_MAX, OUTPUT_MIN, OUTPUT_MAX, type LayoutDimension, type WorkspaceLayout } from '../model/workspaceLayout';
import { MAX_SETTINGS_QUERY_UNITS, SETTINGS_GROUPS, type SettingsGroup } from '../model/settingsSearch';

import { SettingsRevealContext, type SettingsRevealRequest, focusSettingsTarget } from './settingsReveal';
import { searchSettingsControls, settingsVisibleGroups, type SettingsSearchEntry } from '../model/settingsControlSearch';

interface Props {
  theme: 'dark' | 'light';
  appearance?: AppearancePreferences;
  resolvedAppearance?: ResolvedAppearance;
  onAppearanceChange?: (patch: Partial<AppearancePreferences>) => void;
  editor: EditorPreferences;
  autoSave: AutoSavePreferences;
  layout: WorkspaceLayout;
  recovery: ReactNode;
  compiler: ReactNode;
  intelliSense: ReactNode;
  portability?: ReactNode;
  shortcuts?: ReactNode;
  commandLibrary?: ReactNode;
  recoveryNeedsReview: boolean;
  onTheme: (theme: ThemeMode) => void;
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
  const [category, setCategory] = useState<SettingsGroup | 'all'>('all');
  const [reveal, setReveal] = useState<SettingsRevealRequest | null>(null);
  const sequence = useRef(0);
  const panel = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const results = searchSettingsControls(query);
  const matches = settingsVisibleGroups(query, category, props.recoveryNeedsReview);
  const hidden = (id: SettingsGroup) => !matches.includes(id);
  function jump(entry: SettingsSearchEntry) {
    setCategory(entry.group); setQuery('');
    setReveal({ id: entry.target, group: entry.group, sequence: ++sequence.current });
  }
  useEffect(() => {
    if (!reveal || !panel.current) return;
    // Nested preference sections reveal their own controls before focusing.
    if (reveal.id.startsWith('editor-experience-') || reveal.id.startsWith('intellisense-') || reveal.id.startsWith('studio-shortcut-')) return;
    focusSettingsTarget(panel.current, reveal.id, 'settings-category-' + reveal.group);
  }, [reveal]);
  return (
    <section ref={panel} id="editor-settings" className="editor-settings studio-settings-center" aria-label="Scarp Studio settings">
      <header className="studio-settings-header">
        <div><h2>Settings</h2><p>Local preferences · changes apply immediately</p></div>
        <div className="studio-settings-search">
          <input ref={searchInput} type="search" aria-label="Search settings" placeholder="Search settings"
            value={query} maxLength={MAX_SETTINGS_QUERY_UNITS}
            onChange={event => { setQuery(event.target.value.slice(0, MAX_SETTINGS_QUERY_UNITS)); setReveal(null); }}
            onKeyDown={event => {
              if (event.key === 'Enter' && query.trim() && results.entries.length && !event.nativeEvent.isComposing) {
                event.preventDefault(); jump(results.entries[0]);
              }
            }} />
          {query && <button className="settings-reset" type="button" onClick={() => setQuery('')}>Clear search</button>}
        </div>
        <button className="settings-reset" type="button" onClick={props.onClose}>Close settings</button>
      </header>
      <p className="settings-empty" role="status" aria-live="polite">
        {matches.length ? matches.length + ' settings group(s)' : 'No settings match your search.'}
        {props.recoveryNeedsReview && ' Recovery review remains visible.'}
      </p>
      <nav className="settings-category-nav" aria-label="Settings categories">
        <button type="button" aria-pressed={category === 'all' && !query.trim()} onClick={() => { setCategory('all'); setQuery(''); setReveal(null); }}>All settings</button>
        {SETTINGS_GROUPS.map(group => <button type="button" key={group.id}
          aria-pressed={category === group.id && !query.trim()} onClick={() => {
            setCategory(group.id); setQuery(''); setReveal(null);
          }}>{group.label}{group.id === 'recovery' && props.recoveryNeedsReview ? ' · Review' : ''}</button>)}
      </nav>
      {query.trim() && <section className="settings-search-results" aria-label="Matching preferences">
        <p role="status">{results.total} matching preferences{results.total > results.entries.length ? ' · showing first ' + results.entries.length : ''}. Press Enter to open the first result.</p>
        {results.entries.length ? <div className="settings-result-list">
          {results.entries.map(entry => <button type="button" key={entry.id} onClick={() => jump(entry)}>
            <strong>{entry.label}</strong><small>{SETTINGS_GROUPS.find(group => group.id === entry.group)?.label}</small>
          </button>)}
        </div> : <p>No individual preference matches. Try a shorter search or select a category.</p>}
      </section>}
      <SettingsRevealContext.Provider value={reveal}>
      <div className={'settings-grid' + (category !== 'all' && !query.trim() ? ' settings-grid-focused' : '')}>
        <fieldset className="settings-group" id="settings-category-appearance" tabIndex={-1} hidden={hidden('appearance')}>
          <legend>Appearance</legend>
          <AppearanceSettings preferences={props.appearance ?? { theme: props.theme, contrast: 'normal', motion: 'system' }}
            resolved={props.resolvedAppearance} onChange={patch => {
              if (props.onAppearanceChange) props.onAppearanceChange(patch);
              else if (patch.theme) props.onTheme(patch.theme);
            }} />
        </fieldset>
        <fieldset className="settings-group" id="settings-category-editor" tabIndex={-1} hidden={hidden('editor')}>
          <legend>Code editor</legend>
          <p>Display and editing preferences. Applying settings never rewrites existing source; editing behavior changes future input only.</p>
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
            <AdvancedEditorSettings preferences={editor} theme={props.theme} onChange={props.onEditorChange} />
            <button className="settings-reset" type="button" onClick={props.onResetEditor}>Reset editor only</button>
          </div>
        </fieldset>
        <fieldset className="settings-group settings-intellisense" id="settings-category-intellisense" tabIndex={-1} hidden={hidden('intellisense')}>
          <legend>IntelliSense and language assistance</legend>
          {props.intelliSense}
        </fieldset>
        <fieldset className="settings-group" id="settings-category-files" tabIndex={-1} hidden={hidden('files')}>
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
        <fieldset className="settings-group" id="settings-category-layout" tabIndex={-1} hidden={hidden('layout')}>
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
        <fieldset className="settings-group settings-compiler" id="settings-category-compiler" tabIndex={-1} hidden={hidden('compiler')}>
          <legend>Compiler configuration</legend>
          {props.compiler}
        </fieldset>
        <fieldset className="settings-group settings-shortcuts" id="settings-category-shortcuts" tabIndex={-1} hidden={hidden('shortcuts')}>
          <legend>Keyboard shortcuts</legend>
          {props.shortcuts ?? <p>Shortcut configuration is unavailable.</p>}
          {props.commandLibrary}
        </fieldset>
        <fieldset className="settings-group settings-portability" id="settings-category-portability" tabIndex={-1} hidden={hidden('portability')}>
          <legend>Studio preference transfer</legend>
          {props.portability ?? <p>Preference transfer is unavailable.</p>}
        </fieldset>
        <div className="settings-recovery settings-group" id="settings-category-recovery" tabIndex={-1} hidden={hidden('recovery')}>{props.recovery}</div>
      </div>
      </SettingsRevealContext.Provider>
      <footer className="settings-footer">
        <button className="settings-reset" type="button" onClick={() => { searchInput.current?.focus(); }}>Back to settings search</button>
        <button className="settings-reset" type="button" onClick={props.onResetAll}>Restore preference defaults</button>
        <span>Resets theme, editor, IntelliSense, keyboard shortcuts, workspace layout, Auto Save and startup discovery. Compiler approval is unchanged. Recovery copies and remembered workspace data are unchanged.</span>
      </footer>
    </section>
  );
}
