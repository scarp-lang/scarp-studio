import { useState } from 'react';
import { EDITOR_FONTS, type EditorPreferences } from '../model/editorPreferences';
import { DEFAULT_EDITOR_EXPERIENCE, EDITOR_EXPERIENCE_CHOICES, EDITOR_EXPERIENCE_LABELS, EXPERIENCE_INFO,
  EXPERIENCE_GROUPS, accessibilityExperiencePatch, editorExperiencePatch, experienceValueLabel, matchEditorExperience,
  type EditorExperienceKey } from '../model/editorExperience';
interface Props { preferences: EditorPreferences; theme: 'dark' | 'light'; onChange: (patch: Partial<EditorPreferences>) => void }
const sample = ['// Scarp editor preview', 'funcra add(a: integer, b: integer) -> integer {', '    return a + b;', '}', 'print(add(10, 20));'];
export function AdvancedEditorSettings({ preferences: p, theme, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [review, setReview] = useState<'accessibility' | 'reset' | null>(null);
  const matches = matchEditorExperience(p, query, modifiedOnly);
  const changed = matchEditorExperience(p, '', true);
  function patch(key: EditorExperienceKey, value: unknown) {
    const next = editorExperiencePatch(key, value);
    if (next) { setReview(null); onChange(next); }
  }
  return <section className="advanced-editor-settings" aria-label="Advanced editor experience">
    <h3>Advanced editor experience</h3>
    <p>{Object.keys(EDITOR_EXPERIENCE_CHOICES).length} additional editor preferences · {changed.length} modified</p>
    <button type="button" className="settings-reset" aria-expanded={open} aria-controls="editor-experience-content"
      onClick={() => { setOpen(value => !value); setReview(null); }}>{open ? 'Hide advanced editor experience' : 'Configure advanced editor experience'}</button>
    <div id="editor-experience-content" hidden={!open}>
      {open && <>
        <label htmlFor="editor-experience-query">Find advanced preferences</label>
        <input id="editor-experience-query" type="search" value={query} maxLength={120}
          onChange={event => setQuery(event.target.value.slice(0, 120))} placeholder="e.g. caret, indentation, screen reader" />
        <label className="editor-setting-checkbox"><input type="checkbox" checked={modifiedOnly}
          onChange={event => setModifiedOnly(event.target.checked)} /> Show modified advanced preferences only</label>
        <p role="status">{matches.length} matching preferences</p>
        <div className="transfer-actions">
          <button className="settings-reset" type="button" onClick={() => { setQuery(''); setModifiedOnly(false); }}>Clear advanced filters</button>
          <button className="settings-reset" type="button" onClick={() => setReview('accessibility')}>Review accessibility preset</button>
          <button className="settings-reset" type="button" disabled={!changed.length} onClick={() => setReview('reset')}>Review advanced reset</button>
        </div>
        {review && <div className="transfer-review" role="group" aria-label="Review editor preference changes">
          <p>{review === 'accessibility' ? 'Enable screen reader support, solid caret, no caret motion, visible control characters, 28 px line height and 0.5 px letter spacing.' :
            'Restore advanced options only. Basic font, theme and IntelliSense remain unchanged.'}</p>
          <button type="button" className="settings-reset" onClick={() => {
            onChange(review === 'accessibility' ? accessibilityExperiencePatch() : { ...DEFAULT_EDITOR_EXPERIENCE }); setReview(null);
          }}>Confirm {review === 'accessibility' ? 'accessibility preset' : 'advanced reset'}</button>
          <button type="button" className="settings-reset" onClick={() => setReview(null)}>Cancel review</button>
        </div>}
        {EXPERIENCE_GROUPS.map(group => {
          const groupKeys = matches.filter(key => EXPERIENCE_INFO[key].group === group);
          return groupKeys.length > 0 && <fieldset key={group} className="experience-group"><legend>{group}</legend>
            {groupKeys.map(key => {
              const id = 'editor-experience-' + key;
              const choices: readonly (string | number | boolean)[] = EDITOR_EXPERIENCE_CHOICES[key];
              return <div key={key} className="experience-control">
                <div className="settings-control-row">
                  <label htmlFor={id}>{EDITOR_EXPERIENCE_LABELS[key]}</label>
                  <select id={id} aria-describedby={id + '-help'} value={String(p[key])} onChange={event => {
                    const next = choices.find(choice => String(choice) === event.target.value);
                    if (next !== undefined) patch(key, next);
                  }}>{choices.map(choice => <option key={String(choice)} value={String(choice)}>{experienceValueLabel(key, choice)}</option>)}</select>
                  {p[key] !== DEFAULT_EDITOR_EXPERIENCE[key] && <button type="button" className="settings-reset"
                    aria-label={'Reset ' + EDITOR_EXPERIENCE_LABELS[key]} onClick={() => patch(key, DEFAULT_EDITOR_EXPERIENCE[key])}>Reset</button>}
                </div>
                <small id={id + '-help'}>{EXPERIENCE_INFO[key].help}</small>
              </div>;
            })}
          </fieldset>;
        })}
        {!matches.length && <p>No advanced editor preferences match.</p>}
        <h4>Typography preview</h4>
        <p>Fixed sample approximates typography. Actual Monaco rendering and installed fonts may differ.</p>
        <div className="experience-preview" aria-label="Read-only Scarp typography sample" style={{
          background: theme === 'dark' ? '#151922' : '#f8fafc', color: theme === 'dark' ? '#dbeafe' : '#172554',
          fontFamily: EDITOR_FONTS[p.font], fontSize: p.fontSize, lineHeight: p.lineHeight ? p.lineHeight + 'px' : '1.5',
          letterSpacing: p.letterSpacing + 'px', fontVariantLigatures: p.fontLigatures ? 'normal' : 'none',
        }}>{sample.map((line, i) => <div className="sample-line" key={i}>
          {p.lineNumbers && <span className="sample-number" aria-hidden="true">{i + 1}</span>}
          <code style={{ fontFamily: 'inherit' }}>{p.showWhitespace ? line.replaceAll(' ', '·') : line}</code>
        </div>)}</div>
      </>}
    </div>
  </section>;
}
