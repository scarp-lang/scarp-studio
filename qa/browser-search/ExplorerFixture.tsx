import { useState } from 'react';
import { ProjectExplorer } from '../../src/components/ProjectExplorer';
import { openedDocument, updateContent } from '../../src/model/documents';

const root = 'C:/fixture-private-explorer/';
const sourceNames = [
  'main.srp', 'basic_tuple/main.srp', 'basic_tuple/src/deep/math.srp',
  'basic_tuple/src/deep/other.srp', 'basic_tuple_extra/main.srp',
  'loops/main.srp', 'loops/tests/check.srp',
] as const;
const sources = sourceNames.map(name => ({ name, path: root + name }));
const directories = ['basic_tuple', 'basic_tuple_extra', 'loops', 'loops/tests', 'empty'];
const projects = ['basic_tuple', 'basic_tuple_extra', 'loops', 'empty'];
const activeName = 'basic_tuple/src/deep/math.srp';
const active = openedDocument([], root + activeName, 'print(1);');
const dirty = updateContent(active.documents, active.id, 'print(2);');
const second = openedDocument(dirty, root + 'loops/main.srp', 'print(3);');
const documents = second.documents;

export function ExplorerFixture() {
  const [generation, setGeneration] = useState(0);
  const [removeTuple, setRemoveTuple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>('basic_tuple');
  const [opened, setOpened] = useState<string[]>([]);

  function reset() {
    setGeneration(value => value + 1);
    setRemoveTuple(false);
    setBusy(false);
    setSelected('basic_tuple');
    setOpened([]);
  }

  function allowed(name: string) {
    return !removeTuple || (name !== 'basic_tuple' && !name.startsWith('basic_tuple/'));
  }

  const files = sources.filter(source => allowed(source.name));
  return <section aria-label="Explorer interaction fixture">
    <h2>Workspace Explorer browser fixture</h2>
    <button onClick={reset}>Reset Explorer fixture</button>
    <button onClick={() => setRemoveTuple(value => !value)}>
      {removeTuple ? 'Restore tuple folder' : 'Remove tuple folder'}
    </button>
    <label><input type="checkbox" checked={busy} onChange={event => setBusy(event.target.checked)}/>
      Explorer native operation busy</label>
    <output data-testid="explorer-open-requests">{JSON.stringify(opened)}</output>
    <output data-testid="explorer-selected-project">{selected ?? ''}</output>
    <div aria-label="Explorer under test">
      <ProjectExplorer key={generation} files={files} directories={directories.filter(allowed)}
        projectRoots={projects.filter(allowed).map(directory => ({ directory }))}
        documents={documents} activeId={active.id} busy={busy}
        selectedProjectDirectory={selected} onSelectProject={setSelected}
        onOpen={path => setOpened(previous => [...previous, path])}/>
    </div>
  </section>;
}
