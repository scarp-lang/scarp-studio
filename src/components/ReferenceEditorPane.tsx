import Editor from '@monaco-editor/react';
import { useMemo } from 'react';
import type { StudioDocument } from '../model/documents';
import {
  buildReferenceInventory, resolveReferenceSource, planReferenceSwap,
  MIN_REFERENCE_SHARE, MAX_REFERENCE_SHARE, type ReferenceLayout,
} from '../model/referenceEditor';

interface ReferenceEditorPaneProps {
  documents: readonly StudioDocument[];
  activeId: string | null;
  selectedId: string | null;
  layout: ReferenceLayout;
  theme: string;
  busy: boolean;
  onSelect: (id: string | null) => void;
  onLayout: (patch: Partial<ReferenceLayout>) => void;
  onSwap: () => void;
  onClose: () => void;
}

export function ReferenceEditorPane({
  documents, activeId, selectedId, layout, theme, busy,
  onSelect, onLayout, onSwap, onClose,
}: ReferenceEditorPaneProps) {
  const inventory = useMemo(() => buildReferenceInventory(documents, activeId, selectedId),
    [documents, activeId, selectedId]);
  const source = resolveReferenceSource(documents, activeId, selectedId);
  const canSwap = !busy && planReferenceSwap(documents, activeId, selectedId) !== null;
  const choice = inventory.choices.find(item => item.id === selectedId);
  const messages = {
    none: 'Choose another open source tab to reference here.',
    closed: 'The reference tab is no longer open.',
    ambiguous: 'The reference tab cannot be identified uniquely.',
    'same-active': 'This source is currently active. Choose another tab or switch the primary editor.',
    'too-large': 'This source exceeds the reference pane size limit.',
  };
  return (
    <aside id="scarp-reference-pane" className="reference-pane"
      aria-label="Read-only source reference" style={{ flexBasis: layout.share + '%' }}>
      <header className="reference-pane-header">
        <div className="reference-pane-title">
          <strong>Reference</strong>
          <span className="reference-badge">Read only</span>
          <button type="button" onClick={onClose} aria-label="Close reference pane">×</button>
        </div>
        <label>Open source
          <select aria-label="Reference source" value={choice ? 'tab:' + choice.id : ''}
            onChange={event => onSelect(event.target.value ? event.target.value.slice(4) : null)}>
            <option value="">Choose an open tab</option>
            {inventory.choices.map(item => <option key={item.id} value={'tab:' + item.id}
              disabled={item.active || item.unavailable}>
              {item.label}{item.modified ? ' •' : ''}{item.active ? ' (active)' : ''}
              {item.unavailable ? ' (too large)' : ''}
            </option>)}
          </select>
        </label>
        <div className="reference-pane-controls">
          <label>Layout
            <select aria-label="Reference layout" value={layout.orientation}
              onChange={event => {
                const orientation = event.target.value;
                if (orientation === 'horizontal' || orientation === 'vertical') onLayout({ orientation });
              }}>
              <option value="horizontal">Side by side</option>
              <option value="vertical">Stacked</option>
            </select>
          </label>
          <label className="reference-share-control">Size
            <input type="range" aria-label="Reference pane size" min={MIN_REFERENCE_SHARE}
              max={MAX_REFERENCE_SHARE} value={layout.share}
              onChange={event => onLayout({ share: Number(event.target.value) })} />
            <output>{layout.share}%</output>
          </label>
          <button type="button" disabled={!canSwap} onClick={onSwap}>Swap with active editor</button>
        </div>
        {inventory.limited && <small>Showing up to 200 open tabs, including current selections.</small>}
        {inventory.ambiguous && <small>Duplicate tab identities were omitted.</small>}
        {source.kind === 'available' && <small>
          {choice?.modified ? 'Live unsaved buffer' : 'Live open buffer'} · edits belong in the primary editor
        </small>}
      </header>
      <div className="reference-pane-body">
        {source.kind === 'available' ? <Editor
          key={source.document.id}
          language="scarp"
          theme={theme}
          value={source.document.content}
          saveViewState={false}
          options={{
            readOnly: true,
            ariaLabel: 'Read-only Scarp reference editor',
            automaticLayout: true,
            minimap: { enabled: false },
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            codeLens: false,
            renderLineHighlight: 'none',
            cursorBlinking: 'solid',
          }}
        /> : <div className="reference-pane-empty" role="status">{messages[source.kind]}</div>}
      </div>
    </aside>
  );
}
