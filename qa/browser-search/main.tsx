import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProjectSearchScopeControls, ProjectSearchCoverage } from '../../src/components/ProjectSearchScopeControls';
import { ProjectSearchComparisonPanel } from '../../src/components/ProjectSearchComparisonPanel';
import { ProjectSearchLedgerPanel } from '../../src/components/ProjectSearchLedgerPanel';
import { ProjectSearchPresetsPanel } from '../../src/components/ProjectSearchPresetsPanel';
import { ProjectMatchExplorer } from '../../src/components/ProjectMatchExplorer';
import { ProjectSearchSweepPanel } from '../../src/components/ProjectSearchSweepPanel';
import { confirmSearchSweep, executeSearchSweep, type SearchSweepPlan, type SweepControl, type SweepExecution } from '../../src/model/projectSearchSweep';
import { searchListedProjectSources, type ProjectSearchResult, type ProjectSearchHit } from '../../src/model/projectSearch';
import {
  DEFAULT_PROJECT_SEARCH_SCOPE, buildProjectScopeInventory, planScopedProjectSearch,
  summarizeScopedSearch, type ScopedSearchSummary, type ProjectSearchScope,
} from '../../src/model/projectSearchScope';
import type { ProjectSearchSettings } from '../../src/model/projectSearchPresets';
import {
  createFixture, listedSources, editBuffer, recoverFile, addListedFile,
  removeDenseFile, createFixtureReader, QUERY, type FixtureWorkspace,
} from './fixture';
import './fixture.css';

interface CompletedSearch {
  readonly id: number;
  readonly settings: ProjectSearchSettings;
  readonly result: ProjectSearchResult;
  readonly summary: ScopedSearchSummary;
}

function initialSettings(): ProjectSearchSettings {
  return {
    query: QUERY,
    options: { caseSensitive: true, wholeWord: true },
    scope: DEFAULT_PROJECT_SEARCH_SCOPE,
  };
}

function Workbench() {
  const [workspace, setWorkspace] = useState(createFixture);
  const [settings, setSettings] = useState(initialSettings);
  const [completed, setCompleted] = useState<CompletedSearch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searches, setSearches] = useState(0);
  const [readPaths, setReadPaths] = useState<readonly string[]>([]);
  const [navigation, setNavigation] = useState('');
  const [paused, setPaused] = useState(false);
  const [session, setSession] = useState(0);
  const generation = useRef(0);
  const releaseRead = useRef<(() => void) | null>(null);
  const listed = useMemo(() => listedSources(workspace), [workspace]);
  const inventory = useMemo(() => buildProjectScopeInventory(listed), [listed]);

  function retire() {
    generation.current++;
    setCompleted(null);
    setNavigation('');
    setError('');
    setBusy(false);
    releaseRead.current?.();
    releaseRead.current = null;
  }

  function updateSettings(next: ProjectSearchSettings) {
    retire();
    setSettings(next);
  }

  function updateScope(scope: ProjectSearchScope) {
    updateSettings({ ...settings, scope });
  }

  function mutate(transform: (value: FixtureWorkspace) => FixtureWorkspace) {
    retire();
    setWorkspace(transform);
  }

  function reset() {
    retire();
    setWorkspace(createFixture());
    setSettings(initialSettings());
    setSearches(0);
    setReadPaths([]);
    setPaused(false);
    setSession(value => value + 1);
  }

  async function run() {
    if (busy || !settings.query) return;
    const plan = planScopedProjectSearch(inventory, settings.scope);
    if (!plan.ok) {
      setError(plan.error);
      return;
    }
    retire();
    const id = ++generation.current;
    const snapshot = settings;
    setBusy(true);
    setSearches(value => value + 1);
    let blocked = paused;
    const reader = createFixtureReader(workspace, async () => {
      if (!blocked) return;
      blocked = false;
      await new Promise<void>(resolve => {
        releaseRead.current = resolve;
      });
      releaseRead.current = null;
    });
    try {
      const result = await searchListedProjectSources(
        plan.value.sources,
        workspace.documents,
        snapshot.query,
        snapshot.options,
        reader.read,
        () => generation.current === id,
      );
      if (generation.current !== id || !result) return;
      setReadPaths(previous => [...previous, ...reader.paths()]);
      const summary = summarizeScopedSearch(plan.value, result);
      if (!summary.ok) {
        setError(summary.error);
        return;
      }
      setCompleted({ id, settings: snapshot, result, summary: summary.value });
    } catch (cause) {
      if (generation.current === id) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (generation.current === id) setBusy(false);
    }
  }

  async function runSweep(plan: SearchSweepPlan, control: SweepControl): Promise<SweepExecution> {
    if (busy) return {kind:'invalidated'};
    const checked = confirmSearchSweep(plan, listed, settings);
    if (!checked.ok) return {kind:'invalidated'};
    retire();
    const id = ++generation.current;
    setBusy(true);
    setSearches(value => value + 1);
    let blocked = paused;
    const reader = createFixtureReader(workspace, async () => {
      if (!blocked) return;
      blocked = false;
      await new Promise<void>(resolve => { releaseRead.current = resolve; });
      releaseRead.current = null;
    });
    try {
      const result = await executeSearchSweep(checked.value, workspace.documents, reader.read,
        {...control,isCurrent:()=>generation.current===id&&control.isCurrent()});
      if (generation.current===id) setReadPaths(previous=>[...previous,...reader.paths()]);
      return generation.current===id?result:{kind:'invalidated'};
    } finally {
      if(generation.current===id)setBusy(false);
    }
  }

  function navigate(hit: ProjectSearchHit) {
    // Capture the callback arguments only. Real native navigation and its
    // filesystem revalidation belong to desktop acceptance, not this fixture.
    setNavigation(JSON.stringify({
      name: hit.name,
      line: hit.match.line,
      column: hit.match.column,
      offset: hit.match.offset,
      match: hit.match.matchText,
      fromOpenTab: hit.fromOpenTab,
    }));
  }

  return <main aria-label="Search regression fixture">
    <h1>Search component regression fixture</h1>
    <p>Test-only workspace. All reads are synthetic; no native navigation occurs.</p>
    <section aria-label="Fixture controls">
      <button onClick={reset}>Reset fixture</button>
      <button onClick={() => mutate(editBuffer)}>Edit fixture buffer</button>
      <button onClick={() => mutate(recoverFile)}>Recover fixture read</button>
      <button onClick={() => mutate(addListedFile)}>Add fixture source</button>
      <button onClick={() => mutate(removeDenseFile)}>Remove dense fixture source</button>
      <label><input type="checkbox" checked={paused} onChange={event => setPaused(event.target.checked)}/>
        Pause first synthetic read</label>
      <button disabled={!busy} onClick={() => releaseRead.current?.()}>Release synthetic read</button>
      <button disabled={!busy} onClick={retire}>Cancel fixture search</button>
      <dl>
        <div><dt>Search invocations</dt><dd data-testid="search-count">{searches}</dd></div>
        <div><dt>Completed read attempts</dt><dd data-testid="read-count">{readPaths.length}</dd></div>
        <div><dt>Search busy</dt><dd data-testid="busy">{String(busy)}</dd></div>
      </dl>
      <output data-testid="read-paths">{JSON.stringify(readPaths)}</output>
      <output data-testid="navigation">{navigation}</output>
    </section>
    <section aria-label="Fixture search settings">
      <label>Query<input aria-label="Fixture query" value={settings.query} disabled={busy}
        onChange={event => updateSettings({ ...settings, query: event.target.value })}/></label>
      <label><input type="checkbox" checked={settings.options.caseSensitive} disabled={busy}
        onChange={event => updateSettings({
          ...settings, options: { ...settings.options, caseSensitive: event.target.checked },
        })}/>Fixture case sensitive</label>
      <label><input type="checkbox" checked={settings.options.wholeWord} disabled={busy}
        onChange={event => updateSettings({
          ...settings, options: { ...settings.options, wholeWord: event.target.checked },
        })}/>Fixture whole word</label>
      <button disabled={busy || !settings.query} onClick={() => void run()}>Search Project</button>
      {error && <p role="alert">{error}</p>}
    </section>
    <div key={session}>
      <ProjectSearchScopeControls listed={listed} scope={settings.scope} busy={busy} onChange={updateScope}/>
      <ProjectSearchPresetsPanel listed={listed} current={settings} busy={busy} onApply={next => {
        if (busy) return false;
        updateSettings(next);
        return true;
      }}/>
      <ProjectSearchLedgerPanel listed={listed} query={settings.query} options={settings.options}
        scope={settings.scope} current={completed?.summary ?? null} busy={busy} onScopeChange={updateScope}/>
      <ProjectSearchSweepPanel listed={listed} settings={settings} busy={busy} available onRun={runSweep}/>
      <ProjectSearchComparisonPanel current={completed ? {
        query: completed.settings.query,
        options: completed.settings.options,
        summary: completed.summary,
      } : null} busy={busy}/>
      {completed && <section key={completed.id} aria-label="Fixture completed search">
        <output data-testid="completed-id">{completed.id}</output>
        <ProjectSearchCoverage summary={completed.summary}/>
        <ProjectMatchExplorer result={completed.result} coverage={completed.summary}
          busy={busy} onNavigate={navigate}/>
      </section>}
    </div>
  </main>;
}

const host = document.getElementById('root');
if (!host) throw new Error('Missing browser test root');
createRoot(host).render(<Workbench/>);
