import { useMemo, useState } from 'react';
import type { IntelliSensePreferences } from '../model/intelliSensePreferences';
import { evaluateIntelliSensePreview, INTELLISENSE_EXAMPLES, type PreviewId } from '../language/intelliSensePreview';

export function IntelliSensePreviewPanel({ preferences }: { preferences: Readonly<IntelliSensePreferences> }) {
  const [example, setExample] = useState<PreviewId>('local');
  const result = useMemo(() => evaluateIntelliSensePreview(example, preferences), [example, preferences]);
  return <section className="intellisense-section intellisense-preview-panel" aria-label="IntelliSense preview">
    <h3>IntelliSense preview</h3>
    <p>Try built-in examples with your current preferences. This read-only test bench uses Scarp editor assistance, not a compiler or your workspace files.</p>
    <div className="settings-control-row">
      <label htmlFor="intellisense-preview-example">Example</label>
      <select id="intellisense-preview-example" value={example} onChange={event => {
        const next = INTELLISENSE_EXAMPLES.find(item => item.id === event.target.value);
        if (next) setExample(next.id);
      }}>
        {INTELLISENSE_EXAMPLES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    </div>
    <pre className="preview-code" aria-label="Read-only sample source, marker indicates cursor"><code>{result.before}<mark aria-label="Cursor">│</mark>{result.after}</code></pre>
    <div className="preview-metadata">
      <span>Mode: {preferences.completionMode}</span>
      <span>Scarp result limit: {preferences.suggestionLimit}</span>
      <span>Local budget: {preferences.localAnalysisKiB} Ki UTF-16 units</span>
      <span>Inline labels: {preferences.inlayHintMode}</span>
    </div>
    <p role="status">{result.explanation} {result.results.length} result(s).</p>
    {result.results.length > 0 ? <div className="preview-results" aria-label="Sample results">
      {result.results.map((item, index) => <div className="preview-result" key={item.kind + ':' + item.label + ':' + index}>
        <code>{item.label}</code><span className="preview-kind">{item.kind}</span><p>{item.detail}</p>
        {item.insertion !== undefined && <p>Insert {item.asSnippet ? 'template' : 'text'}: <code>{item.insertion}</code></p>}
      </div>)}
    </div> : <p>No sample result with the current configuration.</p>}
  </section>;
}
