import { IntelliSenseProfilePanel } from './IntelliSenseProfilePanel';
import {
  ANALYSIS_BUDGETS, COMPLETION_MODES, ENTER_BEHAVIORS, HOVER_DELAYS,
  INTELLISENSE_PRESETS, SUGGESTION_DELAYS, SUGGESTION_LIMITS, TAB_BEHAVIORS,
  currentIntelliSensePreset, type IntelliSensePreferences, type IntelliSensePreset,
  type IntelliSenseSnapshot,
} from '../model/intelliSensePreferences';

interface Props {
  preferences: Readonly<IntelliSensePreferences>;
  persistence: IntelliSenseSnapshot['persistence'];
  onChange: (patch: Partial<IntelliSensePreferences>) => void;
  onReset: () => void;
}
type Flag = 'templates' | 'builtins' | 'keywordsAndTypes' | 'localFunctions' | 'documentWords' |
  'preferLocal' | 'hover' | 'localFunctionHover' | 'signatureHelp' | 'goToDefinition' | 'documentSymbols';
const completionFlags: readonly { key: Flag; label: string; description: string }[] = [
  { key: 'templates', label: 'Statement templates', description: 'Scarp declaration, control flow and other template snippets.' },
  { key: 'builtins', label: 'Built-in functions', description: 'Catalog functions, including typed argument placeholders.' },
  { key: 'keywordsAndTypes', label: 'Keywords and types', description: 'Language keywords and type names from the editor catalog.' },
  { key: 'localFunctions', label: 'Local function declarations', description: 'Bounded same-file function suggestions, not import resolution.' },
  { key: 'documentWords', label: 'Words from current document', description: 'Monaco text suggestions, not compiler-verified symbols.' },
  { key: 'preferLocal', label: 'Prefer local functions', description: 'Prioritize local declarations over catalog suggestions.' },
];
const navigationFlags: readonly { key: Flag; label: string; description: string }[] = [
  { key: 'hover', label: 'Hover documentation', description: 'Show editor help for known Scarp tokens and decimal literals.' },
  { key: 'localFunctionHover', label: 'Local function hover', description: 'Show typed signatures on unambiguous same-file calls when hover is enabled.' },
  { key: 'signatureHelp', label: 'Function parameter hints', description: 'Show local typed parameters while editing a call.' },
  { key: 'goToDefinition', label: 'Go to Definition', description: 'Enable Monaco same-file navigation to unambiguous local functions.' },
  { key: 'documentSymbols', label: 'Monaco document symbols', description: 'Enable Monaco symbols; the Studio sidebar outline is independent.' },
];
const presetLabels: Record<IntelliSensePreset, string> = { balanced: 'Balanced', manual: 'Manual', minimal: 'Minimal' };
const modeLabels = { automatic: 'Automatic', manual: 'Manual (Ctrl+Space)', off: 'Off' };
const enterLabels = { on: 'Always', smart: 'Smart', off: 'Never' };
const tabLabels = { off: 'Off', on: 'On', onlySnippets: 'Only snippets' };

export function IntelliSenseSettings({ preferences: p, persistence, onChange, onReset }: Props) {
  const preset = currentIntelliSensePreset(p);
  const completionOff = p.completionMode === 'off';
  const flag = (item: typeof completionFlags[number], disabled = false) => {
    const id = 'intellisense-' + item.key;
    return <div key={item.key}>
      <label className="editor-setting-checkbox" htmlFor={id}>
        <input type="checkbox" id={id} checked={p[item.key]} disabled={disabled}
          aria-describedby={id + '-help'} onChange={event => onChange({ [item.key]: event.target.checked })} />
        {item.label}
      </label>
      <p id={id + '-help'} className="intellisense-summary">{item.description}</p>
    </div>;
  };
  return (
    <div className="intellisense-settings">
      <p>Local editor assistance only. These settings never run the compiler, change source bytes, or control compiler verification.</p>
      {persistence === 'session-only' && <p role="status" className="intellisense-warning">
        Preferences apply in this session, but local storage is unavailable or could not save them.
      </p>}
      <div className="intellisense-section">
        <h3>Presets</h3>
        <div className="intellisense-presets" role="group" aria-label="IntelliSense presets">
          {(Object.keys(INTELLISENSE_PRESETS) as IntelliSensePreset[]).map(key =>
            <button type="button" className="settings-reset" key={key} aria-pressed={preset === key}
              onClick={() => onChange({ ...INTELLISENSE_PRESETS[key] })}>{presetLabels[key]}</button>)}
          <span role="status">{preset === 'custom' ? 'Custom preferences' : presetLabels[preset] + ' preset'}</span>
        </div>
        <p>Balanced enables automatic help. Manual avoids popups while typing. Minimal reduces local analysis and disables hover and parameter hints.</p>
      </div>
      <div className="intellisense-options-grid">
        <div className="intellisense-section">
          <h3>Completion behavior</h3>
          <div className="settings-controls">
            <div className="settings-control-row">
              <label htmlFor="intellisense-mode">Completion mode</label>
              <select id="intellisense-mode" value={p.completionMode} onChange={event => {
                const value = COMPLETION_MODES.find(choice => choice === event.target.value);
                if (value) onChange({ completionMode: value });
              }}>{COMPLETION_MODES.map(value => <option key={value} value={value}>{modeLabels[value]}</option>)}</select>
            </div>
            <div className="settings-control-row">
              <label htmlFor="intellisense-delay">Automatic delay</label>
              <select id="intellisense-delay" disabled={p.completionMode !== 'automatic'} value={p.suggestionDelay}
                onChange={event => {
                  const value = SUGGESTION_DELAYS.find(choice => choice === Number(event.target.value));
                  if (value !== undefined) onChange({ suggestionDelay: value });
                }}>{SUGGESTION_DELAYS.map(value => <option key={value} value={value}>{value} ms</option>)}</select>
            </div>
            <div className="settings-control-row">
              <label htmlFor="intellisense-limit">Scarp result limit</label>
              <select id="intellisense-limit" disabled={completionOff} value={p.suggestionLimit} onChange={event => {
                const value = SUGGESTION_LIMITS.find(choice => choice === Number(event.target.value));
                if (value !== undefined) onChange({ suggestionLimit: value });
              }}>{SUGGESTION_LIMITS.map(value => <option key={value} value={value}>{value}</option>)}</select>
            </div>
            <div className="settings-control-row">
              <label htmlFor="intellisense-enter">Accept using Enter</label>
              <select id="intellisense-enter" disabled={completionOff} value={p.acceptOnEnter} onChange={event => {
                const value = ENTER_BEHAVIORS.find(choice => choice === event.target.value);
                if (value) onChange({ acceptOnEnter: value });
              }}>{ENTER_BEHAVIORS.map(value => <option key={value} value={value}>{enterLabels[value]}</option>)}</select>
            </div>
            <div className="settings-control-row">
              <label htmlFor="intellisense-tab">Tab completion</label>
              <select id="intellisense-tab" disabled={completionOff} value={p.tabCompletion} onChange={event => {
                const value = TAB_BEHAVIORS.find(choice => choice === event.target.value);
                if (value) onChange({ tabCompletion: value });
              }}>{TAB_BEHAVIORS.map(value => <option key={value} value={value}>{tabLabels[value]}</option>)}</select>
            </div>
          </div>
          <p>Off disables Scarp completion and Monaco word suggestions; navigation and hover are independent. The result limit excludes Monaco word suggestions.</p>
        </div>
        <div className="intellisense-section">
          <h3>Suggestion sources</h3>
          <div className="intellisense-checks">
            {completionFlags.map(item => flag(item, completionOff))}
          </div>
          {completionOff && <p>Saved source selections are preserved while completion is off.</p>}
        </div>
        <div className="intellisense-section">
          <h3>Documentation and navigation</h3>
          <div className="intellisense-checks">{navigationFlags.map(item => flag(item, item.key === 'localFunctionHover' && !p.hover))}</div>
          <div className="settings-control-row">
            <label htmlFor="intellisense-hover-delay">Hover delay</label>
            <select id="intellisense-hover-delay" disabled={!p.hover} value={p.hoverDelay} onChange={event => {
              const value = HOVER_DELAYS.find(choice => choice === Number(event.target.value));
              if (value !== undefined) onChange({ hoverDelay: value });
            }}>{HOVER_DELAYS.map(value => <option key={value} value={value}>{value} ms</option>)}</select>
          </div>
        </div>
        <div className="intellisense-section">
          <h3>Local analysis performance</h3>
          <div className="settings-control-row">
            <label htmlFor="intellisense-budget">Maximum analyzed source size</label>
            <select id="intellisense-budget" value={p.localAnalysisKiB} onChange={event => {
              const value = ANALYSIS_BUDGETS.find(choice => choice === Number(event.target.value));
              if (value !== undefined) onChange({ localAnalysisKiB: value });
            }}>{ANALYSIS_BUDGETS.map(value => <option key={value} value={value}>{value} Ki UTF-16 units</option>)}</select>
          </div>
          <p>Applies to local function completion, hover, signatures, definitions and Monaco document symbols. Larger files skip these analyses. Compiler Run and Verify are unaffected.</p>
          <p>Existing lexical token, nesting and identifier limits still apply. This is not a setting for compiler memory or program limits.</p>
        </div>
      </div>
      <IntelliSenseProfilePanel preferences={p} onApply={onChange} />
      <button type="button" className="settings-reset" onClick={onReset}>Reset IntelliSense only</button>
    </div>
  );
}
