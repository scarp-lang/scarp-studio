import { useState } from 'react';
import type { IntelliSensePreferences } from '../model/intelliSensePreferences';
import {
  diagnosticReportIsCurrent, effectiveIntelliSenseBudget, INTELLISENSE_DIAGNOSTIC_LIMITS,
  intelliSenseAvailability, type DiagnosticDocument, type IntelliSenseDocumentReport, type AssistanceAvailability,
} from '../language/intelliSenseDiagnostics';
const stateLabels: Record<AssistanceAvailability['state'], string> = {
  available: 'Eligible', manual: 'Manual only', disabled: 'Off', 'no-document': 'No source', 'size-limited': 'Size limited',
};
const reportLabels: Record<IntelliSenseDocumentReport['status'], string> = {
  eligible: 'Bounded lexical inventory available',
  oversized: 'Source exceeds the configured size budget',
  'token-limit': 'Lexical inventory incomplete (token budget reached)',
  'lexical-issues': 'Lexical issues prevent conservative local analysis',
  'unsupported-structure': 'Declaration inventory is unsupported or ambiguous',
};
interface Props {
  preferences: Readonly<IntelliSensePreferences>;
  document: DiagnosticDocument | null;
  onInspect?: () => IntelliSenseDocumentReport | null;
}
interface Inspection { document: DiagnosticDocument; report: IntelliSenseDocumentReport }
export function IntelliSenseDiagnosticsPanel({ preferences, document, onInspect }: Props) {
  const [open, setOpen] = useState(false);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [notice, setNotice] = useState('');
  const current = inspection && diagnosticReportIsCurrent(inspection.document, inspection.report, document, preferences.localAnalysisKiB)
    ? inspection.report : null;
  const available = intelliSenseAvailability(preferences, document);
  const eligible = available.filter(item => item.state === 'available' || item.state === 'manual').length;
  return <section className="intellisense-section intellisense-diagnostics" aria-label="IntelliSense availability">
    <h3>IntelliSense availability</h3>
    <p role="status">{eligible} / {available.length} features eligible by settings and source size. Context and lexical limits still apply.</p>
    <button type="button" className="settings-reset" aria-expanded={open} aria-controls="intellisense-diagnostic-details"
      onClick={() => setOpen(value => !value)}>{open ? 'Hide availability details' : 'Show availability details'}</button>
    <div id="intellisense-diagnostic-details" hidden={!open}>
      {open && <>
        <dl className="diagnostic-metrics">
          <dt>Active source size (UTF-16 units)</dt><dd>{document?.units ?? 'No source'}</dd>
          <dt>Configured local budget (UTF-16 units)</dt><dd>{effectiveIntelliSenseBudget(preferences.localAnalysisKiB)}</dd>
          <dt>Per-line assistance limit</dt><dd>{INTELLISENSE_DIAGNOSTIC_LIMITS.lineUnits}</dd>
          <dt>Lexical token limit</dt><dd>{INTELLISENSE_DIAGNOSTIC_LIMITS.tokens}</dd>
          <dt>Inline label limit per source</dt><dd>{INTELLISENSE_DIAGNOSTIC_LIMITS.inlineLabels}</dd>
        </dl>
        <ul className="diagnostic-feature-list" aria-label="Feature eligibility">
          {available.map(item => <li key={item.label}><strong>{item.label}</strong><span>{stateLabels[item.state]}</span>
            <small>{item.detail}</small></li>)}
        </ul>
        <p>Optional inspection analyzes only the current in-memory source within the configured budget. It does not run the compiler, save files, or export source text.</p>
        <button type="button" className="settings-reset" disabled={!document || !onInspect} onClick={() => {
          if (!document || !onInspect) return;
          const report = onInspect();
          if (!report) { setInspection(null); setNotice('Source changed before inspection. Try again.'); return; }
          setInspection({ document: { ...document }, report }); setNotice('');
        }}>Inspect active source</button>
        {notice && <p role="status">{notice}</p>}
        {inspection && !current && <p role="status">Source or analysis budget changed. Inspect again for current results.</p>}
        {current && <div className="diagnostic-report" role="status">
          <strong>{reportLabels[current.status]}</strong>
          <dl className="diagnostic-metrics">
            <dt>Scanned tokens</dt><dd>{current.tokens ?? 'Not scanned'}</dd>
            <dt>Reported lexical issues</dt><dd>{current.issues ?? 'Not scanned'}</dd>
            <dt>Lines</dt><dd>{current.lines ?? 'Not scanned'}</dd>
            <dt>Indexed top-level function declarations</dt><dd>{current.declarations ?? 'Unavailable'}</dd>
          </dl>
          <p>This is editor-only eligibility, not a compiler syntax or type check.</p>
        </div>}
      </>}
    </div>
  </section>;
}
