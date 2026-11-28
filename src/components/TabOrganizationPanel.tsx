import { useMemo, useState } from 'react';
import type { EditorState } from '../model/editorState';
import {
  MAX_PINNED_EDITOR_TABS, TAB_ORGANIZATION_SORTS, organizeEditorTabs, tabMoveAvailability,
  type TabOrganizationOperation, type TabOrganizationSort,
} from '../model/tabOrganization';
import { disambiguateDocumentNames } from '../model/documentLabels';

interface Props {
  editor: EditorState;
  busy: boolean;
  onOrganize: (operation: TabOrganizationOperation, expectedRevision: number) => boolean;
  initiallyExpanded?: boolean;
}

interface SortReview {
  readonly order: TabOrganizationSort;
  readonly sessionRevision: number;
  readonly beforeIds: readonly string[];
  readonly afterIds: readonly string[];
}

const SORT_LABELS: Record<TabOrganizationSort, string> = {
  name: 'Filename (natural order)',
  folder: 'Parent folder, then filename',
  modified: 'Modified first, then filename',
};

export function TabOrganizationPanel({ editor, busy, onOrganize, initiallyExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [order, setOrder] = useState<TabOrganizationSort>('name');
  const [review, setReview] = useState<SortReview | null>(null);
  const [notice, setNotice] = useState('');
  const [showAll, setShowAll] = useState(false);
  const pins = editor.pinnedTabIds ?? [];
  const current = editor.documents.find(document => document.id === editor.activeId);
  const pinned = !!current && pins.includes(current.id);
  const movement = tabMoveAvailability(editor.documents, pins, editor.activeId);
  const labels = useMemo(() => expanded ? disambiguateDocumentNames(editor.documents) : new Map<string, string>(),
    [editor.documents, expanded]);
  const stale = review !== null && review.sessionRevision !== editor.sessionRevision;

  function apply(operation: TabOrganizationOperation) {
    if (busy) return;
    if (onOrganize(operation, editor.sessionRevision)) {
      setReview(null);
      setNotice('Tab organization updated.');
    }
  }

  function prepareSort() {
    if (busy) return;
    const plan = organizeEditorTabs(editor.documents, pins, { kind: 'sort', order });
    if (!plan.ok) {
      setNotice(plan.error);
      setReview(null);
      return;
    }
    setReview({
      order,
      sessionRevision: editor.sessionRevision,
      beforeIds: editor.documents.map(document => document.id),
      afterIds: plan.value.documents.map(document => document.id),
    });
    setShowAll(false);
    setNotice('');
  }

  function confirmSort() {
    if (!review || stale || busy) return;
    if (onOrganize({ kind: 'sort', order: review.order }, review.sessionRevision)) {
      setReview(null);
      setNotice('Unpinned tabs sorted. Source contents and saved state are unchanged.');
    }
  }

  return <section className="tab-organization" aria-label="Editor tab organization">
    <div className="tab-organization-toolbar">
      <button type="button" aria-expanded={expanded} onClick={() => {
        setExpanded(value => !value);
        setReview(null);
        setNotice('');
      }}>{expanded ? 'Hide tab tools' : 'Organize tabs'}</button>
      <span>{editor.documents.length} open · {pins.length} pinned</span>
      {current && <button type="button" aria-pressed={pinned} disabled={busy || (!pinned && pins.length >= MAX_PINNED_EDITOR_TABS)}
        onClick={() => apply({ kind: 'pin', id: current.id, pinned: !pinned })}>
        {pinned ? 'Unpin active tab' : 'Pin active tab'}
      </button>}
    </div>
    {expanded && <div className="tab-organization-body">
      <p>Pinned tabs stay in the leading group and cannot be closed until unpinned.
        Pinning and moving tabs are session-only and never save or modify source files.</p>
      {current && <p>Active: <strong>{labels.get(current.id) ?? current.name}</strong>
        {' · '}{pinned ? 'Pinned' : 'Unpinned'}</p>}
      <div className="tab-organization-actions">
        <button type="button" disabled={busy || !movement.left || !current}
          onClick={() => current && apply({ kind: 'move', id: current.id, direction: -1 })}>Move active left</button>
        <button type="button" disabled={busy || !movement.right || !current}
          onClick={() => current && apply({ kind: 'move', id: current.id, direction: 1 })}>Move active right</button>
        <label>Sort unpinned tabs <select aria-label="Unpinned tab sort order" value={order} disabled={busy}
          onChange={event => {
            const next = TAB_ORGANIZATION_SORTS.find(value => value === event.target.value);
            if (next) { setOrder(next); setReview(null); setNotice(''); }
          }}>
          {TAB_ORGANIZATION_SORTS.map(value => <option key={value} value={value}>{SORT_LABELS[value]}</option>)}
        </select></label>
        <button type="button" disabled={busy || editor.documents.length - pins.length < 2} onClick={prepareSort}>Review tab sort</button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {review && <section className="tab-organization-review" aria-label="Review tab sort">
        <p>{SORT_LABELS[review.order]}. Pinned tabs retain their exact order.</p>
        {stale ? <p role="alert">The editor changed after review. Cancel and review the current order again.</p> :
          <div className="tab-sort-columns">
            <div><strong>Current order</strong><ol>{review.beforeIds.slice(0, showAll ? undefined : 12).map(id =>
              <li key={id}>{labels.get(id) ?? 'Open source'}{pins.includes(id) ? ' (pinned)' : ''}</li>)}</ol></div>
            <div><strong>Proposed order</strong><ol>{review.afterIds.slice(0, showAll ? undefined : 12).map(id =>
              <li key={id}>{labels.get(id) ?? 'Open source'}{pins.includes(id) ? ' (pinned)' : ''}</li>)}</ol></div>
          </div>}
        {!stale && review.afterIds.length > 12 && <button type="button" onClick={() => setShowAll(value => !value)}>
          {showAll ? 'Show first 12 tabs' : 'Show all ' + review.afterIds.length + ' tabs'}
        </button>}
        <button type="button" disabled={busy || stale} onClick={confirmSort}>Confirm tab sort</button>
        <button type="button" onClick={() => setReview(null)}>Cancel tab sort</button>
      </section>}
    </div>}
  </section>;
}
