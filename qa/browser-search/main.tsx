import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProjectSearchScopeControls, ProjectSearchCoverage } from '../../src/components/ProjectSearchScopeControls';
import { ProjectSearchComparisonPanel } from '../../src/components/ProjectSearchComparisonPanel';
import { ProjectSearchLedgerPanel } from '../../src/components/ProjectSearchLedgerPanel';
import { ProjectSearchPresetsPanel } from '../../src/components/ProjectSearchPresetsPanel';
import { ProjectMatchExplorer } from '../../src/components/ProjectMatchExplorer';
import { ProjectInspectionPanel } from '../../src/components/ProjectInspectionPanel';
import { ProjectVerificationPanel } from '../../src/components/ProjectVerificationPanel';
import { confirmProjectInspection, executeProjectInspection, resolveInspectionSource,
  type ProjectInspectionPlan, type InspectionSettings, type InspectionControl, type InspectionExecution,
  type ProjectInspectionReport } from '../../src/model/projectInspection';
import { confirmProjectVerification, executeProjectVerification,
  type ProjectVerificationPlan, type VerificationRule, type VerificationControl, type VerificationExecution } from '../../src/model/projectVerification';
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
  removeDenseFile, createFixtureReader, addFixtureTask, QUERY, type FixtureWorkspace,
} from './fixture';
import { ListedSymbolPanel } from '../../src/components/ListedSymbolPanel';
import { ListedCodeReferencesPanel } from '../../src/components/ListedCodeReferencesPanel';
import { executeListedSymbolIndex, resolveListedSymbolPath, recheckListedSymbolSite,
  type ListedSymbolExecution, type ListedSymbolReport, type ListedSymbolSite } from '../../src/model/listedSymbolIndex';
import { confirmListedReferences, executeListedReferences, resolveListedReferencePath, recheckListedReference,
  type ListedReferenceExecution, type ListedReferencePlan, type ListedReferenceQuery,
  type ListedReferenceReport, type ListedReferenceSite } from '../../src/model/listedCodeReferences';
import { confirmAnalysisOpen, readAnalysisOpenSources, analysisOpenSatisfied,
  type AnalysisOpenPlan, type AnalysisOpenControl, type AnalysisOpenOutcome,
  type AnalysisSourceCandidate } from '../../src/model/analysisSourceOpen';
import { editorReducer, type EditorState } from '../../src/model/editorState';
import { isDirty, type StudioDocument } from '../../src/model/documents';
import { createLexicalFixture, changeLexicalInterface, shiftLexicalLocation,
  failLexicalLeaf, removeLexicalEntry } from './fixture';
import {ProjectIdentifierMigrationPanel} from '../../src/components/ProjectIdentifierMigrationPanel';
import {ProjectWhitespacePanel} from '../../src/components/ProjectWhitespacePanel';
import {ProjectSourceManifestPanel} from '../../src/components/ProjectSourceManifestPanel';
import {confirmProjectMigration,scanProjectMigration,prepareMigrationApply,createMigrationUndo,
  type ProjectMigrationReview,type ProjectMigrationPlan,type MigrationScanExecution,type MigrationOutcome} from '../../src/model/projectIdentifierMigration';
import type {MigrationRule} from '../../src/model/migrationRules';
import {confirmProjectWhitespace,scanProjectWhitespace,prepareWhitespaceApply,
  type ProjectWhitespaceReview,type ProjectWhitespacePlan,type WhitespaceScanExecution,type WhitespaceApplyOutcome} from '../../src/model/projectWhitespace';
import type {WhitespaceOptions} from '../../src/model/sourceWhitespace';
import {createReviewedStageUndo} from '../../src/model/reviewedSourceStage';
import {canUndoOpenFileReplace,type OpenFileReplaceUndo} from '../../src/model/openFileReplaceUndo';
import {executeSourceManifest,type ManifestExecution} from '../../src/model/projectSourceManifest';
import {createTransactionFixture,changeTransactionDisk,failTransactionCopy} from './fixture';
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
  const [lexicalActiveId, setLexicalActiveId] = useState<string | null>(null);
  const [migrationUndo,setMigrationUndo]=useState<OpenFileReplaceUndo|null>(null);
  const [whitespaceUndo,setWhitespaceUndo]=useState<OpenFileReplaceUndo|null>(null);
  const generation = useRef(0);
  const releaseRead = useRef<(() => void) | null>(null);
  const listed = useMemo(() => listedSources(workspace), [workspace]);
  const inventory = useMemo(() => buildProjectScopeInventory(listed), [listed]);

  const editor: EditorState = {
    documents: [...workspace.documents],
    activeId: lexicalActiveId ?? workspace.documents[0]?.id ?? null,
    nextUntitled: 1,
    sessionRevision: generation.current,
  };

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
    setMigrationUndo(null);setWhitespaceUndo(null);
    setLexicalActiveId(null);
    setSettings(initialSettings());
    setSearches(0);
    setReadPaths([]);
    setPaused(false);
    setSession(value => value + 1);
  }

  function switchLexical() {
    retire();
    setWorkspace(createLexicalFixture());
    setMigrationUndo(null);setWhitespaceUndo(null);
    setLexicalActiveId(null);
    setSettings(initialSettings());
    setSearches(0);
    setReadPaths([]);
    setPaused(false);
    setSession(value => value + 1);
  }

  function switchTransactions(){
    retire();
    setWorkspace(createTransactionFixture());
    setLexicalActiveId(null);
    setMigrationUndo(null);setWhitespaceUndo(null);
    setSettings(initialSettings());
    setSearches(0);setReadPaths([]);setPaused(false);
    setSession(value=>value+1);
  }

  /** Unlike unrelated search runs, an edit scan must not itself change
   * the editor generation. Only a workspace mutation or atomic commit
   * retires its exact source snapshot. */
  async function transactionRead<T>(control:InspectionControl,
    execute:(read:ReturnType<typeof createFixtureReader>['read'],current:()=>boolean)=>Promise<T>,
    invalidated:T):Promise<T>{
    if(busy)return invalidated;
    const id=generation.current;
    setBusy(true);setSearches(value=>value+1);
    let blocked=paused;
    const reader=createFixtureReader(workspace,async()=>{
      if(!blocked)return;
      blocked=false;
      await new Promise<void>(resolve=>{releaseRead.current=resolve;});
      releaseRead.current=null;
    });
    const current=()=>generation.current===id&&control.isCurrent();
    try{
      const result=await execute(reader.read,current);
      if(!current())return invalidated;
      setReadPaths(previous=>[...previous,...reader.paths()]);
      return result;
    }finally{if(generation.current===id)setBusy(false);}
  }

  function commitFixtureEditor(next:EditorState){
    generation.current=next.sessionRevision;
    setWorkspace(old=>({...old,documents:next.documents}));
    setLexicalActiveId(next.activeId);
  }

  async function scanMigration(review:ProjectMigrationReview,scope:ProjectSearchScope,
    rules:readonly MigrationRule[],control:InspectionControl):Promise<MigrationScanExecution>{
    const confirmed=confirmProjectMigration(review,listed,scope,false,rules);
    if(!confirmed.ok)return {kind:'failed',error:confirmed.error};
    return transactionRead<MigrationScanExecution>(control,(read,isCurrent)=>scanProjectMigration(confirmed.value,editor,read,{...control,isCurrent}),
      {kind:'invalidated'});
  }
  async function applyMigration(plan:ProjectMigrationPlan,control:InspectionControl):Promise<MigrationOutcome>{
    const fail={ok:false as const,error:'Migration cancelled or invalidated. Nothing changed.'};
    const result=await transactionRead<Awaited<ReturnType<typeof prepareMigrationApply>>>(control,(read,isCurrent)=>prepareMigrationApply(plan,listed,false,editor,read,
      {...control,isCurrent}),{kind:'invalidated'});
    if(result.kind==='failed')return {ok:false,error:result.error};
    if(result.kind!=='prepared'||control.isCancelled()||!control.isCurrent()||generation.current!==editor.sessionRevision)return fail;
    const next=editorReducer(editor,result.action);
    if(next===editor)return {ok:false,error:'Editor rejected migration.'};
    const undo=createMigrationUndo(result.changes,next);
    if(!undo)return {ok:false,error:'Could not prepare migration undo.'};
    commitFixtureEditor(next);setMigrationUndo(undo);
    return {ok:true,replacements:plan.replacements,files:result.changes.length,newTabs:plan.newTabs};
  }

  async function scanWhitespace(review:ProjectWhitespaceReview,scope:ProjectSearchScope,options:WhitespaceOptions,
    control:InspectionControl):Promise<WhitespaceScanExecution>{
    const confirmed=confirmProjectWhitespace(review,listed,scope,false,options);
    if(!confirmed.ok)return {kind:'failed',error:confirmed.error};
    return transactionRead<WhitespaceScanExecution>(control,(read,isCurrent)=>scanProjectWhitespace(confirmed.value,editor,read,{...control,isCurrent}),
      {kind:'invalidated'});
  }

  async function applyWhitespace(plan:ProjectWhitespacePlan,control:InspectionControl):Promise<WhitespaceApplyOutcome>{
    const fail={ok:false as const,error:'Whitespace operation cancelled or invalidated. Nothing changed.'};
    const result=await transactionRead<Awaited<ReturnType<typeof prepareWhitespaceApply>>>(control,(read,isCurrent)=>prepareWhitespaceApply(plan,listed,false,editor,read,
      {...control,isCurrent}),{kind:'invalidated'});
    if(result.kind==='failed')return {ok:false,error:result.error};
    if(result.kind!=='ready'||control.isCancelled()||!control.isCurrent()||generation.current!==editor.sessionRevision)return fail;
    const next=editorReducer(editor,result.value.action);
    if(next===editor)return {ok:false,error:'Editor rejected whitespace changes.'};
    const undo=createReviewedStageUndo(result.value.staged.changes,next);
    if(!undo)return {ok:false,error:'Could not prepare whitespace undo.'};
    commitFixtureEditor(next);setWhitespaceUndo(undo);
    return {ok:true,files:result.value.staged.changes.length,edits:result.value.edits,newTabs:result.value.staged.newTabs};
  }
  function undoTransaction(kind:'migration'|'whitespace'){
    const undo=kind==='migration'?migrationUndo:whitespaceUndo;
    if(busy||!undo||!canUndoOpenFileReplace(undo,editor))return;
    const next=editorReducer(editor,{type:'replace-open-files',changes:undo.changes,allSnapshots:undo.after});
    if(next===editor)return;
    commitFixtureEditor(next);
    if(kind==='migration')setMigrationUndo(null);else setWhitespaceUndo(null);
  }
  async function scanManifest(plan:ProjectInspectionPlan,settings:InspectionSettings,
    control:InspectionControl):Promise<ManifestExecution>{
    const confirmed=confirmProjectInspection(plan,listed,settings);
    if(!confirmed.ok)return {kind:'invalidated'};
    return transactionRead<ManifestExecution>(control,(read,isCurrent)=>executeSourceManifest(confirmed.value,editor.documents,read,
      {...control,isCurrent}),{kind:'invalidated'});
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

  /** Use the same synthetic read adapter and generation checks for all
   * reviewed analyses. A reset or workspace mutation retires in-flight work.
   */
  async function reviewedAnalysis<T extends InspectionExecution | VerificationExecution | ListedSymbolExecution | ListedReferenceExecution>(
    control: InspectionControl,
    execute: (read: ReturnType<typeof createFixtureReader>['read'], current: () => boolean) => Promise<T>,
  ): Promise<T | {kind:'invalidated'}> {
    if (busy) return {kind:'invalidated'};
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
    const current = () => generation.current === id && control.isCurrent();
    try {
      const result = await execute(reader.read, current);
      if (generation.current !== id) return {kind:'invalidated'};
      setReadPaths(previous => [...previous, ...reader.paths()]);
      return result;
    } finally {
      if (generation.current === id) setBusy(false);
    }
  }

  async function runInspection(plan: ProjectInspectionPlan, config: InspectionSettings,
    control: InspectionControl): Promise<InspectionExecution> {
    const checked = confirmProjectInspection(plan, listed, config);
    if (!checked.ok) return {kind:'invalidated'};
    return reviewedAnalysis(control, (read, isCurrent) =>
      executeProjectInspection(checked.value, workspace.documents, read, {...control,isCurrent}));
  }

  async function runVerification(plan: ProjectVerificationPlan, config: InspectionSettings,
    rules: readonly VerificationRule[], control: VerificationControl): Promise<VerificationExecution> {
    const checked = confirmProjectVerification(plan, listed, config, rules);
    if (!checked.ok) return {kind:'invalidated'};
    return reviewedAnalysis(control, (read, isCurrent) =>
      executeProjectVerification(checked.value, workspace.documents, read, {...control,isCurrent}));
  }

  async function runSymbols(plan: ProjectInspectionPlan, config: InspectionSettings,
    control: InspectionControl, captureInterfaces: boolean): Promise<ListedSymbolExecution> {
    const checked = confirmProjectInspection(plan, listed, config);
    if (!checked.ok) return {kind:'invalidated'};
    return reviewedAnalysis(control, (read, isCurrent) =>
      executeListedSymbolIndex(checked.value, workspace.documents, read,
        {...control,isCurrent},captureInterfaces));
  }

  async function runReferences(plan: ListedReferencePlan, config: InspectionSettings,
    query: ListedReferenceQuery, control: InspectionControl): Promise<ListedReferenceExecution> {
    const checked = confirmListedReferences(plan, listed, config, query);
    if (!checked.ok) return {kind:'invalidated'};
    return reviewedAnalysis(control, (read, isCurrent) =>
      executeListedReferences(checked.value, workspace.documents, read, {...control,isCurrent}));
  }

  // Native navigation is intentionally not mocked as a successful OS open.
  // The fixture rechecks a current snapshot and records the resulting coordinates.
  function documentForPath(path: string | null): StudioDocument | null {
    if (!path) return null;
    const open = workspace.documents.find(document => document.path === path);
    if (open) return open;
    const file = workspace.files.find(candidate => candidate.path === path);
    if (!file || workspace.unavailable.includes(file.name)) return null;
    return {id:'fixture-recheck:'+file.name,name:file.name,path,
      content:file.content,savedContent:file.content,revision:0};
  }

  function navigateSymbol(report: ListedSymbolReport, site: ListedSymbolSite) {
    const path = resolveListedSymbolPath(report,site,listed);
    const document = documentForPath(path);
    const target = document && path ? recheckListedSymbolSite(site,document,path) : null;
    setNavigation(target ? JSON.stringify({name:site.source,line:target.line,
      column:target.column,kind:'symbol'}) : '');
  }

  function navigateReference(report: ListedReferenceReport, hit: ListedReferenceSite) {
    const path = resolveListedReferencePath(report,hit,listed);
    const document = documentForPath(path);
    const target = document && path ? recheckListedReference(hit,document,path) : null;
    setNavigation(target ? JSON.stringify({name:hit.source,line:target.line,
      column:target.column,kind:'reference'}) : '');
  }

  async function openAnalysisSources(plan: AnalysisOpenPlan,
    candidates: readonly AnalysisSourceCandidate[], control: AnalysisOpenControl): Promise<AnalysisOpenOutcome> {
    if (busy) return {ok:false,error:'Fixture is busy.'};
    const checked = confirmAnalysisOpen(plan,candidates,listed,editor);
    if (!checked.ok) return checked;
    retire();
    const id = ++generation.current;
    setBusy(true);
    let blocked = paused;
    const reader = createFixtureReader(workspace, async () => {
      if (!blocked) return;
      blocked = false;
      await new Promise<void>(resolve => { releaseRead.current = resolve; });
      releaseRead.current = null;
    });
    const current = () => generation.current === id && control.isCurrent();
    try {
      const result = await readAnalysisOpenSources(checked.value,reader.read,{...control,isCurrent:current});
      if (!current()) return {ok:false,error:'Source listing or editor changed. No files opened.'};
      setReadPaths(previous=>[...previous,...reader.paths()]);
      if (result.kind !== 'prepared') return {ok:false,error:result.kind==='failed'?result.error:
        'Reviewed source open cancelled or invalidated. No files opened.'};
      const next = editorReducer(editor,{type:'restore-workspace-tabs',files:result.value.files,
        activePath:result.value.activePath});
      if (!analysisOpenSatisfied(checked.value,next))
        return {ok:false,error:'Editor rejected the reviewed source set.'};
      setWorkspace({...workspace,documents:next.documents});
      setLexicalActiveId(next.activeId);
      return {ok:true,opened:checked.value.newCount,reused:checked.value.existingCount};
    } finally {
      if(generation.current===id)setBusy(false);
    }
  }

  function openInspection(report: ProjectInspectionReport, label: string) {
    const resolved = resolveInspectionSource(report, label, listed);
    setNavigation(resolved ? JSON.stringify({name:label,source:'inspection'}) : '');
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
      <button onClick={switchLexical}>Use lexical fixture</button>
      <button onClick={switchTransactions}>Use transaction fixture</button>
      <button onClick={()=>{if(!busy)setWorkspace(changeTransactionDisk);}}>Change transaction disk externally</button>
      <button onClick={()=>{if(!busy)setWorkspace(failTransactionCopy);}}>Fail transaction copy read</button>
      <button onClick={()=>mutate(changeLexicalInterface)}>Change lexical function interface</button>
      <button onClick={()=>mutate(shiftLexicalLocation)}>Shift lexical source location</button>
      <button onClick={()=>mutate(failLexicalLeaf)}>Fail lexical leaf read</button>
      <button onClick={()=>mutate(removeLexicalEntry)}>Remove lexical entry</button>
      <button onClick={() => mutate(editBuffer)}>Edit fixture buffer</button>
      <button onClick={() => mutate(addFixtureTask)}>Add fixture task</button>
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
      <output data-testid="transaction-documents">{JSON.stringify(editor.documents.map(doc=>({name:listed.find(source=>source.path===doc.path)?.name??doc.name,
        content:doc.content,savedContent:doc.savedContent,dirty:isDirty(doc)})))}</output>
      <output data-testid="transaction-disk">{JSON.stringify(workspace.files.map(file=>({name:file.name,content:file.content})))}</output>
      <output data-testid="lexical-open-tabs">{JSON.stringify(editor.documents.map(document=>({
        name:document.path ? listed.find(source=>source.path===document.path)?.name??document.name : document.name,
        dirty:isDirty(document),
      })))}</output>
      <output data-testid="lexical-active-tab">{listed.find(source=>source.path===
        editor.documents.find(document=>document.id===editor.activeId)?.path)?.name??''}</output>
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
      <ProjectInspectionPanel listed={listed} listingLimited={false} available busy={busy}
        onRun={runInspection} onOpen={openInspection}/>
      <ProjectVerificationPanel listed={listed} listingLimited={false} available busy={busy} onRun={runVerification}/>
      <ListedSymbolPanel listed={listed} listingLimited={false} available busy={busy}
        onRun={runSymbols} onNavigate={navigateSymbol}
        sourceOpen={{editor,listed,onOpen:openAnalysisSources}}/>
      <ListedCodeReferencesPanel listed={listed} listingLimited={false} available busy={busy}
        cursorIdentifier={()=>'helper'} onRun={runReferences} onNavigate={navigateReference}
        sourceOpen={{editor,listed,onOpen:openAnalysisSources}}/>
      <ProjectIdentifierMigrationPanel listed={listed} listingLimited={false} available busy={busy} editor={editor}
        onScan={scanMigration} onApply={applyMigration} undoAvailable={!!migrationUndo&&canUndoOpenFileReplace(migrationUndo,editor)}
        onUndo={()=>undoTransaction('migration')}/>
      <ProjectWhitespacePanel listed={listed} listingLimited={false} available busy={busy} editor={editor}
        onScan={scanWhitespace} onApply={applyWhitespace} undoAvailable={!!whitespaceUndo&&canUndoOpenFileReplace(whitespaceUndo,editor)}
        onUndo={()=>undoTransaction('whitespace')}/>
      <ProjectSourceManifestPanel listed={listed} listingLimited={false} available busy={busy} onRun={scanManifest}/>
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
