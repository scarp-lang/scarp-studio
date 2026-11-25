import { useMemo, useState } from 'react';
import {
  MAX_WORKSPACE_ITEM_NAME, planWorkspaceCreation, workspaceCreationTargets,
  type WorkspaceCreateKind, type WorkspaceCreateRequest,
} from '../model/workspaceCreate';

interface Props {
  directories: readonly string[];
  unavailable: readonly string[];
  busy: boolean;
  onCreate: (request: WorkspaceCreateRequest) => Promise<boolean>;
  initiallyExpanded?: boolean;
}

export function WorkspaceCreatePanel({
  directories, unavailable, busy, onCreate, initiallyExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [kind, setKind] = useState<WorkspaceCreateKind>('source');
  const [directory, setDirectory] = useState('');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const targets = useMemo(() => workspaceCreationTargets(directories, unavailable),
    [directories, unavailable]);
  const request = { kind, directory, name };
  const validation = planWorkspaceCreation(request, targets);
  const locked = busy || pending;

  async function submit() {
    if (locked || !validation.ok) return;
    setPending(true);
    try {
      if (await onCreate(request)) setName('');
    } finally {
      setPending(false);
    }
  }

  return <section className="workspace-create-panel" aria-label="Create Scarp workspace items">
    <button type="button" className="insights-toggle"
      aria-expanded={expanded} aria-controls="studio-workspace-create"
      onClick={() => setExpanded(value => !value)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide creation tools' : 'New source or folder'}</span>
    </button>
    <div id="studio-workspace-create" hidden={!expanded}>
      {expanded && <form className="workspace-create-form"
        onSubmit={event => { event.preventDefault(); void submit(); }}>
        <p className="insights-disclaimer">
          Create an empty .srp file or a single folder in the selected workspace.
          Existing files are never intentionally overwritten.
        </p>
        <label>
          Item type
          <select value={kind} disabled={locked} onChange={event => {
            if (event.target.value === 'source' || event.target.value === 'directory') {
              setKind(event.target.value);
            }
          }}>
            <option value="source">Scarp source (.srp)</option>
            <option value="directory">Folder</option>
          </select>
        </label>
        <label>
          Parent folder
          <select value={directory} disabled={locked} onChange={event => setDirectory(event.target.value)}>
            {!targets.includes(directory) &&
              <option value={directory} disabled>Previous folder unavailable</option>}
            {targets.map(target => <option key={target} value={target}>
              {target || 'Workspace root'}
            </option>)}
          </select>
        </label>
        <label>
          Name
          <input type="text" value={name} disabled={locked} maxLength={MAX_WORKSPACE_ITEM_NAME}
            placeholder={kind === 'source' ? 'example.srp' : 'practice'}
            autoComplete="off" spellCheck={false} onChange={event => setName(event.target.value)} />
        </label>
        {validation.ok ? <p className="workspace-create-preview" role="status">
          Destination: <code>{validation.plan.relativePath}</code>
        </p> : name.length > 0 && <p className="sidebar-note" role="status">{validation.error}</p>}
        <button type="submit" disabled={locked || !validation.ok}>
          {pending ? 'Creating…' : kind === 'source' ? 'Create empty source' : 'Create folder'}
        </button>
      </form>}
    </div>
  </section>;
}
