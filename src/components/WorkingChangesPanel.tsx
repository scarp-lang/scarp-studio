import { useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import {
  compareScarpSnapshots, type SourceDiffHunk,
} from '../model/sourceDiff';
import type { InsightNavigation } from './SourceInsightsPanel';

interface Props {
  document: StudioDocument | null;
  onNavigate: (target: InsightNavigation) => void;
  initiallyExpanded?: boolean;
}

export function WorkingChangesPanel({
  document, onNavigate, initiallyExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [showContext, setShowContext] = useState(true);
  const [limit, setLimit] = useState(8);

  const report = useMemo(() => {
    if (!expanded || !document) return null;
    return compareScarpSnapshots(document.savedContent, document.content);
  }, [expanded, document?.id, document?.revision, document?.savedContent, document?.content]);

  function jump(hunk: SourceDiffHunk): void {
    if (!document || !report || report.status !== 'ready') return;
    if (!Number.isSafeInteger(hunk.navigateLine) || hunk.navigateLine < 1) return;
    onNavigate({
      documentId: document.id, revision: document.revision,
      source: document.content, line: hunk.navigateLine, column: 1,
    });
  }

  const shown = report?.hunks.slice(0, limit) ?? [];
  return <section className="sidebar-section changes-panel" aria-label="Scarp working changes">
    <div className="sidebar-heading">WORKING CHANGES</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded}
      aria-controls="studio-working-changes-body" onClick={() => setExpanded(v => !v)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide source diff' : 'Compare with saved source'}</span>
    </button>
    <div id="studio-working-changes-body" hidden={!expanded}>
      {!document && <p className="sidebar-note">Open a Scarp file to view unsaved changes.</p>}
      {report && <div className="changes-content">
        <p className="changes-disclaimer">
          Comparing in-memory editor text with its last saved snapshot.
          No disk reads, writes, or automatic merges.
        </p>
        {report.status === 'clean' && <p role="status" className="changes-clean">
          No unsaved text changes relative to this editor's saved snapshot.
        </p>}
        {report.status === 'limited' && <p role="status" className="sidebar-note">
          {report.message}
        </p>}
        {report.status === 'ready' && <>
          <div className="changes-counts" role="status">
            <span>{report.hunkCount} change {report.hunkCount === 1 ? 'group' : 'groups'}</span>
            <span>+{report.addedLines} / −{report.removedLines} lines</span>
          </div>
          {report.message && <p role="status" className="sidebar-note">
            {report.message}
          </p>}
          <label className="changes-toggle-context">
            <input type="checkbox" checked={showContext}
              onChange={event => setShowContext(event.target.checked)} />
            Show unchanged context
          </label>
          {shown.map((hunk) => <section key={hunk.id} className="changes-hunk"
            aria-label={'Changed source near line ' + hunk.navigateLine}>
            <div className="changes-hunk-header">
              <span>−{hunk.beforeStart},{hunk.beforeCount} +{hunk.afterStart},{hunk.afterCount}</span>
              <button type="button" onClick={() => jump(hunk)}
                title={'Go to current source line ' + hunk.navigateLine}>
                Go to line {hunk.navigateLine}
              </button>
            </div>
            <div className="changes-hunk-lines">
              {hunk.lines.filter(line => showContext || line.kind !== 'context').map((line, index) =>
                <div key={index} className={'changes-line changes-line-' + line.kind}>
                  <span aria-hidden="true" className="changes-line-marker">
                    {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : '·'}
                  </span>
                  <span className="changes-line-number">
                    {line.kind === 'removed' ? line.beforeLine : line.afterLine}
                  </span>
                  <code>{line.preview}{line.previewTruncated ? '…' : ''}</code>
                  {line.endingChanged && <span title="Line ending differs">↵</span>}
                </div>)}
            </div>
          </section>)}
          {shown.length < report.hunks.length && <button type="button"
            className="changes-more"
            onClick={() => setLimit(current => Math.min(report.hunks.length, current + 8))}>
            Show more change groups ({report.hunks.length - shown.length} remaining)
          </button>}
          <p className="changes-disclaimer">
            The comparison is a preview, not an external disk modification check.
            Save and Save As retain their independent safety validation.
          </p>
        </>}
      </div>}
    </div>
  </section>;
}
