import { ProjectSearchScopeControls, ProjectSearchCoverage } from './components/ProjectSearchScopeControls';
import { ProjectSearchComparisonPanel } from './components/ProjectSearchComparisonPanel';
import { ProjectSearchLedgerPanel } from './components/ProjectSearchLedgerPanel';
import { ProjectSearchPresetsPanel } from './components/ProjectSearchPresetsPanel';
import { ProjectMatchExplorer } from './components/ProjectMatchExplorer';
import { ProjectSearchSweepPanel } from './components/ProjectSearchSweepPanel';
import { confirmSearchSweep, executeSearchSweep, type SearchSweepPlan, type SweepControl, type SweepExecution } from './model/projectSearchSweep';
import { DEFAULT_PROJECT_SEARCH_SCOPE, buildProjectScopeInventory, planScopedProjectSearch, summarizeScopedSearch, type ProjectSearchScope, type ScopedSearchSummary } from './model/projectSearchScope';
import { CommandLibrarySettings } from './components/CommandLibrarySettings';
import { COMMAND_GROUPS,EMPTY_COMMAND_LIBRARY,commandGroup,collectionLabel,isCommandCollection,isLibraryCommand,searchCommandCollection,recordCommandSelection,togglePinnedCommand,movePinnedCommand,confirmLibraryClear,type CommandCollection,type LibraryClearReview } from './model/commandPaletteLibrary';
import { TestFixturesPanel } from './components/TestFixturesPanel';
import { fixtureProjectTarget,type FixtureStream,type FixtureCreatePlan,type FixtureResult,type FixtureInventory,type FixtureByteSummary } from './model/testFixtures';
import { scanTestFixtures,inspectTestFixture,createTestFixture,type FixtureCreationOutcome } from './services/testFixtures';
import { planProjectCommandDiskCheck,projectCommandDiskPlanCurrent,checkProjectCommandDisk,projectDiskCheckMessage,applyProjectDiskFreshness,type ProjectDiskCheckEvidence } from './model/projectCommandDiskGuard';
import { ProjectCommandDiskEvidence } from './components/ProjectCommandDiskEvidence';
import { userSnippetStore } from './model/userSnippets';
import { buildSnippetPaletteEntries, planSnippetInsertion, isSnippetPaletteEntry } from './model/snippetInsertion';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Editor from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { ask, open } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  fileName, isDirty, sameFilePath, type StudioDocument,
} from './model/documents';
import { canApplyReplacementSnapshots, currentActiveDocument, editorReducer, initialEditorState, isUnchangedSnapshot, sameOpenDocumentSnapshots, hasUnchangedEditorSession, type EditorAction } from './model/editorState';
import { pickSourcePath, saveAllModifiedSources, writeSourceFile } from './services/files';
import { decidePickedSourceOpen } from './model/pickedSourceOpen';
import { readScarpSource } from './services/sourceRead';
import { chooseSourceFolder, readFolderSource, scanSourceFolder, type ScarpProjectRoot } from './services/folders';
import { disambiguateDocumentNames } from './model/documentLabels';
import { saveChangesWorkspaceListing } from './model/workspaceSaveRefresh';
import { preferredProjectDirectory, retainedProjectDirectory, projectTargetForListedSource, selectedManifestPath } from './model/projectTargets';
import { buildQuickOpenEntries, type QuickOpenEntry } from './model/projectQuickOpen';
import { isCurrentListedSourceRead, resolveListedProjectOpen } from './model/listedProjectOpen';
import {
  DEFAULT_EDITOR_PREFERENCES, editorDisplayOptions,
  parseEditorPreferences, type EditorPreferences,
} from './model/editorPreferences';
import {
  boundedNavigationQuery, clampLineLocation, cycleTabId, filterNavigationEntries,
  keyboardTabTarget, MAX_NAVIGATION_QUERY_UNITS, parseLineLocation,
  clampPaletteIndex, stepPaletteIndex,
  type NavigationEntry,
} from './model/navigation';
import { scanScarpOutlineSymbols, type ScarpOutlineSymbol } from './language/assist';
import { buildDeclarationEntries, isCurrentDeclarationEntry, type DeclarationEntry } from './model/declarationNavigation';
import { NativeDialogGate } from './model/dialogGate';
import { getScarpStarterTemplate, scarpStarterTemplates } from './model/starterTemplates';
import { runnableSource, compilerActionBlock, compilerActionHint } from './model/compilerReadiness';
import {
  MAX_INPUT_BYTES, programInputBytes, programInputValidationError, validateProgramInput,
} from './model/programInput';
import { exitBlockReason, sameExitEditorState } from './model/exitGuards';
import { detectScarp, executeScarp, openCompilerDownloads, probeScarp, stopScarp, type ScarpMode } from './services/compiler';
import { parseScarpDiagnostic } from './model/diagnostics';
import { verifiedProblemMarker } from './model/problemMarkers';
import { collectProblems, currentDiagnosticTarget, sameDiagnosticTarget, type StudioProblem, type ProblemTarget } from './model/problems';
import { ProblemsPanel } from './components/ProblemsPanel';
import { ProjectExplorer } from './components/ProjectExplorer';
import { DiskReconciliationPanel } from './components/DiskReconciliationPanel';
import { recheckDiskReconciliation,type DiskReconciliationPlan,type ReconciliationResult } from './model/diskReconciliation';
import { WorkspaceDiskReviewPanel } from './components/WorkspaceDiskReviewPanel';
import { diskOperationCurrent, inspectWorkspaceDisk, prepareWorkspaceDiskReload, type WorkspaceDiskReview, type WorkspaceDiskResult } from './model/workspaceDiskReview';
import { OpenEditorManager } from './components/OpenEditorManager';
import { resolveBulkClose, type TabSelection } from './model/openEditorManagement';
import { ProjectDependencyAuditPanel } from './components/ProjectDependencyAuditPanel';
import { auditListedProjectDependencies,resolveAuditFile,type AuditMode,type AuditResult,type ProjectDependencyAudit } from './model/projectDependencyAudit';
import { ProjectScaffoldPanel } from './components/ProjectScaffoldPanel';
import { summarizeScaffoldResult, type ProjectScaffoldPlan, type ScaffoldCompletion } from './model/projectScaffold';
import { createProjectScaffold } from './services/projectScaffold';
import { WorkspaceCreatePanel } from './components/WorkspaceCreatePanel';
import { workspaceCreationTargets, type WorkspaceCreateRequest } from './model/workspaceCreate';
import { createWorkspaceItem } from './services/workspaceCreate';
import { SourceInsightsPanel, type InsightNavigation } from './components/SourceInsightsPanel';
import { SourceQualityPanel } from './components/SourceQualityPanel';
import { SelectionEditPanel } from './components/SelectionEditPanel';
import { captureSelections, selectionMatchesLive, selectionEditIsCurrent, type SelectionEditPlan, type SelectionCapture, type SelectionResult } from './model/selectionEdit';
import { LineRangeToolsPanel } from './components/LineRangeToolsPanel';
import { IdentifierEditPanel } from './components/IdentifierEditPanel';
import { OpenBufferComparisonPanel } from './components/OpenBufferComparisonPanel';
import { ExplorerToolDirectory, ExplorerToolSlot } from './components/ExplorerToolDirectory';
import { bufferTransferIsCurrent, type BufferTransferPlan } from './model/openBufferComparison';
import { identifierPlanIsCurrent, type IdentifierEditPlan } from './model/identifierEdit';
import { lineRangePlanIsCurrent, type LineRangePlan } from './model/lineRangeTools';
import { WorkspaceSymbolsPanel } from './components/WorkspaceSymbolsPanel';
import { SourceCheckpointsPanel } from './components/SourceCheckpointsPanel';
import { OutputInspectionPanel } from './components/OutputInspectionPanel';
import { CompilerActivityPanel } from './components/CompilerActivityPanel';
import { NavigationTrailPanel } from './components/NavigationTrailPanel';
import { captureTrailLocation, createNavigationTrailStore, type TrailMove, type TrailReason } from './model/navigationTrail';
import { ProgramInputPresetsPanel } from './components/ProgramInputPresetsPanel';
import { createProgramInputPresetStore, inputPresetApplyIsCurrent, inputPresetUndoIsCurrent, type ProgramInputSnapshot, type InputPresetCaptureReview, type InputPresetApplyReview, type InputPresetRemovalReview, type InputPresetUndo } from './model/programInputPresets';
import { createCompilerActivityStore, type ActivityToken } from './model/compilerActivity';
import { createSourceCheckpointStore, checkpointRestoreIsCurrent, type CheckpointCaptureReview, type CheckpointRestoreReview, type CheckpointRemovalReview } from './model/sourceCheckpoints';
import { qualityPlanIsCurrent, type QualityCleanupPlan } from './model/sourceQuality';
import { WorkingChangesPanel } from './components/WorkingChangesPanel';
import { SourceImportsPanel } from './components/SourceImportsPanel';
import { SourceBookmarksPanel } from './components/SourceBookmarksPanel';
import { WorkspaceInsightsPanel } from './components/WorkspaceInsightsPanel';
import { CodeReferencesPanel } from './components/CodeReferencesPanel';
import { WorkspaceTaskBoard } from './components/WorkspaceTaskBoard';
import { DraftRecoveryPanel } from './components/DraftRecoveryPanel';
import { StudioSettingsPanel } from './components/StudioSettingsPanel';
import { IntelliSenseSettings } from './components/IntelliSenseSettings';
import { StudioShortcutSettings } from './components/StudioShortcutSettings';
import { studioShortcutStore, matchStudioShortcut, shortcutLabel, studioCommandDetail, type ShortcutCommand } from './model/studioShortcuts';
import { StudioPreferenceTransferPanel } from './components/StudioPreferenceTransferPanel';
import { DEFAULT_APPEARANCE, loadAppearance, persistAppearance, resolveAppearance, subscribeSystemAppearance, readSystemAppearance, reducedMotionEditorOptions, type AppearancePreferences } from './model/studioAppearance';
import { createPreferenceHistory } from './model/preferenceHistory';
import { captureStudioPreferences, sameStudioPreferences } from './model/studioPreferenceTransfer';
import { inspectIntelliSenseDocument } from './language/intelliSenseDiagnostics';
import { intelliSenseStore, intelliSenseEditorOptions } from './model/intelliSensePreferences';
import { CompilerSetupPanel } from './components/CompilerSetupPanel';
import { loadCompilerPreferences, persistCompilerPreferences, DEFAULT_COMPILER_PREFERENCES } from './model/compilerPreferences';
import { WorkspaceSessionPanel } from './components/WorkspaceSessionPanel';
import { RecentlyClosedPanel } from './components/RecentlyClosedPanel';
import { emptyRecentlyClosed, reconcileRecentlyClosed, resolveRecentlyClosed,
  forgetRecentlyClosed, clearRecentlyClosed, type RecentlyClosedSource,
  type RecentlyClosedState } from './model/recentlyClosed';
import { WorkspaceSessionStore } from './model/workspaceSessionStore';
import { captureWorkspaceSession, sameWorkspaceCapture, type CapturedWorkspaceSession,
  type WorkspaceSession, type WorkspaceRestorePlan } from './model/workspaceSessions';
import { assertRecentlyClosedReadCurrent, prepareRecentlyClosedRead } from './services/recentlyClosedRead';
import { prepareWorkspaceRestore } from './services/workspaceRestore';
import { DraftRecoveryJournal, type RecoveryView } from './model/draftRecoveryJournal';
import type { RecoveryCheckpoint } from './model/draftRecovery';
import {
  createSourceBookmark, resolveSourceBookmarks, bookmarkTargetForCurrentSource,
  removeSourceBookmark, type SourceBookmark,
} from './model/sourceBookmarks';
import {
  captureVerifiedSource, isCurrentVerifiedSource, retainVerifiedSourceSnapshot,
  type VerifiedSourceSnapshot,
} from './model/verifiedSource';
import { scarpProjectAction, type ScarpProjectAction } from './services/project';
import { parseScarpTestReportForAction, type ScarpTestReport } from './model/projectTestReport';
import { resolveListedTestSource, isSelectedProjectTestReport } from './model/projectTestNavigation';
import { DiagnosticReportPanel } from './components/DiagnosticReportPanel';
import { parseDiagnosticReport, type DiagnosticReport } from './model/diagnosticReport';
import { ProjectInfoPanel } from './components/ProjectInfoPanel';
import { parseProjectInfo, projectInfoEntry, type ProjectInfoSnapshot } from './model/projectInfo';
import { CompilerNavigationComparison } from './components/CompilerNavigationComparison';
import type { NavigationBaseline,NavigationSnapshot } from './model/compilerNavigationComparison';
import { CompilerNavigationPanel } from './components/CompilerNavigationPanel';
import { parseCompilerNavigation, type CompilerNavigationReport } from './model/compilerNavigation';
import { ProjectTestSelectionPanel } from './components/ProjectTestSelectionPanel';
import { ProjectTestWorkbench } from './components/ProjectTestWorkbench';
import type { TestBaseline } from './model/projectTestWorkbench';
import {
  dirtyProjectSourceNames, projectActionRequiresSavedSources,
  projectSourceBuffersChanged,
} from './model/projectSourceState';
import {
  completedProjectOutputWarning, completedRunInputWarning,
  completedSourceOutputWarning, isCurrentRunInputGeneration,
  projectResultFreshness, sourceResultIsStale, type CompletedProjectOutput,
} from './model/resultFreshness';
import { isCurrentSingleSaveRequest } from './model/saveSnapshotGuard';
import { AutoSaveScheduler } from './model/autoSaveScheduler';
import { AutoSaveReviewGate } from './model/autoSaveReviewGate';
import {
  inspectDiskSnapshot, isCurrentDiskReview, isCurrentDiskReviewOperation,
  type DiskReview,
} from './model/diskReview';
import { restoreStudioDefaults } from './model/studioDefaults';
import { CompilerDiscoveryRequests } from './model/compilerDiscoveryRequests';
import {
  loadAutoSavePreferences, persistAutoSavePreferences, DEFAULT_AUTO_SAVE,
} from './model/autoSaveSettings';

import {
  isCurrentSearchHit, searchOpenFiles, type OpenFileSearchHit,
} from './model/openFileSearch';
import { planOpenFileReplacement, type OpenFileReplacePlan } from './model/openFileReplace';
import {
  editorChangeInvalidatesProjectSearch, searchListedProjectSources,
  type ProjectSearchHit, type ProjectSearchResult,
} from './model/projectSearch';
import { ProjectReplacementPanel } from './components/ProjectReplacementPanel';
import { prepareProjectReplacement,readProjectReplacementSources,projectReplacementInventoryIsCurrent,
  planStagedProjectReplacement,stagedProjectReplacementIsCurrent,type ReplacementRequest,
  type ReplacementResult,type ProjectReplacementPlan } from './model/projectReplacement';
import { canUndoOpenFileReplace, createOpenFileReplaceUndo, type OpenFileReplaceUndo } from './model/openFileReplaceUndo';

import { nextOutputPanelMode, revealOutputPanel, type OutputPanelMode } from './model/outputPanelLayout';
import { DEFAULT_WORKSPACE_LAYOUT, parseWorkspaceLayout, clampLayoutSize, type LayoutDimension } from './model/workspaceLayout';
import { WorkspaceSplitter } from './components/WorkspaceSplitter';
import { effectiveWorkspaceVisibility } from './model/workspaceFocus';


type FolderEntry = { name: string; path: string };
type PaletteMode = 'files' | 'commands' | 'line' | 'symbols';

/** Actions are deliberately limited to the Scarp-only editor. */
const studioCommands: readonly NavigationEntry[] = [
  { id: 'new', label: 'New Scarp File', detail: 'Ctrl+N' },
  { id: 'open', label: 'Open Scarp File', detail: 'Ctrl+O' },
  { id: 'folder', label: 'Choose Scarp Folder', detail: 'Explorer' },
  { id: 'refresh-folder', label: 'Refresh Scarp Project Explorer', detail: 'Re-scan selected folder' },
  { id: 'save', label: 'Save Current File', detail: 'Ctrl+S' },
  { id: 'save-all', label: 'Save All Modified Scarp Files', detail: 'Ctrl+Alt+S' },
  { id: 'save-as', label: 'Save Current File As', detail: 'Ctrl+Shift+S' },
  { id: 'reload', label: 'Reload Current Scarp File from Disk', detail: 'Confirms before discarding unsaved edits' },
  { id: 'compare-disk', label: 'Compare Current Scarp File with Disk', detail: 'Read-only preview before Reload or Save As' },
  { id: 'close', label: 'Close Current Tab', detail: 'Ctrl+W' },
  { id: 'reopen-closed', label: 'Reopen Last Closed Saved Source', detail: 'Ctrl+Shift+T' },
  { id: 'find-open-files', label: 'Find in Open Scarp Files', detail: 'Ctrl+Shift+F' },
  { id: 'find-project', label: 'Find in Selected Scarp Project', detail: 'Read-only and bounded' },
  { id: 'replace-open-files', label: 'Find and Replace in Open Scarp Files', detail: 'Preview and confirm; editor buffers only' },
  { id: 'undo-replace-open-files', label: 'Undo Last Replace All in Open Scarp Files', detail: 'Only if every buffer is unchanged' },
  { id: 'quick-open', label: 'Quick Open Tabs and Project Sources', detail: 'Ctrl+P' },
  { id: 'go-to-line', label: 'Go to Line and Column', detail: 'Ctrl+G' },
  { id: 'go-to-symbol', label: 'Go to Scarp Declaration in Current File', detail: 'Ctrl+Shift+O' },
  { id: 'next-tab', label: 'Next Open Tab', detail: 'Ctrl+Tab' },
  { id: 'previous-tab', label: 'Previous Open Tab', detail: 'Ctrl+Shift+Tab' },
  { id: 'theme', label: 'Toggle Dark / Light Theme', detail: 'Appearance' },
  { id: 'settings', label: 'Open Studio Settings', detail: 'Ctrl+,' },
  { id: 'explorer', label: 'Show / Hide Scarp Explorer', detail: 'Ctrl+B' },
  { id: 'select-compiler', label: 'Select Trusted Scarp Compiler', detail: 'Run / Verify' },
  { id: 'scan-compiler', label: 'Scan for Installed Scarp Compiler', detail: 'Non-executing discovery' },
  { id: 'download-compiler', label: 'Download Official Scarp Compiler', detail: 'Latest official compiler download' },
  { id: 'run-scarp', label: 'Run Current Scarp Source', detail: 'F5 · saved .srp only' },
  { id: 'verify-scarp', label: 'Verify Current Scarp Source', detail: 'Ctrl+F5 · static analysis' },
  { id: 'stop-scarp', label: 'Stop Running Scarp Program', detail: 'Shift+F5' },
  { id: 'toggle-output', label: 'Toggle Scarp Output Panel', detail: 'Ctrl+J' },
  { id: 'expand-output', label: 'Expand Scarp Output Panel', detail: 'More room for diagnostics' },
  { id: 'toggle-focus', label: 'Toggle Focus Mode', detail: 'Ctrl+Alt+Z' },
  { id: 'show-problems', label: 'Show Current Problems', detail: 'Ctrl+Shift+M' },
  { id: 'compiler-controls', label: 'Show Compiler Setup and Program Input', detail: 'Output panel controls' },
  ...scarpStarterTemplates.map((starter) => ({
    id: 'template:' + starter.id,
    label: 'Template: ' + starter.title,
    detail: starter.description,
  })),
];


function getInitialEditorPreferences(): EditorPreferences {
  try {
    return parseEditorPreferences(localStorage.getItem('studio.editorPreferences'));
  } catch {
    return { ...DEFAULT_EDITOR_PREFERENCES };
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createDraftRecoveryJournal(): DraftRecoveryJournal {
  try {
    // Browser previews must never persist source contents.
    return new DraftRecoveryJournal(isTauri() ? localStorage : null);
  } catch {
    return new DraftRecoveryJournal(null);
  }
}

function createWorkspaceSessionStore(): WorkspaceSessionStore {
  try {
    return new WorkspaceSessionStore(isTauri() ? localStorage : null);
  } catch {
    return new WorkspaceSessionStore(null);
  }
}

function sameRecoveryView(left: RecoveryView, right: RecoveryView): boolean {
  return left.available === right.available && left.enabled === right.enabled &&
    left.blocked === right.blocked && left.paused === right.paused &&
    left.previous === right.previous && left.checkpointTime === right.checkpointTime &&
    left.checkpointCount === right.checkpointCount && left.error === right.error;
}

export default function App() {
  const [editorState, setEditorState] = useState(initialEditorState);
  // Apply actions synchronously to the live state so native close requests and
  // file operations observe new edits before React renders the next frame.
  const liveEditor = useRef(editorState);
  const [recentlyClosed, setRecentlyClosed] = useState(emptyRecentlyClosed);
  const recentlyClosedRef = useRef(recentlyClosed);
  const [draftRecovery] = useState(createDraftRecoveryJournal);
  const [workspaceSessions] = useState(createWorkspaceSessionStore);
  const [sourceCheckpoints] = useState(createSourceCheckpointStore);
  const [compilerActivity] = useState(createCompilerActivityStore);
  const [navigationTrail] = useState(createNavigationTrailStore);
  const currentActivityToken = useRef<ActivityToken | null>(null);
  const [workspaceSessionView, setWorkspaceSessionView] = useState(() => workspaceSessions.view());
  const [recoveryView, setRecoveryView] = useState(() => draftRecovery.view());
  const lastRecoveryAttempt = useRef<readonly StudioDocument[] | null>(null);
  // Advances whenever a selected-project source changes or its Explorer is
  // successfully replaced. In-flight test reports must match this generation.
  const projectResultEpoch = useRef(0);
  const [projectDiskEvidence,setProjectDiskEvidence]=useState<ProjectDiskCheckEvidence|null>(null);
  const projectPreflight=useRef<{cancelled:boolean}|null>(null);
  const { documents, activeId } = editorState;
  // Completed searches survive safe navigation but never selected-project
  // source mutations, listing replacement or changed search options.
  const projectSearchEpoch = useRef(0);
  const [projectSearchScope,setProjectSearchScope]=useState<ProjectSearchScope>(DEFAULT_PROJECT_SEARCH_SCOPE);
  const [projectSearchResult, setProjectSearchResult] = useState<{
    selection: { path: string; files: FolderEntry[] };
    query: string;
    result: ProjectSearchResult;
    coverage: ScopedSearchSummary;
  } | null>(null);
  function invalidateProjectSearch(): void {
    projectSearchEpoch.current++;
    setProjectSearchResult(null);
  }
  function dispatch(action: EditorAction): void {
    const before = liveEditor.current;
    const next = editorReducer(before, action);
    if (next === before) return;
    const project = selectedFolderRef.current?.path ?? null;
    // Clicking a project-search hit opens/activates a source. Preserve the
    // result list through navigation, but immediately retire it after a
    // selected-project source edit/save/close (including ABA generations).
    // An in-flight search separately checks sessionRevision after each read.
    if (editorChangeInvalidatesProjectSearch(before.documents, next.documents, project)) {
      invalidateProjectSearch();
    }
    setDiskReview(null);
    if (project && projectSourceBuffersChanged(before.documents, next.documents, project)) {
      projectResultEpoch.current++;
      setProjectTestResult(null);
      setCompilerNavigation(null);
      setProjectInfo(null);
      setProjectDiagnosticReport(null);
    }
    // Keep a valid previous Verify result through tab switches and unrelated
    // edits, but invalidate it on any change to the actual verified source.
    // Monotonic revisions prevent stale markers returning after A→B→A edits.
    setCompilerOutputSource((previous) =>
      retainVerifiedSourceSnapshot(previous, next.documents));
    liveEditor.current = next;
    sourceCheckpoints.reconcile(next.documents);
    setEditorState(next);
    if (before.documents.length !== next.documents.length || action.type === 'saved') {
      publishRecentlyClosed(reconcileRecentlyClosed(recentlyClosedRef.current,
        before.documents, next.documents, before.activeId));
    }
    // A successful Save or an explicitly confirmed discard must retire its
    // checkpoint immediately, rather than waiting for the next typing delay.
    if (action.type === 'saved' || action.type === 'reload' || action.type === 'reload-clean-files' || action.type === 'reconcile-disk-source' || action.type === 'close') {
      flushDraftRecovery(true);
    }
  }
  const [appearance, setAppearance] = useState(loadAppearance);
  const [systemAppearance, setSystemAppearance] = useState(readSystemAppearance);
  useEffect(() => subscribeSystemAppearance(setSystemAppearance), []);
  const resolvedAppearance = resolveAppearance(appearance, systemAppearance);
  const theme = resolvedAppearance.theme;
  function toggleTheme() { setAppearance(current => ({ ...current, theme: theme === 'dark' ? 'light' : 'dark' })); }
  const [editorPreferences, setEditorPreferences] = useState(getInitialEditorPreferences);
  const userSnippets = useSyncExternalStore(userSnippetStore.subscribe, userSnippetStore.getSnapshot, userSnippetStore.getSnapshot);
  const shortcuts = useSyncExternalStore(studioShortcutStore.subscribe, studioShortcutStore.getSnapshot, studioShortcutStore.getSnapshot);
  const shortcut = (id: ShortcutCommand) => shortcutLabel(shortcuts.bindings[id]);
  const intelligence = useSyncExternalStore(intelliSenseStore.subscribe,
    intelliSenseStore.getSnapshot, intelliSenseStore.getSnapshot);
  const [autoSavePreferences, setAutoSavePreferences] = useState(loadAutoSavePreferences);
  const autoSaveEnabledRef = useRef(autoSavePreferences.enabled);
  autoSaveEnabledRef.current = autoSavePreferences.enabled;
  const autoSaveReview = useRef(new AutoSaveReviewGate());
  const autoSaveScheduler = useRef<AutoSaveScheduler | null>(null);
  const autoSaveAction = useRef<(document: StudioDocument) => boolean | void>(() => true);
  const [editorSettingsOpen, setEditorSettingsOpen] = useState(() =>
    recoveryView.previous !== null || recoveryView.blocked);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>([]);
  const [folderDirectories, setFolderDirectories] = useState<string[]>([]);
  const [projectRoots, setProjectRoots] = useState<ScarpProjectRoot[]>([]);
  const [projectDirectory, setProjectDirectory] = useState<string | null>(null);
  // Preserve exact folder-listing identity across asynchronous source reads.
  const selectedFolderRef = useRef<{ path: string; files: FolderEntry[]; projectRoots: ScarpProjectRoot[] } | null>(null);
  const [folderListingLimited, setFolderListingLimited] = useState(false);
  const [unavailableProjectFolders, setUnavailableProjectFolders] = useState<string[]>([]);
  const [preferredExplorerVisible, setExplorerVisible] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [workspaceLayout, setWorkspaceLayout] = useState(() => {
    try { return parseWorkspaceLayout(localStorage.getItem('studio.workspaceLayout')); }
    catch { return { ...DEFAULT_WORKSPACE_LAYOUT }; }
  });
  const portablePreferences = useMemo(() => captureStudioPreferences(appearance.theme, editorPreferences, intelligence.preferences,
    workspaceLayout, autoSavePreferences.delay, appearance.contrast, appearance.motion), [appearance, editorPreferences, intelligence.preferences, workspaceLayout, autoSavePreferences.delay]);
  const [preferenceHistory] = useState(() => createPreferenceHistory(portablePreferences));
  useEffect(() => { preferenceHistory.record(portablePreferences, Date.now()); }, [portablePreferences, preferenceHistory]);
  const studioMainElement = useRef<HTMLDivElement | null>(null);
  const editorOutputRegion = useRef<HTMLDivElement | null>(null);
  const [workspaceDimensions, setWorkspaceDimensions] = useState({ width: 1200, height: 700 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Scarp Studio • editor foundation');
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [diskReview, setDiskReview] = useState<{
    snapshot: StudioDocument;
    report: DiskReview;
    diskContent: string|null;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [replacePreview, setReplacePreview] = useState<OpenFileReplacePlan | null>(null);
  const [diskReconciliationUndo,setDiskReconciliationUndo]=useState<OpenFileReplaceUndo|null>(null);
  const [projectReplacementUndo, setProjectReplacementUndo] = useState<OpenFileReplaceUndo | null>(null);
  const [replaceUndo, setReplaceUndo] = useState<OpenFileReplaceUndo | null>(null);
  const [qualityUndo, setQualityUndo] = useState<OpenFileReplaceUndo | null>(null);
  const [selectionEditUndo, setSelectionEditUndo] = useState<OpenFileReplaceUndo | null>(null);
  const [lineRangeUndo, setLineRangeUndo] = useState<OpenFileReplaceUndo | null>(null);
  const [identifierUndo, setIdentifierUndo] = useState<OpenFileReplaceUndo | null>(null);
  const [bufferTransferUndo, setBufferTransferUndo] = useState<OpenFileReplaceUndo | null>(null);
  const [checkpointUndo, setCheckpointUndo] = useState<OpenFileReplaceUndo | null>(null);
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchWholeWord, setSearchWholeWord] = useState(false);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const mountedEditor = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const mountedMonaco = useRef<typeof import('monaco-editor') | null>(null);
  const mountedEditorDocumentId = useRef<string | null>(null);
  const pendingSearchLocation = useRef<OpenFileSearchHit | null>(null);
  const saveInProgress = useRef(false);
  // Shared guard for native Open File / Choose Folder dialogs. Save As has
  // its own saveInProgress gate; confirmations use NativeDialogGate.
  const filePickerInProgress = useRef(false);
  // Prevent overlapping native discard prompts on repeated close attempts.
  const nativeDialogGate = useRef(new NativeDialogGate());
  const commandInProgress = useRef(false);
  const selectionInProgress = useRef(false);
  const [compilerPreferences, setCompilerPreferences] = useState(loadCompilerPreferences);
  const startupDiscovery = useRef(compilerPreferences.scanOnStartup);
  const [compilerSelecting, setCompilerSelecting] = useState(false);
  const [compilerScanning, setCompilerScanning] = useState(false);
  const [detectedCompilers, setDetectedCompilers] = useState<string[]>([]);
  const [preferredDetectedCompiler, setPreferredDetectedCompiler] = useState<string | null>(null);
  const compilerDiscoveryRequests = useRef(new CompilerDiscoveryRequests());
  const automaticCompiler = preferredDetectedCompiler && detectedCompilers.includes(preferredDetectedCompiler)
    ? preferredDetectedCompiler : detectedCompilers[0] ?? null;
  // Never silently trust a stored compiler path across sessions: an executable
  // may be replaced after the user previously approved it.
  const [compilerPath, setCompilerPath] = useState<string | null>(null);
  const [compilerInfo, setCompilerInfo] = useState<string | null>(null);
  const [compilerOutput, setCompilerOutput] = useState(
    'Select a trusted official Scarp executable to enable Run and Verify.\n' +
    'Source files are never executed automatically.',
  );
  // Keep successful CLI output tied to its original source/listing generation.
  // Later edits or project switches must display an explicit stale warning.
  const [completedProjectOutput, setCompletedProjectOutput] =
    useState<CompletedProjectOutput | null>(null);
  // Keep raw Run/Verify output associated with its source even after error
  // navigation is invalidated by edits to that source.
  const [completedSourceOutput, setCompletedSourceOutput] =
    useState<VerifiedSourceSnapshot | null>(null);
  // No input text is retained after Run: only the session-local change
  // generation is needed to label old results if inputs are edited later.
  const [completedRunInputGeneration, setCompletedRunInputGeneration] =
    useState<number | null>(null);
  const [compilerBusy, setCompilerBusy] = useState(false);
  const [preferredOutputMode, setOutputPanelMode] = useState<OutputPanelMode>('normal');
  const { explorerVisible, outputPanelMode } = effectiveWorkspaceVisibility({ explorerVisible: preferredExplorerVisible, outputPanelMode: preferredOutputMode }, focusMode);
  const [compilerControlsOpen, setCompilerControlsOpen] = useState(true);
  const [resultsView, setResultsView] = useState<'output' | 'problems' | 'history' | 'inspection'>('output');
  const pendingProblem = useRef<Extract<ProblemTarget, { kind: 'source' }> | null>(null);
  const problemsTab = useRef<HTMLButtonElement | null>(null);
  const focusProblemsTab = useRef(false);
  const outputToggle = useRef<HTMLButtonElement | null>(null);
  const [projectTestResult, setProjectTestResult] = useState<{folder: string; report: ScarpTestReport} | null>(null);
  const [projectDiagnosticReport, setProjectDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfoSnapshot | null>(null);
  const [projectInfoBaseline, setProjectInfoBaseline] = useState<ProjectInfoSnapshot | null>(null);
  const [compilerNavigation, setCompilerNavigation] = useState<CompilerNavigationReport | null>(null);
  const [navigationBaseline,setNavigationBaseline]=useState<NavigationBaseline|null>(null);
  const [testBaseline, setTestBaseline] = useState<TestBaseline | null>(null);
  const [compilerDiagnosticStderr, setCompilerDiagnosticStderr] = useState<string | null>(null);
  const [compilerOutputSource, setCompilerOutputSource] = useState<VerifiedSourceSnapshot | null>(null);
  // This input is session-local, not persisted or stored in source files.
  const [stdinText, setStdinText] = useState('');
  const [promptInputMode, setPromptInputMode] = useState(false);
  // Increment synchronously in input handlers; an async first-Run trust
  // dialog must never launch a CLI with an older preloaded input snapshot.
  const inputRevision = useRef(0);
  const [inputPresets] = useState(createProgramInputPresetStore);
  const liveProgramInput = useRef<ProgramInputSnapshot>({ text: '', interactive: false, revision: 0 });
  function changeProgramInput(text: string, interactive: boolean): ProgramInputSnapshot {
    const before = liveProgramInput.current;
    if (before.text === text && before.interactive === interactive) return before;
    const next = { text, interactive, revision: ++inputRevision.current };
    liveProgramInput.current = next;
    setStdinText(text);
    setPromptInputMode(interactive);
    return next;
  }
  function captureProgramInputPreset(review: InputPresetCaptureReview): number | null {
    if (recoveryOperationsBlocked()) return null;
    const result = inputPresets.capture(review, liveProgramInput.current);
    return result.ok ? result.value.id : null;
  }
  function applyProgramInputPreset(review: InputPresetApplyReview): ProgramInputSnapshot | null {
    if (recoveryOperationsBlocked() || !inputPresetApplyIsCurrent(review, inputPresets.getSnapshot(), liveProgramInput.current)) return null;
    return changeProgramInput(review.targetText, review.targetInteractive);
  }
  function removeProgramInputPresets(review: InputPresetRemovalReview): boolean {
    return !recoveryOperationsBlocked() && inputPresets.remove(review);
  }
  function undoProgramInputPreset(undo: InputPresetUndo): boolean {
    if (recoveryOperationsBlocked() || !inputPresetUndoIsCurrent(undo, liveProgramInput.current)) return false;
    changeProgramInput(undo.before.text, undo.before.interactive);
    return true;
  }
  const [commandLibrary,setCommandLibrary]=useState(EMPTY_COMMAND_LIBRARY);
  const [commandCollection,setCommandCollection]=useState<CommandCollection>('all');
  const [paletteMode, setPaletteMode] = useState<PaletteMode | null>(null);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteInput = useRef<HTMLInputElement | null>(null);
  const paletteDismiss = useRef<HTMLButtonElement | null>(null);
  const paletteSelectedResult = useRef<HTMLButtonElement | null>(null);
  const activeTabElement = useRef<HTMLDivElement | null>(null);
  const paletteReturnFocus = useRef<HTMLElement | null>(null);
  const paletteRestoreOnClose = useRef(false);
  const editorHandle = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const active = documents.find((document) => document.id === activeId) || null;
  // Session-scoped only. Bookmarks never persist arbitrary source excerpts to
  // localStorage or leave the native Scarp editor.
  const [bookmarks, setBookmarks] = useState<SourceBookmark[]>([]);
  const bookmarkSequence = useRef(0);
  const pendingInsightJump = useRef<InsightNavigation | null>(null);
  const documentLabels = useMemo(() => disambiguateDocumentNames(documents), [documents]);
  const stdinValidationError = useMemo(
    () => programInputValidationError(stdinText), [stdinText],
  );
  const actionState = {
    native: isTauri(), busy: busy || compilerBusy || compilerSelecting || compilerScanning,
    source: active, inputError: stdinValidationError,
  };
  const runBlock = compilerActionBlock(actionState, 'exec');
  const verifyBlock = compilerActionBlock(actionState, 'verify');
  const runHint = compilerActionHint(runBlock, stdinValidationError);
  const verifyHint = compilerActionHint(verifyBlock, stdinValidationError);
  function updateWorkspaceDimension(dimension: LayoutDimension, size: number): void {
    setWorkspaceLayout(current => current[dimension] === size ? current : { ...current, [dimension]: size });
    if (dimension === 'outputHeight') setOutputPanelMode('normal');
  }
  useEffect(() => {
    // Coalesce pointer moves; write only the latest display preferences.
    const persist = () => {
      try { localStorage.setItem('studio.workspaceLayout', JSON.stringify(workspaceLayout)); } catch { /* unavailable */ }
    };
    const timer = window.setTimeout(persist, 200);
    window.addEventListener('pagehide', persist);
    return () => { window.clearTimeout(timer); window.removeEventListener('pagehide', persist); };
  }, [workspaceLayout]);
  useEffect(() => {
    const main = studioMainElement.current;
    const workspace = editorOutputRegion.current;
    if (!main || !workspace) return;
    const measure = () => setWorkspaceDimensions(current => {
      const width = main.clientWidth;
      const height = workspace.clientHeight;
      return current.width === width && current.height === height ? current : { width, height };
    });
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    observer.observe(workspace);
    measure();
    return () => observer.disconnect();
  }, []);
  function toggleFocusMode(): void {
    setFocusMode(current => !current);
  }
  function toggleExplorer(): void {
    if (focusMode) { setFocusMode(false); setExplorerVisible(true); }
    else setExplorerVisible(current => !current);
  }
  function toggleOutputPanel(): void {
    if (focusMode) { setFocusMode(false); setOutputPanelMode(revealOutputPanel); }
    else setOutputPanelMode(current => nextOutputPanelMode(current, 'toggle'));
  }
  function resetWorkspaceLayout(): void {
    setFocusMode(false);
    setWorkspaceLayout({ ...DEFAULT_WORKSPACE_LAYOUT });
    setOutputPanelMode('normal');
    setExplorerVisible(true);
    setCompilerControlsOpen(true);
  }
  function showCompilerSetup(): void {
    setFocusMode(false);
    setOutputPanelMode(revealOutputPanel);
    setCompilerControlsOpen(true);
  }

  // The workspace is a browsing root. Project operations deliberately use
  // a chosen manifest directory, which may be nested several levels down.
  // null means no project is selected; '' is a real root manifest.
  const selectedProjectPath = selectedManifestPath(projectDirectory, projectRoots);
  const navigationSnapshot=useMemo<NavigationSnapshot|null>(()=>compilerNavigation&&selectedProjectPath?{folder:selectedProjectPath,report:compilerNavigation}:null,[compilerNavigation,selectedProjectPath]);
  const selectedProjectHasManifest = selectedProjectPath !== null;
  // A file is never allowed to redirect project execution automatically.
  // Offer an explicit switch to its closest discovered manifest root instead.
  const activeSourceProjectDirectory = projectTargetForListedSource(
    active?.path ?? null, folderEntries, projectRoots,
  );
  const activeSourceHasOtherProject = activeSourceProjectDirectory !== null &&
    activeSourceProjectDirectory !== projectDirectory;
  const dirtySelectedProjectSources = useMemo(
    () => selectedProjectPath ? dirtyProjectSourceNames(documents, selectedProjectPath) : [],
    [documents, selectedProjectPath],
  );
  const laterProjectOutputWarning = completedProjectOutputWarning(completedProjectOutput, {
    epoch: projectResultEpoch.current,
    listing: selectedFolderRef.current,
  });
  const laterSourceOutputWarning = completedSourceOutputWarning(completedSourceOutput, documents);
  const laterRunInputWarning = completedRunInputWarning(
    completedRunInputGeneration, inputRevision.current,
  );
  // Source/project changes and altered Run inputs are independent reasons
  // for retaining output as historical. Display both if both are stale.
  const outputFreshnessWarning = [
    laterSourceOutputWarning, laterProjectOutputWarning, laterRunInputWarning,
  ].filter((warning) => warning !== null).join('\n\n');
  const diagnostic = useMemo(() => parseScarpDiagnostic(compilerDiagnosticStderr), [compilerDiagnosticStderr]);
  const detailedSourceDiagnostic = useMemo(() => {
    const parsed = parseDiagnosticReport(compilerDiagnosticStderr, 'source-verify');
    return parsed.ok ? parsed.report : null;
  }, [compilerDiagnosticStderr]);
  const problems = useMemo(() => collectProblems({ diagnostic, snapshot: compilerOutputSource,
    documents, testResult: projectTestResult, selection: selectedFolderRef.current,
    stale: Boolean(outputFreshnessWarning), projectDiagnosticReport, selectedProjectPath,
  }), [diagnostic, compilerOutputSource, documents, projectTestResult, folderEntries, outputFreshnessWarning, projectDiagnosticReport, selectedProjectPath]);
  const navigableDiagnostic = problems.find(problem => problem.kind === 'compiler' && problem.target?.kind === 'source');
  const problemMarker = useMemo(() => outputFreshnessWarning ? null : verifiedProblemMarker(diagnostic, compilerOutputSource, active),
    [diagnostic, compilerOutputSource, active, outputFreshnessWarning]);
  useEffect(() => {
    if (resultsView === 'problems' && outputPanelMode !== 'collapsed' && focusProblemsTab.current) {
      focusProblemsTab.current = false;
      problemsTab.current?.focus();
    }
  }, [resultsView, outputPanelMode]);
  const declarationOutline = useMemo(
    () => active ? scanScarpOutlineSymbols(active.content) : [],
    [active?.content],
  );

  const canUndoReplacement = replaceUndo !== null && canUndoOpenFileReplace(replaceUndo, editorState);

  const openFileMatches = useMemo(() => searchOpenFiles(
    documents, searchQuery, {
      caseSensitive: searchCaseSensitive, wholeWord: searchWholeWord,
    },
  ), [documents, searchQuery, searchCaseSensitive, searchWholeWord]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  // Exact-source previews cannot survive edits, tab changes or search changes.
  useEffect(() => {
    setReplacePreview(null);
  }, [documents, searchQuery, replaceText, searchCaseSensitive, searchWholeWord]);

  // Do not retain a stale undo plan (and its old source strings) after a tab
  // is modified, saved, opened or closed. Switching focus alone is harmless.
  useEffect(() => {
    setReplaceUndo((previous) => previous && !canUndoOpenFileReplace(previous, liveEditor.current)
      ? null : previous);
    setProjectReplacementUndo(previous => previous && !canUndoOpenFileReplace(previous,liveEditor.current) ? null : previous);
    setDiskReconciliationUndo(previous=>previous&&!canUndoOpenFileReplace(previous,liveEditor.current)?null:previous);
  }, [documents]);

  useEffect(() => {
    const editor = mountedEditor.current;
    const monaco = mountedMonaco.current;
    const model = editor?.getModel();
    if (!model || !monaco) return;
    const markers = problemMarker && active?.content === model.getValue()
      ? [{ ...problemMarker, severity: monaco.MarkerSeverity.Error, source: 'Scarp Verify' }]
      : [];
    monaco.editor.setModelMarkers(model, 'scarp-verify', markers);
    // A tab switch, edit, save, or new Verify must not leave old diagnostics
    // attached to a reused Monaco document or a disposed editor model.
    return () => {
      if (!model.isDisposed()) monaco.editor.setModelMarkers(model, 'scarp-verify', []);
    };
  }, [activeId, active?.content, problemMarker]);

  function currentTrailCursor(reason: TrailReason) {
    const state = liveEditor.current;
    const document = state.documents.find(item => item.id === state.activeId);
    const editor = mountedEditor.current;
    const position = editor?.getPosition();
    if (!document || !position || mountedEditorDocumentId.current !== document.id ||
        editor?.getModel()?.getValue() !== document.content) return null;
    return captureTrailLocation(document, position.lineNumber, position.column, reason);
  }

  function recordTrailJump(document: StudioDocument, line: number, column: number, reason: TrailReason): void {
    const target = captureTrailLocation(document, line, column, reason);
    if (target) navigationTrail.record(currentTrailCursor('origin'), target, liveEditor.current.documents);
  }

  function markTrailCursor(): boolean {
    if (recoveryOperationsBlocked()) return false;
    const location = currentTrailCursor('marked');
    return !!location && navigationTrail.record(null, location, liveEditor.current.documents);
  }

  function replayTrailMove(move: TrailMove): boolean {
    if (recoveryOperationsBlocked()) return false;
    const target = navigationTrail.move(move, liveEditor.current.documents);
    if (!target) return false;
    jumpToSourceInsight(target, false);
    return true;
  }

  function jumpToSourceInsight(target: InsightNavigation, record = true): void {
    const current = liveEditor.current.documents.find(
      document => document.id === target.documentId,
    );
    if (!current ||
        current.revision !== target.revision || current.content !== target.source) return;
    if (!Number.isSafeInteger(target.line) || !Number.isSafeInteger(target.column) ||
        target.line < 1 || target.column < 1) return;
    if (record) recordTrailJump(current, target.line, target.column, 'insight');
    // A newly requested insight supersedes pending navigation from other panels.
    pendingInsightJump.current = null;
    pendingSearchLocation.current = null;
    pendingProblem.current = null;
    const editor = editorHandle.current;
    if (current.id !== liveEditor.current.activeId) {
      pendingInsightJump.current = target;
      dispatch({ type: 'activate', id: current.id });
      return;
    }
    if (!editor || mountedEditorDocumentId.current !== current.id ||
        editor.getModel()?.getValue() !== current.content) {
      pendingInsightJump.current = target;
      return;
    }
    const position = { lineNumber: target.line, column: target.column };
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
  }

  function addCurrentBookmark(): void {
    const state = liveEditor.current;
    if (!state.activeId) return;
    try {
      const newBookmark = createSourceBookmark(
        state.documents, bookmarks, state.activeId,
        cursor.line, cursor.column, bookmarkSequence.current++,
      );
      setBookmarks(previous => [...previous, newBookmark]);
      setNotice('Bookmarked source line ' + cursor.line + '.');
    } catch (caught) {
      setError('Could not add bookmark: ' + toMessage(caught));
    }
  }

  function jumpToBookmark(id: string): void {
    const state = liveEditor.current;
    const bookmarked = bookmarks.find(item => item.id === id);
    if (!bookmarked) return;
    const resolved = resolveSourceBookmarks([bookmarked], state.documents)[0];
    const target = bookmarkTargetForCurrentSource(resolved, state.documents);
    if (!target) {
      setError('Bookmark is stale or its source tab is closed. Select a current source line.');
      return;
    }
    jumpToSourceInsight(target);
  }

  function jumpToDeclaration(symbol: ScarpOutlineSymbol): void {
    const editor = editorHandle.current;
    if (!editor) return;
    const position = { lineNumber: symbol.line, column: symbol.startColumn };
    const current = liveEditor.current.documents.find(item => item.id === liveEditor.current.activeId);
    if (current) recordTrailJump(current, position.lineNumber, position.column, 'declaration');
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
    setNotice('Scarp ' + symbol.kind + ': ' + symbol.name);
  }

  const builtInPaletteCommands=studioCommands.map(entry=>({...entry,detail:studioCommandDetail(entry.id,entry.detail,shortcuts.bindings)}));
  const paletteEntries: readonly NavigationEntry[] = paletteMode === 'files'
    ? buildQuickOpenEntries(documents, folderEntries)
    : paletteMode === 'symbols' ? buildDeclarationEntries(active, declarationOutline) : [...builtInPaletteCommands,
      ...buildSnippetPaletteEntries(userSnippets, active)];
  const paletteResults = paletteMode === 'line'
    ? []
    : paletteMode==='commands'?searchCommandCollection(paletteEntries,commandLibrary,commandCollection,paletteQuery):filterNavigationEntries(paletteEntries, paletteQuery);
  const selectedPaletteIndex = clampPaletteIndex(paletteIndex, paletteResults.length);
  const selectedPaletteId = paletteResults[selectedPaletteIndex]?.id;

  function toggleLibraryPin(id:string){
    const next=togglePinnedCommand(commandLibrary,id);
    if(next.ok){setCommandLibrary(next.value);setPaletteIndex(0);}
    else setError(next.error);
  }
  function clearLibrary(review:LibraryClearReview){
    const next=confirmLibraryClear(review,commandLibrary);
    if(next.ok)setCommandLibrary(next.value);else setError(next.error);
  }
  function showPalette(mode: PaletteMode): void {
    if (paletteMode === null) {
      paletteReturnFocus.current = document.activeElement instanceof HTMLElement
        ? document.activeElement : null;
    }
    paletteRestoreOnClose.current = false;
    setPaletteMode(mode);
    setCommandCollection('all');
    setPaletteQuery('');
    setPaletteIndex(0);
  }

  function hidePalette(restoreFocus = true): void {
    paletteRestoreOnClose.current = restoreFocus;
    setPaletteMode(null);
    setPaletteQuery('');
    setPaletteIndex(0);
  }

  useEffect(() => {
    if (paletteMode !== null) {
      paletteInput.current?.focus();
      return;
    }
    const previous = paletteReturnFocus.current;
    paletteReturnFocus.current = null;
    const restore = paletteRestoreOnClose.current;
    paletteRestoreOnClose.current = false;
    if (restore && previous?.isConnected && !previous.closest('[hidden]') &&
        !(previous instanceof HTMLButtonElement && previous.disabled)) {
      previous.focus();
    } else if (!searchOpen) editorHandle.current?.focus();
  }, [paletteMode, activeId, searchOpen]);

  useEffect(() => {
    if (paletteMode !== null && selectedPaletteId !== undefined) {
      paletteSelectedResult.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [paletteMode, selectedPaletteIndex, selectedPaletteId]);

  useEffect(() => {
    activeTabElement.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId]);

  function cycleTab(direction: 1 | -1): void {
    const state = liveEditor.current;
    const id = cycleTabId(state.documents.map((item) => item.id), state.activeId, direction);
    if (id !== null) dispatch({ type: 'activate', id });
  }

  function goToLine(): void {
    const location = parseLineLocation(paletteQuery);
    const editor = editorHandle.current;
    const model = editor?.getModel();
    if (!location || !editor || !model) return;
    const position = clampLineLocation(location, model.getLineCount(), (line) => model.getLineMaxColumn(line));
    const monacoPosition = { lineNumber: position.line, column: position.column };
    const current = liveEditor.current.documents.find(item => item.id === liveEditor.current.activeId);
    if (current) recordTrailJump(current, position.line, position.column, 'line');
    editor.setPosition(monacoPosition);
    editor.revealPositionInCenter(monacoPosition);
    hidePalette(false);
    editor.focus();
    setNotice('Jumped to line ' + position.line + ', column ' + position.column);
  }

  function executePaletteEntry(entry: NavigationEntry): void {
    const mode = paletteMode;
    hidePalette(false);
    if (mode === 'files') {
      const target = entry as QuickOpenEntry;
      if (target.kind === 'tab') {
        if (liveEditor.current.documents.some((document) => document.id === target.documentId)) {
          dispatch({ type: 'activate', id: target.documentId });
        } else {
          setError('That Scarp tab is no longer open.');
        }
      } else if (target.kind === 'project') {
        const selected = selectedFolderRef.current;
        if (selected?.files.some((file) => sameFilePath(file.path, target.sourcePath))) {
          void openFolderFile(target.sourcePath);
        } else {
          setError('The selected project changed. Reopen Quick Open and choose the file again.');
        }
      }
      return;
    }
    if (mode === 'symbols') {
      const target = entry as DeclarationEntry;
      const current = currentActiveDocument(liveEditor.current);
      if (!isCurrentDeclarationEntry(current, target) || mountedEditorDocumentId.current !== target.documentId ||
          mountedEditor.current?.getModel()?.getValue() !== current?.content) {
        setError('The Scarp source changed. Reopen Go to Declaration and choose again.');
        return;
      }
      jumpToDeclaration(target.symbol);
      return;
    }
    if (mode !== 'commands') return;
    if(isLibraryCommand(entry.id))setCommandLibrary(previous=>recordCommandSelection(previous,entry.id));
    if (isSnippetPaletteEntry(entry)) {
      const current = currentActiveDocument(liveEditor.current);
      const editor = editorHandle.current;
      const model = editor?.getModel();
      const selection = editor?.getSelection();
      if (!current || !editor || !model || !selection || mountedEditorDocumentId.current !== current.id ||
          model.getValue() !== current.content || busy || compilerBusy || compilerSelecting ||
          editor.getSelections()?.length !== 1 || (mountedMonaco.current &&
          editor.getOption(mountedMonaco.current.editor.EditorOption.readOnly))) {
        setError('Choose a current editable Scarp source and a single selection before inserting a snippet.'); return;
      }
      const plan = planSnippetInsertion(current, entry, userSnippetStore.getSnapshot(), {
        start: model.getOffsetAt(selection.getStartPosition()),
        end: model.getOffsetAt(selection.getEndPosition()),
      }, model.getEOL());
      if (!plan.ok) { setError(plan.error); return; }
      editor.pushUndoStop();
      const applied = editor.executeEdits('studio-user-snippet', [{ range: selection, text: plan.value.text, forceMoveMarkers: true }]);
      if (!applied) { setError('The editor could not insert the snippet.'); return; }
      editor.pushUndoStop();
      editor.setPosition(model.getPositionAt(plan.value.caret));
      editor.focus(); setError(null); setNotice('Inserted user snippet defaults: ' + entry.prefix);
      return;
    }
    if (entry.id.startsWith('template:')) {
      createFromTemplate(entry.id.slice('template:'.length));
      return;
    }
    switch (entry.id) {
      case 'new': newFile(); break;
      case 'open': void openFile(); break;
      case 'reopen-closed': void reopenLastClosedSource(); break;
      case 'folder': void openFolder(); break;
      case 'refresh-folder': void refreshFolder(); break;
      case 'save': void saveFile(); break;
      case 'save-all': void saveAllFiles(); break;
      case 'save-as': void saveFile(true); break;
      case 'reload': void reloadFile(); break;
      case 'compare-disk': void compareActiveSourceWithDisk(); break;
      case 'close':
        if (liveEditor.current.activeId) void closeFile(liveEditor.current.activeId);
        break;
      case 'find-open-files': setSearchOpen(true); break;
      case 'find-project': setSearchOpen(true); break;
      case 'replace-open-files': setSearchOpen(true); break;
      case 'undo-replace-open-files': undoLastOpenFileReplace(); break;
      case 'quick-open': showPalette('files'); break;
      case 'go-to-line': showPalette('line'); break;
      case 'go-to-symbol': showPalette('symbols'); break;
      case 'next-tab': cycleTab(1); break;
      case 'previous-tab': cycleTab(-1); break;
      case 'theme': toggleTheme(); break;
      case 'settings': setEditorSettingsOpen(true); break;
      case 'explorer': toggleExplorer(); break;
      case 'select-compiler': void selectCompiler(); break;
      case 'scan-compiler': void rescanCompilers(); break;
      case 'download-compiler': void downloadCompiler(); break;
      case 'run-scarp': void runCompiler('exec'); break;
      case 'verify-scarp': void runCompiler('verify'); break;
      case 'stop-scarp': void stopCompiler(); break;
      case 'toggle-output': toggleOutputPanel(); break;
      case 'toggle-focus': toggleFocusMode(); break;
      case 'expand-output': setFocusMode(false); setOutputPanelMode('expanded'); break;
      case 'show-problems': showProblems(); break;
      case 'compiler-controls': showCompilerSetup(); break;
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedAppearance.theme;
    document.documentElement.dataset.contrast = resolvedAppearance.highContrast ? 'high' : 'normal';
    document.documentElement.dataset.motion = resolvedAppearance.reducedMotion ? 'reduced' : 'normal';
  }, [resolvedAppearance.theme, resolvedAppearance.highContrast, resolvedAppearance.reducedMotion]);
  useEffect(() => { persistAppearance(appearance); }, [appearance]);

  useEffect(() => {
    mountedEditor.current?.getModel()?.updateOptions({ tabSize: editorPreferences.tabSize, insertSpaces: editorPreferences.insertSpaces, trimAutoWhitespace: editorPreferences.trimAutoWhitespace });
  }, [editorPreferences.tabSize, editorPreferences.insertSpaces, editorPreferences.trimAutoWhitespace, activeId]);

  useEffect(() => {
    // Editor preferences remain local and never modify a source file.
    try {
      localStorage.setItem('studio.editorPreferences', JSON.stringify(editorPreferences));
    } catch { /* Continue with in-memory settings when storage is unavailable. */ }
  }, [editorPreferences]);

  // This operation only inspects bounded local directories. It never runs
  // candidate executables and does not grant trust, even after a prior session.
  useEffect(() => {
    if (!isTauri() || !startupDiscovery.current) return;
    let mounted = true;
    const requests = compilerDiscoveryRequests.current;
    const request = requests.begin();
    void detectScarp().then((found) => {
      // React Strict Mode and manual Scan can both supersede startup.
      if (mounted && requests.isCurrent(request)) setDetectedCompilers(found);
    }).catch(() => { /* Manual scan exposes any discovery error explicitly. */ });
    return () => {
      mounted = false;
      // Also invalidate a manual or first-Run scan still outstanding at
      // unmount. It must not later show UI or continue into execution.
      requests.invalidate();
    };
  }, []);

  useEffect(() => {
    persistCompilerPreferences(compilerPreferences);
  }, [compilerPreferences]);

  useEffect(() => {
    persistAutoSavePreferences(autoSavePreferences);
  }, [autoSavePreferences]);

  // Own the scheduler for each React effect lifetime, including Strict Mode
  // cleanup/replay. A disposed scheduler must never be reused.
  useEffect(() => {
    const scheduler = new AutoSaveScheduler((document) => autoSaveAction.current(document));
    autoSaveScheduler.current = scheduler;
    scheduler.reconcile(liveEditor.current.documents, autoSavePreferences.enabled && isTauri(),
      autoSavePreferences.delay, compilerBusy || compilerSelecting || compilerScanning || busy);
    return () => {
      scheduler.dispose();
      if (autoSaveScheduler.current === scheduler) autoSaveScheduler.current = null;
    };
    // The next effect reconciles all live source and preference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    autoSaveReview.current.reconcile(documents);
    autoSaveScheduler.current?.reconcile(documents, autoSavePreferences.enabled && isTauri(),
      autoSavePreferences.delay, compilerBusy || compilerSelecting || compilerScanning || busy);
  }, [documents, autoSavePreferences, compilerBusy, compilerSelecting, compilerScanning, busy]);

  function syncRecoveryView(): void {
    const next = draftRecovery.view();
    setRecoveryView(previous => sameRecoveryView(previous, next) ? previous : next);
  }

  function flushDraftRecovery(force = false): void {
    const view = draftRecovery.view();
    if (!view.enabled || view.previous || view.blocked || view.paused) return;
    const current = liveEditor.current.documents;
    if (!force && lastRecoveryAttempt.current === current) return;
    lastRecoveryAttempt.current = current;
    draftRecovery.flush(current, Date.now());
    syncRecoveryView();
  }

  function recoveryOperationsBlocked(): boolean {
    return saveInProgress.current || commandInProgress.current ||
      selectionInProgress.current || filePickerInProgress.current ||
      nativeDialogGate.current.isActive;
  }

  function enableDraftRecovery(): void {
    if (recoveryOperationsBlocked()) return;
    if (draftRecovery.enable(liveEditor.current.documents, Date.now())) {
      setNotice('Local draft recovery enabled. Continue to save your Scarp files normally.');
    }
    syncRecoveryView();
  }

  function disableDraftRecovery(): void {
    if (recoveryOperationsBlocked()) return;
    if (draftRecovery.disable()) setNotice('Local draft recovery disabled and local copies removed.');
    syncRecoveryView();
  }

  function restorePreviousDrafts(checkpoint: RecoveryCheckpoint): void {
    if (recoveryOperationsBlocked()) return;
    const action: EditorAction = { type: 'restore-drafts', drafts: checkpoint.drafts };
    const next = editorReducer(liveEditor.current, action);
    if (next === liveEditor.current) {
      setError('Recovery drafts could not be restored safely.');
      return;
    }
    // Persist the complete new checkpoint first. A failed/quota-limited write
    // must neither retire the prior checkpoint nor append only some drafts.
    if (draftRecovery.resolvePrevious(checkpoint, next.documents, Date.now())) {
      dispatch(action);
      setNotice('Restored ' + checkpoint.drafts.length + ' draft(s) as new unsaved copies.');
    }
    syncRecoveryView();
  }

  function discardPreviousDrafts(checkpoint: RecoveryCheckpoint): void {
    if (recoveryOperationsBlocked()) return;
    if (draftRecovery.resolvePrevious(checkpoint, liveEditor.current.documents, Date.now())) {
      setNotice('Previous recovery drafts removed. Current editor tabs are unchanged.');
    }
    syncRecoveryView();
  }

  // Checkpoint after a short pause, but also during sustained typing. The
  // periodic tick reads the live editor, never a captured stale React render.
  // React Strict Mode cleanup removes both timers without changing storage.
  useEffect(() => {
    if (!recoveryView.enabled || recoveryView.previous || recoveryView.blocked || recoveryView.paused) return;
    const timer = window.setTimeout(() => flushDraftRecovery(), 750);
    return () => window.clearTimeout(timer);
  }, [documents, recoveryView.enabled, recoveryView.previous, recoveryView.blocked, recoveryView.paused]);

  useEffect(() => {
    if (!recoveryView.enabled || recoveryView.previous || recoveryView.blocked || recoveryView.paused) return;
    const interval = window.setInterval(() => flushDraftRecovery(draftRecovery.shouldRetryFlush()), 4000);
    const flush = () => flushDraftRecovery(true);
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [recoveryView.enabled, recoveryView.previous, recoveryView.blocked, recoveryView.paused]);

  // The close event must be cancelled synchronously before any native dialog.
  useEffect(() => {
    if (!isTauri()) return;
    let removed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested(async (event) => {
      const exitSnapshot = liveEditor.current;
      const pending = exitSnapshot.documents.filter(isDirty);
      const blocked = exitBlockReason(
        saveInProgress.current, commandInProgress.current, selectionInProgress.current,
        filePickerInProgress.current,
      );
      if (!pending.length && !blocked && !nativeDialogGate.current.isActive &&
          !draftRecovery.requiresExitPreparation()) return;
      event.preventDefault();
      if (blocked) {
        setError(blocked);
        return;
      }
      if (!nativeDialogGate.current.begin('window-exit')) return;
      let prepared = false;
      let destroyed = false;
      const exitStillValid = () => {
        const newBlocker = exitBlockReason(
          saveInProgress.current, commandInProgress.current, selectionInProgress.current,
          filePickerInProgress.current,
        );
        if (newBlocker || !sameExitEditorState(exitSnapshot, liveEditor.current)) {
          setError(newBlocker || 'Files changed while confirming exit. Review your edits and try again.');
          return false;
        }
        return true;
      };
      try {
        if (pending.length && !await ask('Discard unsaved Scarp changes and exit?', {
          title: 'Unsaved changes',
          kind: 'warning',
        })) return;
        if (!exitStillValid()) return;
        prepared = true;
        const cleared = draftRecovery.prepareExit();
        syncRecoveryView();
        if (!cleared) {
          if (!await ask('The local draft recovery copy could not be removed. Exit anyway? The copy may remain in this desktop profile.', {
            title: 'Local recovery storage',
            kind: 'warning',
          })) return;
          if (!exitStillValid()) return;
        }
        await getCurrentWindow().destroy();
        destroyed = true;
      } catch (caught) {
        setError(toMessage(caught));
      } finally {
        if (prepared && !destroyed) {
          draftRecovery.resumeAfterExitFailure(liveEditor.current.documents, Date.now());
          syncRecoveryView();
        }
        nativeDialogGate.current.finish('window-exit');
      }
    }).then((cleanup) => {
      if (removed) cleanup();
      else unlisten = cleanup;
    }).catch((caught: unknown) => setError(toMessage(caught)));
    return () => { removed = true; unlisten?.(); };
  }, []);

  function createFromTemplate(id: string): void {
    const template = getScarpStarterTemplate(id);
    if (!template) {
      setError('Unknown Scarp starter template.');
      return;
    }
    // The new tab is intentionally unsaved and its content is not executed.
    dispatch({ type: 'new' });
    const idOfNewTab = liveEditor.current.activeId;
    if (idOfNewTab) dispatch({ type: 'edit', id: idOfNewTab, content: template.source });
    setNotice('Created ' + template.title + ' starter · save as .srp before running');
    setError(null);
  }

  function showStarterTemplates(): void {
    showPalette('commands');
    setPaletteQuery('template');
  }

  function newFile(): void {
    dispatch({ type: 'new' });
    setNotice('Created a new Scarp source file');
    setError(null);
  }

  function activateOpenedFile(path: string, content: string): void {
    dispatch({ type: 'open', path, content });
    setNotice('Opened ' + fileName(path));
  }

  async function openFile(): Promise<void> {
    if (filePickerInProgress.current || saveInProgress.current ||
        selectionInProgress.current || nativeDialogGate.current.isActive) return;
    const editorAtStart = liveEditor.current;
    const activeAtStart = editorAtStart.activeId;
    const activeSnapshot = currentActiveDocument(editorAtStart);
    filePickerInProgress.current = true;
    setBusy(true);
    setError(null);
    try {
      // The native picker returns a path, not file bytes. Resolve existing
      // live tabs *first*: reading disk may fail after an external rename.
      const path = await pickSourcePath();
      if (path === null) return;
      const decide = () => hasUnchangedEditorSession(editorAtStart, liveEditor.current)
        ? decidePickedSourceOpen(
          path, liveEditor.current.documents, activeAtStart, liveEditor.current.activeId,
          activeSnapshot,
        )
        : { kind: 'stale' as const };
      const initial = decide();
      if (initial.kind === 'stale') {
        setError('The active tab changed while choosing a source. Open the file again.');
        return;
      }
      if (initial.kind === 'invalid') {
        setError('Only .srp files can be opened.');
        return;
      }
      if (initial.kind === 'activate') {
        dispatch({ type: 'activate', id: initial.documentId });
        setNotice('Returned to open ' + fileName(path) + ' tab without reading disk');
        return;
      }
      const content = await readScarpSource(initial.path);
      const latest = decide();
      if (latest.kind === 'stale') {
        setError('The active tab changed while the source was loading. Open it again.');
        return;
      }
      if (latest.kind === 'activate') {
        dispatch({ type: 'activate', id: latest.documentId });
        setNotice('Returned to already-open Scarp source');
        return;
      }
      if (latest.kind !== 'read') {
        setError('The source selection became invalid. Open the file again.');
        return;
      }
      activateOpenedFile(path, content);
    } catch (caught) {
      setError('Could not open source: ' + toMessage(caught));
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  async function openFolder(): Promise<void> {
    if (filePickerInProgress.current || saveInProgress.current ||
        selectionInProgress.current || commandInProgress.current ||
        nativeDialogGate.current.isActive) return;
    filePickerInProgress.current = true;
    setError(null);
    setBusy(true);
    try {
      const result = await chooseSourceFolder();
      if (!result) return;
      // Even reselecting the same path creates a new project listing; old
      // test passes must not reappear after folder A→B→A selection cycles.
      projectResultEpoch.current++;
      setProjectTestResult(null);
      setCompilerNavigation(null);
      setProjectInfo(null);
      setProjectDiagnosticReport(null);
      invalidateProjectSearch();
      selectedFolderRef.current = { path: result.path, files: result.files, projectRoots: result.projectRoots };
      setProjectRoots(result.projectRoots);
      setProjectDirectory(preferredProjectDirectory(result.projectRoots));
      setFolderPath(result.path);
      setFolderEntries(result.files);
      setFolderDirectories(result.directories);
      setFolderListingLimited(result.truncated);
      setUnavailableProjectFolders(result.unavailableFolders);
      setNotice(result.files.length + ' Scarp sources shown' +
        (result.truncated ? ' (listing limited)' : '') +
        (result.unavailableFolders.length ? ' (some project folders were inaccessible)' : ''));
    } catch (caught) {
      setError('Could not open folder: ' + toMessage(caught));
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  async function refreshFolder(): Promise<void> {
    const previous = selectedFolderRef.current;
    if (!previous) {
      setError('Choose a Scarp project folder before refreshing the Explorer.');
      return;
    }
    if (filePickerInProgress.current || saveInProgress.current ||
        selectionInProgress.current || commandInProgress.current ||
        nativeDialogGate.current.isActive) return;
    // Share the picker lock: no Save As / compiler selection / native close
    // may overtake a refresh while filesystem permissions are being checked.
    filePickerInProgress.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await scanSourceFolder(previous.path);
      // Never publish results from an obsolete selection after an async read.
      if (selectedFolderRef.current !== previous) {
        setError('The selected folder changed during refresh. Choose Refresh again.');
        return;
      }
      // A refresh can observe on-disk changes the editor did not make.
      projectResultEpoch.current++;
      setProjectTestResult(null);
      setCompilerNavigation(null);
      setProjectInfo(null);
      setProjectDiagnosticReport(null);
      invalidateProjectSearch();
      selectedFolderRef.current = { path: result.path, files: result.files, projectRoots: result.projectRoots };
      setProjectRoots(result.projectRoots);
      setProjectDirectory(current => retainedProjectDirectory(current, result.projectRoots));
      setFolderEntries(result.files);
      setFolderDirectories(result.directories);
      setFolderListingLimited(result.truncated);
      setUnavailableProjectFolders(result.unavailableFolders);
      setNotice('Refreshed ' + result.files.length + ' Scarp project sources' +
        (result.truncated ? ' (listing limited)' : '') +
        (result.unavailableFolders.length ? ' (some folders were inaccessible)' : ''));
    } catch (caught) {
      // Keep previously listed files and open dirty buffers intact if scan
      // fails; only a successful scan may replace Explorer membership.
      setError('Could not refresh Scarp folder: ' + toMessage(caught));
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  async function createExplorerProject(plan: ProjectScaffoldPlan): Promise<ScaffoldCompletion> {
    const selection = selectedFolderRef.current;
    if (!isTauri() || !selection || recoveryOperationsBlocked() || compilerScanning) {
      return { status:'blocked', directory:plan.directory, created:[], uncertain:[],
        error:'Finish the current native operation and select a workspace.' };
    }
    const targets = workspaceCreationTargets(folderDirectories, unavailableProjectFolders);
    filePickerInProgress.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await createProjectScaffold({
        root:selection.path,targets,plan,isCurrent:()=>selectedFolderRef.current===selection,
        openPaths:()=>liveEditor.current.documents.flatMap(document=>document.path?[document.path]:[]),
      });
      const refreshed = result.status !== 'blocked' ? await updateExplorerAfterSave() : false;
      const message = summarizeScaffoldResult(result) + (refreshed ? ' Explorer refreshed.' : '');
      if (result.status === 'complete') setNotice(message);
      else setError(message);
      return result;
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  async function createExplorerItem(request: WorkspaceCreateRequest): Promise<boolean> {
    const selection = selectedFolderRef.current;
    if (!isTauri() || !selection || filePickerInProgress.current ||
        saveInProgress.current || selectionInProgress.current ||
        commandInProgress.current || nativeDialogGate.current.isActive ||
        compilerScanning) return false;
    const targets = workspaceCreationTargets(folderDirectories, unavailableProjectFolders);
    filePickerInProgress.current = true;
    setBusy(true);
    setError(null);
    try {
      const item = await createWorkspaceItem({
        root: selection.path, targets, request,
        isCurrent: () => selectedFolderRef.current === selection,
        openPaths: () => liveEditor.current.documents.flatMap(document =>
          document.path === null ? [] : [document.path]),
      });
      const refreshed = await updateExplorerAfterSave();
      setNotice('Created ' + item.relativePath +
        (refreshed ? '. Explorer refreshed.' : '. Refresh Explorer to update the listing.'));
      return true;
    } catch (caught) {
      setError('Could not create workspace item: ' + toMessage(caught));
      return false;
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  function rememberWorkspaceTabs(reviewed: CapturedWorkspaceSession, expected: WorkspaceSession | null): void {
    if (recoveryOperationsBlocked()) return;
    const selection = selectedFolderRef.current;
    const editor = liveEditor.current;
    if (!selection || !reviewed.session) {
      setError('Choose a workspace and open at least one clean listed source before remembering tabs.');
      return;
    }
    const capture = captureWorkspaceSession(selection.path, selection.files, editor.documents, editor.activeId, Date.now());
    if (!capture.session || !sameWorkspaceCapture(reviewed, capture)) {
      setError('The workspace or open tabs changed. Review the current remembered-tab preview and retry.');
      return;
    }
    if (workspaceSessions.remember(capture.session, expected)) {
      setError(null);
      setNotice('Remembered ' + capture.rememberedCount + ' clean workspace tab(s). No source content was stored.');
    }
    setWorkspaceSessionView(workspaceSessions.view());
  }

  function forgetWorkspaceTabs(session: WorkspaceSession): void {
    if (recoveryOperationsBlocked()) return;
    if (workspaceSessions.forget(session)) {
      setError(null);
      setNotice('Removed remembered workspace metadata. Source files are unchanged.');
    }
    setWorkspaceSessionView(workspaceSessions.view());
  }

  function clearRememberedWorkspaces(sessions: readonly WorkspaceSession[]): void {
    if (recoveryOperationsBlocked()) return;
    if (workspaceSessions.clearAll(sessions)) {
      setError(null);
      setNotice('Removed all remembered workspace metadata. Open tabs are unchanged.');
    }
    setWorkspaceSessionView(workspaceSessions.view());
  }

  async function restoreWorkspaceTabs(session: WorkspaceSession, expectedPlan: WorkspaceRestorePlan): Promise<void> {
    if (recoveryOperationsBlocked()) return;
    const selection = selectedFolderRef.current;
    const editorAtStart = liveEditor.current;
    if (!selection || !workspaceSessions.canRestore(session)) {
      setWorkspaceSessionView(workspaceSessions.view());
      setError('Choose and review the current remembered workspace before restoring tabs.');
      return;
    }
    filePickerInProgress.current = true;
    setBusy(true);
    setError(null);
    // Treat every awaited disk read as a stale-operation boundary. Neither
    // workspace refresh, editor ABA, nor a changed storage record may publish
    // any of the staged tabs.
    const isCurrent = () => selectedFolderRef.current === selection &&
      hasUnchangedEditorSession(editorAtStart, liveEditor.current) &&
      workspaceSessions.canRestore(session);
    try {
      const prepared = await prepareWorkspaceRestore({
        session, expectedPlan, selectedRoot: selection.path, listedFiles: selection.files,
        documents: editorAtStart.documents, isCurrent, read: readScarpSource,
      });
      if (!isCurrent()) throw new Error('The workspace or editor changed during restore.');
      const action: EditorAction = {
        type: 'restore-workspace-tabs', files: prepared.files, activePath: prepared.activePath,
      };
      const next = editorReducer(liveEditor.current, action);
      if (prepared.files.length && next === liveEditor.current) {
        throw new Error('The prepared workspace tabs could not be opened safely.');
      }
      dispatch(action);
      setNotice('Opened ' + prepared.files.length + ' remembered tab(s), preserved ' +
        prepared.alreadyOpen + ' already-open tab(s)' +
        (prepared.skipped ? ', skipped ' + prepared.skipped + ' unlisted or ambiguous source(s).' : '.'));
    } catch (caught) {
      setError('Could not restore remembered workspace: ' + toMessage(caught));
    } finally {
      setWorkspaceSessionView(workspaceSessions.view());
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  function publishRecentlyClosed(next: RecentlyClosedState): void {
    if (next === recentlyClosedRef.current) return;
    recentlyClosedRef.current = next;
    setRecentlyClosed(next);
  }

  function forgetClosedSource(entry: RecentlyClosedSource): void {
    if (recoveryOperationsBlocked()) return;
    publishRecentlyClosed(forgetRecentlyClosed(recentlyClosedRef.current, entry));
  }

  function clearClosedSources(expected: readonly RecentlyClosedSource[]): void {
    if (recoveryOperationsBlocked() || recentlyClosedRef.current.entries !== expected) return;
    publishRecentlyClosed(clearRecentlyClosed(recentlyClosedRef.current));
  }

  async function reopenLastClosedSource(): Promise<void> {
    const entry = recentlyClosedRef.current.entries[0];
    if (!entry) {
      setNotice('No recently closed saved sources.');
      return;
    }
    await reopenClosedSource(entry);
  }

  async function reopenClosedSource(entry: RecentlyClosedSource): Promise<void> {
    if (!isTauri() || recoveryOperationsBlocked()) return;
    const before = liveEditor.current;
    const selection = selectedFolderRef.current;
    const decision = resolveRecentlyClosed(recentlyClosedRef.current, entry, before.documents);
    if (decision.kind === 'stale' || decision.kind === 'ambiguous') {
      setError('The recently closed source is no longer unambiguous. Review the history and retry.');
      return;
    }
    if (decision.kind === 'activate') {
      dispatch({ type: 'activate', id: decision.documentId });
      publishRecentlyClosed(forgetRecentlyClosed(recentlyClosedRef.current, entry));
      setError(null);
      return;
    }
    // This exact path came from a previously open clean tab in this desktop
    // session. The native filesystem scope still decides whether it can be
    // read. Do not request wider access or guess a new path if it was moved.
    filePickerInProgress.current = true;
    setBusy(true);
    setError(null);
    try {
      const request = {
        entry, expectedPath: decision.path, read: readScarpSource,
        getCurrent: () => ({ history: recentlyClosedRef.current, documents: liveEditor.current.documents }),
        isCurrent: () => selectedFolderRef.current === selection &&
          hasUnchangedEditorSession(before, liveEditor.current),
      };
      const content = await prepareRecentlyClosedRead(request);
      // The service's final check precedes resolution of its promise. Check
      // again in this continuation immediately before committing editor state.
      assertRecentlyClosedReadCurrent(request);
      activateOpenedFile(decision.path, content);
      setNotice('Reopened ' + entry.name + ' from its current disk contents.');
    } catch (caught) {
      setError('Could not reopen ' + entry.name + ': ' + toMessage(caught));
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  async function openFolderFile(path: string): Promise<void> {
    const selection = selectedFolderRef.current;
    if (!selection) {
      setError('Choose a Scarp project folder before opening a project source.');
      return;
    }
    // A project source read must share the same operation lock as native
    // pickers and Refresh. Otherwise a concurrent Save As, folder switch or
    // close request could race a delayed filesystem response.
    if (filePickerInProgress.current || saveInProgress.current ||
        selectionInProgress.current || nativeDialogGate.current.isActive) return;
    // Resolve against the current listing first. If the path is already
    // open, focus the live tab rather than reading a potentially stale disk
    // copy that could be missing or modified by another editor.
    const decision = resolveListedProjectOpen(path, selection.files, liveEditor.current.documents);
    if (decision.kind === 'not-listed') {
      setError('That source is no longer in the selected Scarp project listing.');
      return;
    }
    if (decision.kind === 'activate') {
      dispatch({ type: 'activate', id: decision.documentId });
      setError(null);
      return;
    }
    const editorAtStart = liveEditor.current;
    const activeAtStart = editorAtStart.activeId;
    const activeSnapshot = currentActiveDocument(editorAtStart);
    filePickerInProgress.current = true;
    setBusy(true);
    setError(null);
    try {
      const content = await readFolderSource(decision.path, selection.files);
      if (!hasUnchangedEditorSession(editorAtStart, liveEditor.current) ||
          !isCurrentListedSourceRead(
            selection, selectedFolderRef.current, activeAtStart,
            activeSnapshot, liveEditor.current,
          )) {
        setError('The project folder, active tab or source text changed during the read. Select the file again.');
        return;
      }
      activateOpenedFile(decision.path, content);
    } catch (caught) {
      setError('Could not read folder file: ' + toMessage(caught));
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  async function performFixtureOperation<T>(operation:(target:NonNullable<ReturnType<typeof fixtureProjectTarget>>,current:()=>boolean)=>Promise<T>):Promise<T>{
    const selection=selectedFolderRef.current;
    const target=fixtureProjectTarget(selection,selectedProjectPath);
    if(!isTauri()||!target||recoveryOperationsBlocked()||compilerScanning)throw Error('Select a discovered project and finish native operations first.');
    const epoch=projectResultEpoch.current;
    const editor=liveEditor.current;
    filePickerInProgress.current=true;setBusy(true);
    try{
      return await operation(target,()=>selection===selectedFolderRef.current&&epoch===projectResultEpoch.current&&
        editor.sessionRevision===liveEditor.current.sessionRevision);
    }finally{filePickerInProgress.current=false;setBusy(false);}
  }
  async function scanFixtures():Promise<FixtureResult<FixtureInventory>>{
    return performFixtureOperation((target,isCurrent)=>scanTestFixtures({target,isCurrent}));
  }
  async function inspectFixture(test:string,stream:FixtureStream):Promise<FixtureResult<FixtureByteSummary>>{
    return performFixtureOperation((target,isCurrent)=>inspectTestFixture({target,isCurrent},test,stream));
  }
  async function createFixture(plan:FixtureCreatePlan):Promise<FixtureCreationOutcome>{
    const outcome=await performFixtureOperation((target,isCurrent)=>createTestFixture({target,isCurrent},plan));
    if(outcome.status!=='blocked'){
      // Fixture creation changes a test input even if no .srp buffer changed.
      projectResultEpoch.current++;
      setProjectTestResult(null);
      setCompilerNavigation(null);
      setProjectDiagnosticReport(null);
      setNotice(outcome.message);
    }
    return outcome;
  }

  async function scanProjectDependencies(mode:AuditMode):Promise<AuditResult>{
    const listing=selectedFolderRef.current;
    const folder=selectedProjectPath;
    const start=liveEditor.current;
    const epoch=projectResultEpoch.current;
    if(!isTauri()||!listing||!folder||recoveryOperationsBlocked()||compilerScanning)return {ok:false,error:'Choose a manifest project and finish current native operations.'};
    filePickerInProgress.current=true;setBusy(true);
    try{
      return await auditListedProjectDependencies(listing,folder,mode,start.documents,
        folderListingLimited||unavailableProjectFolders.length>0,readScarpSource,
        ()=>listing===selectedFolderRef.current&&epoch===projectResultEpoch.current&&start.sessionRevision===liveEditor.current.sessionRevision);
    }finally{filePickerInProgress.current=false;setBusy(false);}
  }
  function openDependencyAuditFile(audit:ProjectDependencyAudit,id:string){
    if(recoveryOperationsBlocked())return;
    const path=resolveAuditFile(audit,id,selectedFolderRef.current,selectedProjectPath);
    if(path)void openFolderFile(path);
    else setError('The audited source is no longer uniquely listed.');
  }

  async function scanOpenFilesOnDisk(): Promise<WorkspaceDiskResult<WorkspaceDiskReview>> {
    if (!isTauri() || recoveryOperationsBlocked() || compilerScanning)
      return {ok:false,error:'Finish the current native operation before checking open files.'};
    const start=liveEditor.current;
    filePickerInProgress.current=true;
    setBusy(true);
    try {
      return await inspectWorkspaceDisk(start,readScarpSource,()=>diskOperationCurrent(start,liveEditor.current));
    } finally {
      filePickerInProgress.current=false;
      setBusy(false);
    }
  }

  async function reloadReviewedCleanFiles(review:WorkspaceDiskReview,ids:readonly string[]):Promise<WorkspaceDiskResult<number>>{
    if(!isTauri()||recoveryOperationsBlocked()||compilerScanning)
      return {ok:false,error:'Finish the current native operation before reloading files.'};
    const start=liveEditor.current;
    filePickerInProgress.current=true;
    setBusy(true);
    try{
      const result=await prepareWorkspaceDiskReload(review,ids,start,readScarpSource,()=>diskOperationCurrent(start,liveEditor.current));
      if(!result.ok)return result;
      if(!diskOperationCurrent(start,liveEditor.current))return {ok:false,error:'Editor changed. No files reloaded.'};
      const action:EditorAction={type:'reload-clean-files',changes:result.value,allSnapshots:start.documents};
      const before=liveEditor.current;
      dispatch(action);
      if(before===liveEditor.current)return {ok:false,error:'Reload was rejected. No buffers changed.'};
      setNotice('Reloaded '+result.value.length+' reviewed clean source tab(s).');
      return {ok:true,value:result.value.length};
    }finally{
      filePickerInProgress.current=false;
      setBusy(false);
    }
  }

  async function applyDiskReconciliation(plan:DiskReconciliationPlan):Promise<ReconciliationResult<boolean>>{
    if(!isTauri()||recoveryOperationsBlocked()||compilerScanning||!diskReview||
      diskReview.diskContent!==plan.diskContent||!isUnchangedSnapshot(diskReview.snapshot,plan.review.snapshot))
      return {ok:false,error:'The reviewed disk source or editor changed.'};
    const start=liveEditor.current;
    filePickerInProgress.current=true;setBusy(true);
    try{
      const result=await recheckDiskReconciliation(plan,start,readScarpSource,()=>hasUnchangedEditorSession(start,liveEditor.current));
      if(!result.ok)return result;
      if(!hasUnchangedEditorSession(start,liveEditor.current))return {ok:false,error:'Editor changed. No source was reconciled.'};
      dispatch({type:'reconcile-disk-source',snapshot:plan.review.snapshot,content:plan.content,
        diskContent:plan.diskContent,allSnapshots:start.documents});
      const after=liveEditor.current;
      if(after===start)return {ok:false,error:'Editor rejected the reconciliation.'};
      const current=after.documents.find(doc=>doc.id===plan.review.snapshot.id)!;
      autoSaveReview.current.holdReplacements(after.documents,[current.id]);
      setDiskReconciliationUndo(current.content===plan.review.snapshot.content?null:{
        after:after.documents.slice(),changes:[{id:current.id,snapshot:current,content:plan.review.snapshot.content}],
      });
      setNotice('Reconciled working text against the verified disk baseline. No disk write. Review or Save manually.');
      return {ok:true,value:true};
    }finally{filePickerInProgress.current=false;setBusy(false);}
  }
  function undoDiskReconciliation(){
    const undo=diskReconciliationUndo;
    if(!undo||recoveryOperationsBlocked()||!canUndoOpenFileReplace(undo,liveEditor.current))return;
    dispatch({type:'replace-open-files',changes:undo.changes,allSnapshots:undo.after});
    autoSaveReview.current.holdReplacements(liveEditor.current.documents,undo.changes.map(change=>change.id));
    setDiskReconciliationUndo(null);setNotice('Restored previous working text; the independently verified disk baseline is retained.');
  }

  async function compareActiveSourceWithDisk(): Promise<void> {
    const snapshot = liveEditor.current;
    const selected = currentActiveDocument(snapshot);
    if (!selected?.path) {
      setError('Save this .srp source before comparing it with disk.');
      return;
    }
    if (!isTauri()) {
      setError('Checking disk sources requires the Scarp Studio desktop application.');
      return;
    }
    if (saveInProgress.current || filePickerInProgress.current ||
        selectionInProgress.current || commandInProgress.current ||
        nativeDialogGate.current.isActive) {
      setError('Finish the current file, compiler or dialog operation before checking disk.');
      return;
    }
    // Native read shares the picker/file operation gate: Auto Save cannot
    // concurrently rewrite the comparison target. This never writes disk.
    filePickerInProgress.current = true;
    setBusy(true);
    setDiskReview(null);
    setError(null);
    try {
      const diskContent = await readScarpSource(selected.path);
      if (!isCurrentDiskReviewOperation(snapshot, liveEditor.current, selected)) {
        setError('The editor changed during the disk comparison. Check the file again.');
        return;
      }
      const report = inspectDiskSnapshot(selected, diskContent);
      setDiskReview({ snapshot: selected, report, diskContent: diskContent.length<=512*1024 ? diskContent : null });
      setNotice(report.status === 'unchanged'
        ? 'The saved disk source is unchanged since its last read/save.'
        : report.status === 'disk-matches-editor'
          ? 'Disk matches current editor text, but differs from its saved baseline.'
          : 'External source changes detected. Review before Reload or Save As.');
    } catch (caught) {
      setError('Could not compare source with disk: ' + toMessage(caught));
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  /** A successful Save As may have introduced a new source in a nested
   * practice folder. Scan the authorized workspace once after the verified
   * write, without reopening the saved document or losing later editor edits.
   * A scan failure is NOT a save failure: leave the old listing and show an
   * explicit refresh hint instead.
   */
  async function updateExplorerAfterSave(): Promise<boolean> {
    const previous = selectedFolderRef.current;
    if (!previous) return true;
    try {
      const result = await scanSourceFolder(previous.path);
      if (selectedFolderRef.current !== previous) return false;
      projectResultEpoch.current++;
      setProjectTestResult(null);
      setCompilerNavigation(null);
      setProjectInfo(null);
      setProjectDiagnosticReport(null);
      invalidateProjectSearch();
      selectedFolderRef.current = {
        path: result.path, files: result.files, projectRoots: result.projectRoots,
      };
      setFolderEntries(result.files);
      setFolderDirectories(result.directories);
      setProjectRoots(result.projectRoots);
      setProjectDirectory(current => retainedProjectDirectory(current, result.projectRoots));
      setFolderListingLimited(result.truncated);
      setUnavailableProjectFolders(result.unavailableFolders);
      return true;
    } catch {
      return false;
    }
  }

  async function saveFile(forceSaveAs = false): Promise<void> {
    const editorAtStart = liveEditor.current;
    const document = currentActiveDocument(editorAtStart);
    if (!document || saveInProgress.current || filePickerInProgress.current ||
        selectionInProgress.current || nativeDialogGate.current.isActive) return;
    // Project actions execute disk-backed sources. Do not rewrite their files
    // midway through a compiler Run, Verify or Test.
    if (commandInProgress.current) {
      setError('Finish or stop the Scarp operation before saving source files.');
      return;
    }
    saveInProgress.current = true;
    setError(null);
    setBusy(true);
    try {
      const path = await writeSourceFile(
        document,
        forceSaveAs,
        // Re-evaluate open tabs after any native Save As dialog resolves.
        () => liveEditor.current.documents
          .filter((item) => item.id !== document.id && item.path !== null)
          .map((item) => item.path as string),
        // A stale native Save As result cannot write an older buffer after an
        // edit, tab switch A→B→A or close/reopen—even if bytes look identical.
        () => isCurrentSingleSaveRequest(editorAtStart, liveEditor.current, document),
      );
      if (!path) return;
      // A new edit may arrive WHILE the file write/read-back is pending.
      // Record only the snapshot actually verified on disk, preserving later
      // changes as dirty rather than claiming that they were saved.
      dispatch({ type: 'saved', id: document.id, path, savedContent: document.content });
      const workspaceNeedsRefresh = saveChangesWorkspaceListing(document.path, path);
      const explorerRefreshed = !workspaceNeedsRefresh || await updateExplorerAfterSave();
      const current = liveEditor.current.documents.find((item) => item.id === document.id);
      const savedMessage = current && isDirty(current)
        ? 'Saved ' + fileName(path) + ' snapshot; newer edits remain unsaved'
        : 'Saved ' + fileName(path);
      setNotice(savedMessage + (!explorerRefreshed
        ? '; Explorer could not refresh. Use Refresh Explorer to update the file list.'
        : ''));
    } catch (caught) {
      setError('Could not save source: ' + toMessage(caught));
    } finally {
      saveInProgress.current = false;
      setBusy(false);
    }
  }

  async function saveAllFiles(): Promise<void> {
    if (saveInProgress.current || filePickerInProgress.current ||
        selectionInProgress.current || nativeDialogGate.current.isActive) return;
    if (commandInProgress.current) {
      setError('Finish or stop the Scarp operation before saving source files.');
      return;
    }
    // Capture only tab identities: each source is looked up again after earlier
    // native Save As dialogs, so later edits are saved at their current snapshot.
    const ids = liveEditor.current.documents.filter(isDirty).map((document) => document.id);
    if (!ids.length) {
      setNotice('All Scarp sources are already saved');
      return;
    }
    saveInProgress.current = true;
    setBusy(true);
    setError(null);
    let needsExplorerRefresh = false;
    try {
      const result = await saveAllModifiedSources(
        ids,
        (id) => liveEditor.current.documents.find((document) => document.id === id),
        (id) => liveEditor.current.documents
          .filter((document) => document.id !== id && document.path !== null)
          .map((document) => document.path as string),
        (document, path) => {
          needsExplorerRefresh ||= saveChangesWorkspaceListing(document.path, path);
          dispatch({ type: 'saved', id: document.id, path, savedContent: document.content });
        },
      );
      const explorerRefreshed = !needsExplorerRefresh || await updateExplorerAfterSave();
      const message = result.cancelled
        ? 'Save All cancelled; ' + result.saved + ' source(s) saved'
        : 'Saved ' + result.saved + ' Scarp source(s)';
      setNotice(message + (!explorerRefreshed
        ? '; Explorer could not refresh. Use Refresh Explorer to update the file list.'
        : ''));
    } catch (caught) {
      // Save All may stop after writing earlier new files successfully.
      // Preserve the original error and refresh the Explorer for the subset
      // already committed; a failed refresh must never obscure a save error.
      const refreshed = !needsExplorerRefresh || await updateExplorerAfterSave();
      setError(toMessage(caught) + (refreshed ? ''
        : ' Some earlier saves succeeded; refresh Explorer to see new files.'));
    } finally {
      saveInProgress.current = false;
      setBusy(false);
    }
  }

  async function saveDocumentAutomatically(document: StudioDocument): Promise<void> {
    const live = liveEditor.current.documents.find((item) => item.id === document.id);
    if (!autoSaveReview.current.canWrite(document, live, autoSaveEnabledRef.current) ||
        saveInProgress.current ||
        commandInProgress.current || selectionInProgress.current ||
        filePickerInProgress.current || nativeDialogGate.current.isActive) return;
    // A native lock covers the entire preflight, write and verified read-back.
    // No file-picker is permitted here: unnamed source files are ineligible.
    saveInProgress.current = true;
    try {
      const path = await writeSourceFile(
        document,
        false,
        () => liveEditor.current.documents
          .filter((item) => item.id !== document.id && item.path !== null)
          .map((item) => item.path as string),
        // Reject changed or closed source *before writing*, including source
        // revisions that return to identical bytes (A→B→A).
        () => {
          const current = liveEditor.current.documents.find((item) => item.id === document.id);
          return autoSaveReview.current.canWrite(document, current, autoSaveEnabledRef.current) &&
            isUnchangedSnapshot(current!, document) &&
            !commandInProgress.current && !selectionInProgress.current &&
            !filePickerInProgress.current && !nativeDialogGate.current.isActive;
        },
      );
      if (!path) return;
      dispatch({ type: 'saved', id: document.id, path, savedContent: document.content });
      const current = liveEditor.current.documents.find((item) => item.id === document.id);
      setNotice(current && isDirty(current)
        ? 'Auto saved older ' + fileName(path) + ' snapshot; newer edits remain unsaved'
        : 'Auto saved ' + fileName(path));
      setError((previous) =>
        previous?.startsWith('Auto Save failed for ') ? null : previous);
    } catch (caught) {
      setError('Auto Save failed for ' + document.name + ': ' + toMessage(caught));
    } finally {
      saveInProgress.current = false;
    }
  }

  autoSaveAction.current = (document) => {
    const current = liveEditor.current.documents.find((item) => item.id === document.id);
    if (!autoSaveReview.current.canWrite(document, current, autoSaveEnabledRef.current)) {
      return true;
    }
    if (saveInProgress.current || commandInProgress.current || selectionInProgress.current ||
        filePickerInProgress.current || nativeDialogGate.current.isActive) return false;
    void saveDocumentAutomatically(document);
    return true;
  };

  async function reloadFile(): Promise<void> {
    if (!isTauri()) {
      setError('Reload from Disk is available only in the desktop app.');
      return;
    }
    if (saveInProgress.current || filePickerInProgress.current ||
        selectionInProgress.current || commandInProgress.current) {
      setError('Finish the current file or compiler operation before reloading.');
      return;
    }
    const editorAtStart = liveEditor.current;
    const snapshot = editorAtStart.documents.find(
      (doc) => doc.id === editorAtStart.activeId,
    );
    if (!snapshot?.path) {
      setError('Save the Scarp source before reloading it from disk.');
      return;
    }
    const gate = nativeDialogGate.current;
    if (!gate.begin('reload-source')) return;
    setError(null);
    setBusy(true);
    try {
      if (isDirty(snapshot)) {
        const confirmed = await ask(
          'Discard unsaved edits to ' + snapshot.name + ' and reload its current contents from disk?',
          { title: 'Reload Scarp source?', kind: 'warning' },
        );
        if (!confirmed) return;
      }
      const stillCurrent = () => {
        const current = liveEditor.current.documents.find((doc) => doc.id === snapshot.id);
        return hasUnchangedEditorSession(editorAtStart, liveEditor.current) &&
          current !== undefined && liveEditor.current.activeId === snapshot.id &&
          isUnchangedSnapshot(current, snapshot) &&
          !saveInProgress.current && !filePickerInProgress.current &&
          !selectionInProgress.current && !commandInProgress.current;
      };
      if (!stillCurrent()) {
        setError('Source or tab changed while preparing reload. Review edits and try again.');
        return;
      }
      const content = await readScarpSource(snapshot.path);
      if (!stillCurrent()) {
        setError('Source or tab changed while reading disk. Reload was cancelled.');
        return;
      }
      dispatch({ type: 'reload', id: snapshot.id, snapshot, content });
      setNotice('Reloaded ' + snapshot.name + ' from disk');
    } catch (caught) {
      setError('Could not reload Scarp source: ' + toMessage(caught));
    } finally {
      setBusy(false);
      gate.finish('reload-source');
    }
  }

  async function approveCompilerLocation(chosen: string): Promise<boolean> {
    // Approval is per session and includes the exact resolved candidate path.
    // Scanning never grants permission to execute an arbitrary binary.
    const approved = await ask(
      'Is your trusted official Scarp compiler located at:\n' + chosen +
      '\n\nStudio will launch this executable to check its version and supported commands. Continue?',
      { title: 'Confirm Scarp compiler location', kind: 'warning' },
    );
    if (!approved) return false;
    const info = await probeScarp(chosen);
    setCompilerPath(chosen);
    setCompilerInfo(info);
    setCompilerOutputSource(null);
    pendingProblem.current = null;
    setResultsView('output');
    setCompilerDiagnosticStderr(null);
    setProjectTestResult(null);
    setCompilerNavigation(null);
    setProjectInfo(null);
    setProjectDiagnosticReport(null);
    setCompletedProjectOutput(null);
    setCompletedSourceOutput(null);
    setCompletedRunInputGeneration(null);
    setCompilerOutput(info + '\nCompiler is ready. Run operates on the saved file on disk.');
    setNotice('Scarp compiler approved for this session');
    return true;
  }

  // Shared UI uses the same native guards and session state in both locations.
  function renderCompilerSetup(location: 'settings' | 'output') {
    return <CompilerSetupPanel location={location}
      native={isTauri()} busy={busy || compilerBusy || compilerSelecting || compilerScanning}
      scanning={compilerScanning} selecting={compilerSelecting}
      approvedPath={compilerPath} compilerInfo={compilerInfo}
      candidates={detectedCompilers} selectedCandidate={automaticCompiler}
      onSelectCandidate={candidate => {
        if (detectedCompilers.includes(candidate) && !selectionInProgress.current &&
            !commandInProgress.current && !filePickerInProgress.current &&
            !saveInProgress.current && !nativeDialogGate.current.isActive) {
          setPreferredDetectedCompiler(candidate);
        }
      }}
      onScan={() => void rescanCompilers()}
      onDownload={() => void downloadCompiler()}
      onChoose={() => void selectCompiler()}
      onConfirm={() => void confirmDetectedCompiler()}
    />;
  }

  async function rescanCompilers(): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current ||
        filePickerInProgress.current || saveInProgress.current ||
        nativeDialogGate.current.isActive) return;
    selectionInProgress.current = true;
    setCompilerScanning(true);
    const requests = compilerDiscoveryRequests.current;
    const revision = requests.begin();
    try {
      const found = await detectScarp();
      if (!requests.isCurrent(revision)) return;
      setDetectedCompilers(found);
      setPreferredDetectedCompiler(null);
      setNotice(found.length
        ? 'Found ' + found.length + ' Scarp compiler candidate(s); approval required before use.'
        : 'No Scarp executable found. Download the official ZIP, extract it, then scan again.');
    } catch (caught) {
      if (requests.isCurrent(revision)) {
        setError('Compiler search failed: ' + toMessage(caught));
      }
    } finally {
      selectionInProgress.current = false;
      setCompilerScanning(false);
    }
  }

  async function downloadCompiler(): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current ||
        filePickerInProgress.current || saveInProgress.current ||
        nativeDialogGate.current.isActive) return;
    try {
      await openCompilerDownloads();
      setNotice('Opened the Scarp download destination; verify the download, extract it and scan for the compiler.');
    } catch (caught) {
      setError('Could not open official compiler download: ' + toMessage(caught));
    }
  }

  async function confirmDetectedCompiler(): Promise<void> {
    const chosen = automaticCompiler;
    if (!chosen || !isTauri() || selectionInProgress.current ||
        commandInProgress.current || filePickerInProgress.current ||
        saveInProgress.current || nativeDialogGate.current.isActive) return;
    selectionInProgress.current = true;
    setCompilerSelecting(true);
    setError(null);
    try {
      await approveCompilerLocation(chosen);
    } catch (caught) {
      setError('Compiler approval failed: ' + toMessage(caught));
    } finally {
      selectionInProgress.current = false;
      setCompilerSelecting(false);
    }
  }

  async function selectCompiler(): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current ||
        filePickerInProgress.current || saveInProgress.current ||
        nativeDialogGate.current.isActive) return;
    selectionInProgress.current = true;
    setCompilerSelecting(true);
    setError(null);
    try {
      const chosen = await open({
        title: 'Select the trusted official Scarp executable (scarp.exe on Windows)',
        multiple: false,
      });
      if (typeof chosen !== 'string') return;
      await approveCompilerLocation(chosen);
    } catch (caught) {
      setError('Compiler selection failed: ' + toMessage(caught));
    } finally {
      selectionInProgress.current = false;
      setCompilerSelecting(false);
    }
  }

  async function runCompiler(mode: ScarpMode): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current ||
        filePickerInProgress.current || nativeDialogGate.current.isActive) return;
    if (saveInProgress.current) {
      setError('Finish saving before running the compiler.');
      return;
    }
    // Captured before any optional compiler scan/trust/probe awaits.
    const inputGenerationAtStart = inputRevision.current;
    let source: string;
    let expectedContent: string;
    let verifiedSnapshot: VerifiedSourceSnapshot;
    try {
      const selected = liveEditor.current.documents.find(
        (item) => item.id === liveEditor.current.activeId,
      ) ?? null;
      source = runnableSource(selected);
      expectedContent = selected!.savedContent;
      const captured = captureVerifiedSource(selected);
      if (!captured) throw new Error('Save the Scarp source before Run or Verify.');
      verifiedSnapshot = captured;
      // First Run can locate an installed compiler; the user must approve its
      // exact path before we launch even a version probe.
      if (mode === 'exec') {
        if (stdinValidationError !== null) showCompilerSetup();
        validateProgramInput(stdinText);
      }
    } catch (caught) {
      setError(toMessage(caught));
      return;
    }
    setFocusMode(false);
    setOutputPanelMode(revealOutputPanel);
    let binary = compilerPath;
    if (!binary) {
      showCompilerSetup();
      // A first Run is one explicit user action, but it never implicitly
      // grants trust to discovered executables. The OS approval prompt names
      // the exact candidate and no source code runs before acceptance.
      selectionInProgress.current = true;
      setCompilerSelecting(true);
      try {
        // First Run may overlap the effect-owned startup scan. Its newer
        // results must win regardless of completion order.
        const requests = compilerDiscoveryRequests.current;
        const request = detectedCompilers.length ? null : requests.begin();
        const available = detectedCompilers.length ? detectedCompilers : await detectScarp();
        if (request !== null && !requests.isCurrent(request)) {
          // A superseded or unmounted first-Run scan cannot cause a trust
          // prompt, let alone launch a compiler.
          return;
        }
        setDetectedCompilers(available);
        const chosen = automaticCompiler && available.includes(automaticCompiler)
          ? automaticCompiler : available[0];
        if (!chosen) {
          setError('Scarp was not found. Download the official compiler ZIP, extract it and scan again.');
          return;
        }
        if (!await approveCompilerLocation(chosen)) return;
        binary = chosen;
      } catch (caught) {
        setError('Automatic compiler setup failed: ' + toMessage(caught));
        return;
      } finally {
        selectionInProgress.current = false;
        setCompilerSelecting(false);
      }
    }
    // Compiler scanning, trust confirmation and native probing are async.
    // Never run the older snapshot if a user typed, saved, switched the active
    // tab, or closed and reopened the source while answering the prompt.
    const current = liveEditor.current.documents.find(
      (item) => item.id === liveEditor.current.activeId,
    ) ?? null;
    if (liveEditor.current.activeId !== verifiedSnapshot.documentId ||
        !isCurrentVerifiedSource(verifiedSnapshot, current) ||
        saveInProgress.current) {
      setError('The Scarp source changed during compiler setup. Review and click Run or Verify again.');
      return;
    }
    if (mode === 'exec' &&
        !isCurrentRunInputGeneration(inputGenerationAtStart, inputRevision.current)) {
      setError('Program Input or prompt mode changed during compiler setup. ' +
        'Review the latest replies and click Run again; no source was executed.');
      return;
    }
    commandInProgress.current = true;
    setCompilerBusy(true);
    setError(null);
    setCompilerOutputSource(verifiedSnapshot);
    setCompilerDiagnosticStderr(null);
    setProjectTestResult(null);
    setCompilerNavigation(null);
    setProjectInfo(null);
    setProjectDiagnosticReport(null);
    setCompletedProjectOutput(null);
    setCompletedSourceOutput(null);
    setCompletedRunInputGeneration(null);
    setCompilerOutput((mode === 'exec' ? 'Running ' : 'Verifying ') + fileName(source) + '…');
    setResultsView('output');
    const activityToken = compilerActivity.start({ command: { scope: 'source', action: mode }, target: fileName(source), timestamp: Date.now() });
    currentActivityToken.current = activityToken;
    try {
      const result = await executeScarp(
        binary, source, mode, expectedContent,
        mode === 'exec' ? stdinText : '',
        mode === 'exec' && promptInputMode,
      );
      // The compiler operated on the saved disk snapshot captured BEFORE the
      // async probe/launch. An edit, same-content Save, Save As or close/reopen
      // while it runs makes the old output informational, not a live result.
      const staleSource = sourceResultIsStale(verifiedSnapshot, liveEditor.current.documents) || result.nativeOutcome?.sourceStale === true;
      compilerActivity.finish(activityToken, { timestamp: Date.now(), outcome: 'returned', exitCode: result.nativeOutcome?.exitCode ?? null,
        nativeOutcome: result.nativeOutcome, staleAtCompletion: staleSource, inputChanged: mode === 'exec' && inputGenerationAtStart !== inputRevision.current,
        output: result.output });
      setCompilerOutput(staleSource
        ? '[Scarp source changed while this command ran. Output below is from an earlier saved snapshot; save edits and rerun.]\n\n' + result.output
        : result.output);
      setCompilerDiagnosticStderr(staleSource ? null : result.diagnosticStderr);
      if (staleSource) setCompilerOutputSource(null);
      // If fresh on completion, edits AFTER this return still need a visible
      // warning without offering stale diagnostic navigation.
      setCompletedSourceOutput(staleSource ? null : verifiedSnapshot);
      setCompletedRunInputGeneration(mode === 'exec' ? inputGenerationAtStart : null);
      setNotice(staleSource
        ? 'Scarp result is stale; save the changed source and rerun'
        : 'Scarp ' + mode + ' finished; see output');
    } catch (caught) {
      const message = toMessage(caught);
      setCompilerOutputSource(null);
      setCompilerDiagnosticStderr(null);
      setCompletedSourceOutput(null);
      setCompletedRunInputGeneration(null);
      setCompilerOutput('Scarp ' + mode + ' could not complete:\n' + message);
      compilerActivity.finish(activityToken, { timestamp: Date.now(), outcome: 'invocation-error', exitCode: null,
        staleAtCompletion: sourceResultIsStale(verifiedSnapshot, liveEditor.current.documents),
        inputChanged: mode === 'exec' && inputGenerationAtStart !== inputRevision.current, output: message });
      setError(message);
    } finally {
      currentActivityToken.current = null;
      commandInProgress.current = false;
      setCompilerBusy(false);
    }
  }

  function showProblems(): void {
    setFocusMode(false);
    if (resultsView === 'problems' && outputPanelMode !== 'collapsed') problemsTab.current?.focus();
    else focusProblemsTab.current = true;
    setOutputPanelMode(revealOutputPanel);
    setResultsView('problems');
  }

  function navigateProblem(problem: StudioProblem): void {
    if (busy || compilerBusy || compilerSelecting || outputFreshnessWarning) return;
    const target = problem.target;
    if (!target) return;
    if (target.kind === 'test') {
      if (!projectTestResult || projectTestResult.folder !== target.folder ||
          !projectTestResult.report.tests.some(test => test.path === target.path && test.status === 'failed')) return;
      openProjectTestSource(target.path, target.folder);
      return;
    }
    const current = currentDiagnosticTarget(diagnostic, compilerOutputSource, liveEditor.current.documents);
    if (!current || !sameDiagnosticTarget(current, target)) return;
    const document = liveEditor.current.documents.find(item => item.id === current.snapshot.documentId);
    if (document) recordTrailJump(document, current.lineNumber, current.column, 'diagnostic');
    pendingInsightJump.current = null;
    pendingSearchLocation.current = null;
    const editor = mountedEditor.current;
    if (liveEditor.current.activeId === current.snapshot.documentId && mountedEditorDocumentId.current === current.snapshot.documentId && editor && editor.getModel()?.getValue() === current.snapshot.content) {
      pendingProblem.current = null;
      editor.setPosition(current);
      editor.revealPositionInCenter(current);
      editor.focus();
    } else {
      pendingProblem.current = current;
      dispatch({ type: 'activate', id: current.snapshot.documentId });
    }
  }

  function revealDiagnostic(): void {
    if (navigableDiagnostic) navigateProblem(navigableDiagnostic);
  }

  function openProjectTestSource(testPath: string, reportFolder: string): void {
    if (recoveryOperationsBlocked() || outputFreshnessWarning || !projectTestResult ||
        !sameFilePath(projectTestResult.folder, reportFolder) ||
        !projectTestResult.report.tests.some(test => test.path === testPath)) return;
    // Re-resolve on click: the report may outlive an Explorer refresh or
    // project change. The shared openFolderFile path also rejects stale
    // async reads and preserves existing dirty editor buffers.
    const path = resolveListedTestSource(
      testPath, reportFolder, selectedFolderRef.current,
    );
    if (!path || !selectedProjectPath || !sameFilePath(selectedProjectPath, reportFolder)) {
      setError('This test source is not in the current Scarp Explorer listing. Refresh Explorer and try again.');
      return;
    }
    void openFolderFile(path);
  }

  function chooseProjectTarget(directory: string): void {
    if (commandInProgress.current || saveInProgress.current ||
        filePickerInProgress.current || selectionInProgress.current ||
        nativeDialogGate.current.isActive) return;
    if (!projectRoots.some(root => root.directory === directory)) return;
    if (directory === projectDirectory) return;
    setProjectDirectory(directory);
    projectResultEpoch.current++;
    setProjectTestResult(null);
    setCompilerNavigation(null);
    setProjectInfo(null);
    setProjectDiagnosticReport(null);
    setNotice(directory ? 'Selected Scarp project: ' + directory
      : 'Selected workspace root for project commands');
  }

  async function runProjectAction(action: ScarpProjectAction, testFilter?: string): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current ||
        saveInProgress.current || filePickerInProgress.current ||
        nativeDialogGate.current.isActive) return;
    if (!compilerPath || !selectedProjectPath) {
      if (!compilerPath) showCompilerSetup();
      setError(!compilerPath
        ? 'Select the official compiler first.'
        : 'Choose a discovered manifest-bearing Scarp project target first.');
      return;
    }
    if (!selectedProjectHasManifest) {
      setError('The chosen project folder has no discovered scarp.project manifest. ' +
        'Select a manifest-bearing project target or refresh the Explorer.');
      return;
    }
    if (projectActionRequiresSavedSources(action)) {
      try {
        if (action === 'run') validateProgramInput(stdinText);
        // Disk-backed project actions cannot reflect unsaved source edits.
        // Only tabs belonging to this project matter; unrelated and untitled
        // documents should not prevent working with the selected project.
        const dirtySources = dirtyProjectSourceNames(liveEditor.current.documents, selectedProjectPath);
        if (dirtySources.length) {
          const names = dirtySources.slice(0, 3).join(', ');
          const remaining = dirtySources.length > 3 ? ' and ' + (dirtySources.length - 3) + ' more' : '';
          throw new Error(
            'Save modified project source files before ' + action + ': ' +
            names + remaining + '. Project commands read files saved on disk.',
          );
        }
      } catch (caught) {
        setError(toMessage(caught));
        return;
      }
    }
    const diskPlan=projectActionRequiresSavedSources(action)
      ?planProjectCommandDiskCheck(liveEditor.current.documents,selectedProjectPath):null;
    if(diskPlan&&!diskPlan.ok){setError(diskPlan.error);return;}
    setProjectDiskEvidence(null);
    setFocusMode(false);
    setOutputPanelMode(revealOutputPanel);
    // Capture the current listing instance AND the selected-project source
    // generation before the async compiler begins. Edits during Run Tests can
    // leave its disk-backed JSON report stale by the time the process exits.
    const reportEpoch = projectResultEpoch.current;
    const reportSelection = selectedFolderRef.current;
    const inputGenerationAtStart = inputRevision.current;
    commandInProgress.current = true;
    setCompilerBusy(true);
    setError(null);
    // Project operations may inspect other files. They never assign an editor
    // diagnostic position to the current open tab.
    pendingProblem.current = null;
    setResultsView('output');
    setCompilerDiagnosticStderr(null);
    setCompilerOutputSource(null);
    setProjectTestResult(null);
    setCompilerNavigation(null);
    setProjectInfo(null);
    setProjectDiagnosticReport(null);
    setCompletedProjectOutput(null);
    setCompletedSourceOutput(null);
    setCompletedRunInputGeneration(null);
    setCompilerOutput('Scarp project ' + action + '…');
    const activityToken = compilerActivity.start({ command: { scope: 'project', action },
      target: fileName(selectedProjectPath), timestamp: Date.now() });
    currentActivityToken.current = activityToken;
    try {
      const guard=diskPlan?.ok?diskPlan.value:null;
      const preflight={cancelled:false};
      const isCurrent=()=>!preflight.cancelled&&reportEpoch===projectResultEpoch.current&&
        reportSelection===selectedFolderRef.current&&
        (action!=='run'||inputGenerationAtStart===inputRevision.current)&&
        (!guard||projectCommandDiskPlanCurrent(guard,liveEditor.current.documents));
      let beforeReview:Awaited<ReturnType<typeof checkProjectCommandDisk>>|null=null;
      if(guard){
        projectPreflight.current=preflight;
        try{
          beforeReview=await checkProjectCommandDisk(guard,readScarpSource,isCurrent);
        }finally{projectPreflight.current=null;}
        setProjectDiskEvidence({folder:selectedProjectPath,before:beforeReview,after:null});
        const problem=projectDiskCheckMessage(beforeReview,'before');
        if(problem||!isCurrent())throw new Error(problem??'Project command was not launched because the editor changed.');
      }
      const output = await scarpProjectAction(
        compilerPath, selectedProjectPath, action,
        action === 'run' ? stdinText : '',
        action === 'run' && promptInputMode,
        testFilter,
      );
      const afterReview=guard?await checkProjectCommandDisk(guard,readScarpSource,isCurrent):null;
      if(guard)setProjectDiskEvidence({folder:selectedProjectPath,before:beforeReview,after:afterReview});
      const freshness = applyProjectDiskFreshness(projectResultFreshness(
        action,
        { epoch: reportEpoch, listing: reportSelection },
        { epoch: projectResultEpoch.current, listing: selectedFolderRef.current },
      ),afterReview);
      compilerActivity.finish(activityToken, { timestamp: Date.now(), outcome: 'returned', exitCode: output.exitCode,
        nativeOutcome: output.nativeOutcome, staleAtCompletion: freshness.stale, inputChanged: action === 'run' && inputGenerationAtStart !== inputRevision.current,
        output: output.output });
      setCompilerOutput(freshness.warning
        ? freshness.warning + '\n\n' + output.output
        : output.output);
      // A fresh result can still become obsolete after completion: retain
      // source generation and listing identity for a live output warning.
      setCompletedProjectOutput(freshness.stale ? null : {
        action, epoch: reportEpoch, listing: reportSelection,
      });
      setCompletedRunInputGeneration(action === 'run' ? inputGenerationAtStart : null);
      // Trust the schema, requested command AND exact native process exit.
      // An incongruent test report cannot present a fabricated pass/fail.
      const structured = freshness.allowStructuredTests
        ? parseScarpTestReportForAction(output.testReportJson, action, output.exitCode, testFilter)
        : null;
      if (structured) {
        setProjectTestResult({ folder: selectedProjectPath, report: structured });
      }
      if (!freshness.stale && output.diagnosticStderr !== undefined &&
          (action === 'verify' || action === 'inspect-symbols' || action === 'inspect-references')) {
        const parsed = parseDiagnosticReport(output.diagnosticStderr, action);
        if (parsed.ok) setProjectDiagnosticReport(parsed.report);
      }
      if (!freshness.stale && action === 'info' && output.projectInfoJson !== undefined) {
        const parsed = parseProjectInfo(output.projectInfoJson);
        if (parsed.ok) setProjectInfo({ folder: selectedProjectPath, info: parsed.info });
        else setError(parsed.reason + ' Raw project output remains available.');
      }
      if (!freshness.stale && (action === 'inspect-symbols' || action === 'inspect-references')) {
        if (output.inspectionJson !== undefined) {
          const parsed = parseCompilerNavigation(output.inspectionJson, action);
          if (parsed.ok) setCompilerNavigation(parsed.report);
          else setError(parsed.reason + ' Raw output remains available.');
        } else if (output.exitCode === 0) {
          setError('No complete trusted static inspection report was returned. Raw output remains available.');
        }
      }
      setNotice(freshness.stale
        ? 'Scarp project ' + action + ' result is stale; save changed sources and rerun'
        : 'Scarp project ' + action + ' finished');
    } catch (caught) {
      const message = toMessage(caught);
      setCompilerOutput('Scarp project ' + action + ' could not complete:\n' + message);
      compilerActivity.finish(activityToken, { timestamp: Date.now(), outcome: 'invocation-error', exitCode: null,
        staleAtCompletion: projectResultFreshness(action, { epoch: reportEpoch, listing: reportSelection },
          { epoch: projectResultEpoch.current, listing: selectedFolderRef.current }).stale,
        inputChanged: action === 'run' && inputGenerationAtStart !== inputRevision.current, output: message });
      setError(message);
    } finally {
      projectPreflight.current=null;
      currentActivityToken.current = null;
      commandInProgress.current = false;
      setCompilerBusy(false);
    }
  }

  async function stopCompiler(): Promise<void> {
    if (!isTauri()) return;
    if(projectPreflight.current){
      projectPreflight.current.cancelled=true;
      compilerActivity.markStopRequested(currentActivityToken.current);
      setNotice('Project source check cancellation requested; no compiler process will be launched.');
      return;
    }
    const activityToken = currentActivityToken.current;
    try {
      const stopping = await stopScarp();
      if (stopping) compilerActivity.markStopRequested(activityToken);
      setNotice(stopping ? 'Scarp stop signal sent' : 'No active Scarp process to stop');
    } catch (caught) {
      setError('Could not stop Scarp: ' + toMessage(caught));
    }
  }

  function revealSearchLocation(
    editorInstance: Monaco.editor.IStandaloneCodeEditor, match: OpenFileSearchHit,
  ): void {
    const selection = {
      startLineNumber: match.line,
      startColumn: match.column,
      endLineNumber: match.line,
      endColumn: match.column + match.matchText.length,
    };
    editorInstance.setSelection(selection);
    editorInstance.revealRangeInCenter(selection);
    editorInstance.focus();
  }

  async function stageProjectReplacements(result: ProjectSearchResult, request: ReplacementRequest):
    Promise<ReplacementResult<ProjectReplacementPlan>> {
    const fail = (error: string): ReplacementResult<never> => ({ok:false,error});
    const selection = selectedFolderRef.current;
    if (!isTauri() || recoveryOperationsBlocked() || !selection || !projectSearchResult ||
        result !== projectSearchResult.result || selection !== projectSearchResult.selection ||
        request.query !== searchQuery || request.options.caseSensitive !== searchCaseSensitive ||
        request.options.wholeWord !== searchWholeWord) return fail('Search or workspace changed. Search again.');
    const prepared = prepareProjectReplacement(result,request,selection.files,liveEditor.current);
    if (!prepared.ok) return prepared;
    const inventory = prepared.value;
    const epoch = projectSearchEpoch.current;
    const current = () => epoch === projectSearchEpoch.current && selection === selectedFolderRef.current &&
      projectReplacementInventoryIsCurrent(inventory,liveEditor.current);
    filePickerInProgress.current = true;
    setBusy(true);
    try {
      const read = await readProjectReplacementSources(inventory,
        (path,maxBytes) => readScarpSource(path,maxBytes),current);
      if (!read.ok) return read;
      if (!current()) return fail('Workspace or editor changed. Search again.');
      if (read.value.length) dispatch({type:'restore-workspace-tabs',files:read.value,activePath:null});
      return planStagedProjectReplacement(inventory,liveEditor.current);
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  function applyProjectReplacements(plan: ProjectReplacementPlan): boolean {
    if (recoveryOperationsBlocked() || !projectSearchResult ||
        plan.inventory.result !== projectSearchResult.result ||
        projectSearchResult.selection !== selectedFolderRef.current ||
        plan.inventory.request.query !== searchQuery ||
        plan.inventory.request.options.caseSensitive !== searchCaseSensitive ||
        plan.inventory.request.options.wholeWord !== searchWholeWord ||
        !stagedProjectReplacementIsCurrent(plan,liveEditor.current)) {
      setError('Workspace replacement preview changed. No source was modified.');
      return false;
    }
    const before=liveEditor.current.documents;
    dispatch({type:'replace-open-files',changes:plan.changes,allSnapshots:before});
    const after=liveEditor.current.documents;
    if (before===after) return false;
    autoSaveReview.current.holdReplacements(after,plan.changes.map(change=>change.id));
    setProjectReplacementUndo(createOpenFileReplaceUndo(before,after));
    setError(null);
    setNotice('Applied reviewed workspace replacements in editor memory. Review or Undo, then Save manually.');
    return true;
  }

  function undoProjectReplacements(): void {
    const undo=projectReplacementUndo;
    if(recoveryOperationsBlocked()||!undo||!canUndoOpenFileReplace(undo,liveEditor.current)){
      setError('Workspace replacement undo is no longer current. No changes discarded.');
      return;
    }
    dispatch({type:'replace-open-files',changes:undo.changes,allSnapshots:undo.after});
    autoSaveReview.current.holdReplacements(liveEditor.current.documents,undo.changes.map(change=>change.id));
    setProjectReplacementUndo(null);setError(null);setNotice('Undid workspace replacements in memory.');
  }

  async function runProjectSearchSweep(plan: SearchSweepPlan, control: SweepControl): Promise<SweepExecution> {
    const selection = selectedFolderRef.current;
    if (!isTauri() || !selection || recoveryOperationsBlocked() || compilerBusy || compilerSelecting || compilerScanning) {
      setError('Finish active native operations and choose a project before running a sweep.');
      return {kind:'invalidated'};
    }
    const settings = { query: searchQuery, options: {caseSensitive:searchCaseSensitive, wholeWord:searchWholeWord}, scope:projectSearchScope };
    const confirmed = confirmSearchSweep(plan, selection.files, settings);
    if (!confirmed.ok) {
      setError(confirmed.error);
      return {kind:'invalidated'};
    }
    const snapshot = liveEditor.current;
    const ticket = ++projectSearchEpoch.current;
    const current = () => control.isCurrent() && ticket === projectSearchEpoch.current &&
      selection === selectedFolderRef.current && snapshot.sessionRevision === liveEditor.current.sessionRevision;
    filePickerInProgress.current = true;
    setBusy(true);
    setProjectSearchResult(null);
    setError(null);
    setNotice('Running reviewed project search sweep.');
    try {
      const result = await executeSearchSweep(confirmed.value, snapshot.documents,
        (path,maxBytes) => readScarpSource(path,maxBytes), {...control,isCurrent:current});
      if (result.kind === 'report' && current()) {
        setNotice('Search sweep '+result.report.status+'; '+result.report.batches.length+
          ' completed batch observation(s). No files changed.');
      }
      return current() ? result : {kind:'invalidated'};
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  async function searchSelectedProject(): Promise<void> {
    const selection = selectedFolderRef.current;
    if (!isTauri() || !selection) {
      setError('Choose a Scarp project folder in the desktop app before searching.');
      return;
    }
    if (!searchQuery || searchQuery.length > 120) {
      setError('Enter a search term of at most 120 characters first.');
      return;
    }
    if (filePickerInProgress.current || saveInProgress.current ||
        selectionInProgress.current || commandInProgress.current ||
        nativeDialogGate.current.isActive) {
      setError('Finish the current file or compiler operation before project search.');
      return;
    }
    const scoped=planScopedProjectSearch(buildProjectScopeInventory(selection.files),projectSearchScope);
    if(!scoped.ok){setError(scoped.error);return;}
    if(!scoped.value.sources.length){setError('No eligible listed sources match the project search scope.');return;}
    const snapshot = liveEditor.current;
    const ticket = ++projectSearchEpoch.current;
    const current = () => ticket === projectSearchEpoch.current &&
      selection === selectedFolderRef.current &&
      snapshot.sessionRevision === liveEditor.current.sessionRevision;
    const options = { caseSensitive: searchCaseSensitive, wholeWord: searchWholeWord };
    filePickerInProgress.current = true;
    setBusy(true);
    setProjectSearchResult(null);
    setError(null);
    try {
      const result = await searchListedProjectSources(
        scoped.value.sources, snapshot.documents, searchQuery, options,
        (path, maxBytes) => readScarpSource(path, maxBytes), current,
      );
      if (!result || !current()) return;
      if (result.error) {
        setError('Could not search the project: ' + result.error);
        return;
      }
      const coverage=summarizeScopedSearch(scoped.value,result);
      if(!coverage.ok){setError(coverage.error);return;}
      setProjectSearchResult({ selection, query: searchQuery, result, coverage:coverage.value });
      setNotice('Project search: ' + result.hits.length + ' match(es) in ' +
        result.searchedFiles + ' fully scanned source(s)' +
        (coverage.value.batch ? ' in batch '+coverage.value.batch.index+' of '+coverage.value.batch.total : '') +
        (coverage.value.incomplete ? ' (incomplete scope coverage)' : ''));
    } catch (caught) {
      if (current()) setError('Project search failed: ' + toMessage(caught));
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  async function goToProjectSearchHit(
    hit: ProjectSearchHit, selection: { path: string; files: FolderEntry[] },
  ): Promise<void> {
    if (selectedFolderRef.current !== selection) {
      setError('The selected project listing changed. Search the project again.');
      return;
    }
    const decision = resolveListedProjectOpen(
      hit.path, selection.files, liveEditor.current.documents,
    );
    if (decision.kind === 'not-listed') {
      setError('This source is no longer listed. Refresh Explorer and search again.');
      return;
    }
    if (decision.kind === 'activate') {
      const live = liveEditor.current.documents.find((item) => item.id === decision.documentId);
      if (!live || (hit.fromOpenTab
        ? !isCurrentSearchHit(live, hit.match)
        : live.content !== hit.match.sourceContent ||
          live.savedContent !== hit.match.sourceContent)) {
        setError('This project search result is stale. Search again before navigating.');
        return;
      }
      goToSearchMatch({ ...hit.match, documentId: live.id, sourceRevision: live.revision });
      return;
    }
    // A saved source may have been edited externally since search. Reopen
    // through the SAME scoped listing and require exact content before jumping.
    if (hit.fromOpenTab || filePickerInProgress.current ||
        saveInProgress.current || selectionInProgress.current ||
        commandInProgress.current || nativeDialogGate.current.isActive) {
      setError('The source or editor state changed. Search again to navigate safely.');
      return;
    }
    const snapshot = liveEditor.current;
    const activeAtStart = snapshot.activeId;
    const activeSnapshot = currentActiveDocument(snapshot);
    const ticket = projectSearchEpoch.current;
    filePickerInProgress.current = true;
    setBusy(true);
    setError(null);
    try {
      const content = await readFolderSource(decision.path, selection.files);
      if (ticket !== projectSearchEpoch.current ||
          !hasUnchangedEditorSession(snapshot, liveEditor.current) ||
          !isCurrentListedSourceRead(
            selection, selectedFolderRef.current, activeAtStart,
            activeSnapshot, liveEditor.current,
          )) {
        setError('The project or editor changed while opening this search hit. Search again.');
        return;
      }
      if (content !== hit.match.sourceContent) {
        setError('This Scarp source changed on disk after the search. Search again.');
        return;
      }
      activateOpenedFile(decision.path, content);
      const opened = currentActiveDocument(liveEditor.current);
      if (opened?.path && sameFilePath(opened.path, decision.path)) {
        // Use the new editor ID/revision, never the temporary search snapshot.
        pendingSearchLocation.current = {
          ...hit.match, documentId: opened.id, sourceRevision: opened.revision,
        };
      }
    } catch (caught) {
      setError('Could not open project search result: ' + toMessage(caught));
    } finally {
      filePickerInProgress.current = false;
      setBusy(false);
    }
  }

  function captureSourceCheckpoint(review: CheckpointCaptureReview): boolean {
    if (recoveryOperationsBlocked()) return false;
    const result = sourceCheckpoints.capture(review, liveEditor.current, Date.now());
    if (!result.ok) { setError(result.error); return false; }
    setError(null);
    setNotice('Captured a session-only checkpoint for ' + result.value.documentName + '.');
    return true;
  }

  function removeSourceCheckpoints(review: CheckpointRemovalReview): boolean {
    if (recoveryOperationsBlocked() || !sourceCheckpoints.remove(review)) return false;
    setNotice('Removed reviewed session checkpoints. Source buffers are unchanged.');
    setError(null);
    return true;
  }

  function restoreSourceCheckpoint(review: CheckpointRestoreReview): boolean {
    const current = liveEditor.current;
    if (recoveryOperationsBlocked() || !checkpointRestoreIsCurrent(review, sourceCheckpoints.getSnapshot(), current)) {
      setError('Checkpoint review is stale or a native operation is active. No source changed.');
      return false;
    }
    const before = current.documents;
    dispatch({ type: 'replace-open-files', changes: [review.change], allSnapshots: before });
    const after = liveEditor.current.documents;
    if (before === after) return false;
    autoSaveReview.current.holdReplacements(after, [review.change.id]);
    setCheckpointUndo(createOpenFileReplaceUndo(before, after));
    setError(null); setNotice('Restored checkpoint text in memory. Review, Undo or Save manually.');
    return true;
  }

  function undoSourceCheckpointRestore(): void {
    if (recoveryOperationsBlocked() || !checkpointUndo || !canUndoOpenFileReplace(checkpointUndo, liveEditor.current)) {
      setError('Checkpoint undo is stale or a native operation is active. No source changed.');
      return;
    }
    dispatch({ type: 'replace-open-files', changes: checkpointUndo.changes, allSnapshots: checkpointUndo.after });
    autoSaveReview.current.holdReplacements(liveEditor.current.documents, checkpointUndo.changes.map(change => change.id));
    setCheckpointUndo(null); setError(null); setNotice('Undid checkpoint restore in memory.');
  }

  function applyBufferTransfer(plan: BufferTransferPlan): boolean {
    const current = liveEditor.current;
    if (recoveryOperationsBlocked() || !bufferTransferIsCurrent(plan, current)) {
      setError('Buffer transfer review is stale or a native operation is active. Nothing changed.');
      return false;
    }
    const before = current.documents;
    dispatch({ type: 'replace-open-files', changes: [plan.change], allSnapshots: before });
    const after = liveEditor.current.documents;
    if (before === after) return false;
    autoSaveReview.current.holdReplacements(after, [plan.change.id]);
    setBufferTransferUndo(createOpenFileReplaceUndo(before, after));
    setError(null); setNotice('Applied reviewed transfer in memory. Review or Undo, then Save manually.');
    return true;
  }

  function undoBufferTransfer(): void {
    if (recoveryOperationsBlocked() || !bufferTransferUndo || !canUndoOpenFileReplace(bufferTransferUndo, liveEditor.current)) {
      setError('Buffer transfer undo is stale or a native operation is active. Nothing changed.');
      return;
    }
    dispatch({ type: 'replace-open-files', changes: bufferTransferUndo.changes, allSnapshots: bufferTransferUndo.after });
    autoSaveReview.current.holdReplacements(liveEditor.current.documents, bufferTransferUndo.changes.map(change => change.id));
    setBufferTransferUndo(null); setError(null); setNotice('Undid buffer transfer in memory.');
  }

  function applyIdentifierEdit(plan: IdentifierEditPlan): boolean {
    const current = liveEditor.current;
    if (recoveryOperationsBlocked() || !identifierPlanIsCurrent(plan, current)) {
      setError('Identifier review is stale or a native operation is active. Nothing changed.');
      return false;
    }
    const before = current.documents;
    dispatch({ type: 'replace-open-files', changes: plan.changes, allSnapshots: before });
    const after = liveEditor.current.documents;
    if (before === after) return false;
    autoSaveReview.current.holdReplacements(after, plan.changes.map(change => change.id));
    setIdentifierUndo(createOpenFileReplaceUndo(before, after));
    setError(null); setNotice('Applied selected literal identifier edits in memory. Review or Undo before Save.');
    return true;
  }

  function undoIdentifierEdit(): void {
    if (recoveryOperationsBlocked() || !identifierUndo || !canUndoOpenFileReplace(identifierUndo, liveEditor.current)) {
      setError('Identifier edit undo is stale or a native operation is active. Nothing changed.');
      return;
    }
    dispatch({ type: 'replace-open-files', changes: identifierUndo.changes, allSnapshots: identifierUndo.after });
    autoSaveReview.current.holdReplacements(liveEditor.current.documents, identifierUndo.changes.map(change => change.id));
    setIdentifierUndo(null); setError(null); setNotice('Undid identifier edits in open buffers.');
  }

  function captureEditorSelections(): SelectionResult<SelectionCapture> {
    const current=liveEditor.current;
    const editor=mountedEditor.current;
    const model=editor?.getModel();
    if(recoveryOperationsBlocked()||!editor||!model||mountedEditorDocumentId.current!==current.activeId)
      return {ok:false,error:'The current editor is not ready for selection capture.'};
    const spans=(editor.getSelections()??[]).map(range=>({
      start:model.getOffsetAt(range.getStartPosition()),end:model.getOffsetAt(range.getEndPosition()),
    }));
    return captureSelections(current,model.getValue(),spans);
  }
  function applySelectionEdit(plan:SelectionEditPlan):boolean {
    const current=liveEditor.current;
    const fresh=captureEditorSelections();
    if(!fresh.ok||!selectionEditIsCurrent(plan,current)||
      !selectionMatchesLive(plan.capture,fresh.value.document.content,fresh.value.spans)){
      setError('Selection review or current selected ranges changed. No source changed.');
      return false;
    }
    const before=current.documents;
    dispatch({type:'replace-open-files',changes:[plan.change],allSnapshots:before});
    const after=liveEditor.current.documents;
    if(before===after)return false;
    autoSaveReview.current.holdReplacements(after,[plan.change.id]);
    setSelectionEditUndo(createOpenFileReplaceUndo(before,after));
    setError(null);setNotice('Applied reviewed selection transformation in memory. Review or Undo before saving.');
    return true;
  }
  function undoSelectionEdit():void{
    if(recoveryOperationsBlocked()||!selectionEditUndo||!canUndoOpenFileReplace(selectionEditUndo,liveEditor.current)){
      setError('Selection undo is stale or another operation is active. No source changed.');return;
    }
    dispatch({type:'replace-open-files',changes:selectionEditUndo.changes,allSnapshots:selectionEditUndo.after});
    autoSaveReview.current.holdReplacements(liveEditor.current.documents,selectionEditUndo.changes.map(change=>change.id));
    setSelectionEditUndo(null);setError(null);setNotice('Undid reviewed selection transformation.');
  }

  function applyLineRange(plan: LineRangePlan): boolean {
    const current = liveEditor.current;
    if (recoveryOperationsBlocked() || !lineRangePlanIsCurrent(plan, current)) {
      setError('Line transformation review is stale or a native operation is active. No source changed.');
      return false;
    }
    const before = current.documents;
    dispatch({ type: 'replace-open-files', changes: [plan.change], allSnapshots: before });
    const after = liveEditor.current.documents;
    if (before === after) return false;
    autoSaveReview.current.holdReplacements(after, [plan.change.id]);
    setLineRangeUndo(createOpenFileReplaceUndo(before, after));
    setError(null); setNotice('Applied reviewed line transformation in memory. Review or Undo, then Save manually.');
    return true;
  }

  function undoLineRange(): void {
    if (recoveryOperationsBlocked() || !lineRangeUndo || !canUndoOpenFileReplace(lineRangeUndo, liveEditor.current)) {
      setError('Line transformation undo is stale or a native operation is active. No source changed.');
      return;
    }
    dispatch({ type: 'replace-open-files', changes: lineRangeUndo.changes, allSnapshots: lineRangeUndo.after });
    autoSaveReview.current.holdReplacements(liveEditor.current.documents, lineRangeUndo.changes.map(change => change.id));
    setLineRangeUndo(null); setError(null); setNotice('Undid line transformation in the editor buffer.');
  }

  function applyQualityCleanup(plan: QualityCleanupPlan): boolean {
    if (recoveryOperationsBlocked() || !qualityPlanIsCurrent(plan, liveEditor.current)) {
      setError('Source quality preview is stale or a native operation is active. Nothing changed.');
      return false;
    }
    const before = liveEditor.current.documents;
    dispatch({ type: 'replace-open-files', changes: plan.changes, allSnapshots: plan.snapshots });
    const after = liveEditor.current.documents;
    if (before === after) { setError('Cleanup did not apply. Review again.'); return false; }
    autoSaveReview.current.holdReplacements(after, plan.changes.map(change => change.id));
    setQualityUndo(createOpenFileReplaceUndo(before, after));
    setError(null);
    setNotice('Source quality cleanup applied to editor buffers. Review or Undo, then Save manually.');
    return true;
  }

  function undoQualityCleanup(): void {
    if (recoveryOperationsBlocked() || !qualityUndo || !canUndoOpenFileReplace(qualityUndo, liveEditor.current)) {
      setError('Quality cleanup undo is unavailable because a buffer changed or an operation is active.');
      return;
    }
    dispatch({ type: 'replace-open-files', changes: qualityUndo.changes, allSnapshots: qualityUndo.after });
    autoSaveReview.current.holdReplacements(liveEditor.current.documents, qualityUndo.changes.map(change => change.id));
    setQualityUndo(null); setError(null);
    setNotice('Undid quality cleanup in editor buffers. No disk files changed.');
  }

  function previewOpenFileReplacement(): void {
    setError(null);
    try {
      const plan = planOpenFileReplacement(
        liveEditor.current.documents, searchQuery, replaceText,
        { caseSensitive: searchCaseSensitive, wholeWord: searchWholeWord },
      );
      setReplacePreview(plan);
      setNotice('Previewing ' + plan.totalReplacements + ' replacement(s) in ' +
        plan.changes.length + ' open Scarp source(s). No files changed.');
    } catch (caught) {
      setReplacePreview(null);
      setError('Could not preview replacements: ' + toMessage(caught));
    }
  }

  async function confirmOpenFileReplacement(): Promise<void> {
    const plan = replacePreview;
    if (!plan) return;
    if (!isTauri()) {
      setError('Confirming replacements requires the Scarp Studio desktop app.');
      return;
    }
    if (saveInProgress.current || filePickerInProgress.current ||
        selectionInProgress.current || commandInProgress.current) {
      setError('Finish the active file or compiler operation before replacing text.');
      return;
    }
    const previewIsCurrent = () => plan.query === searchQuery &&
      plan.replacement === replaceText &&
      plan.options.caseSensitive === searchCaseSensitive &&
      plan.options.wholeWord === searchWholeWord &&
      sameOpenDocumentSnapshots(plan.sourceSnapshots, liveEditor.current.documents) &&
      canApplyReplacementSnapshots(liveEditor.current, plan.changes);
    if (!previewIsCurrent()) {
      setReplacePreview(null);
      setError('Source text or search options changed. Preview replacements again.');
      return;
    }
    const gate = nativeDialogGate.current;
    if (!gate.begin('replace-open-files')) return;
    setBusy(true);
    setError(null);
    try {
      const approved = await ask(
        'Replace ' + plan.totalReplacements + ' occurrence(s) in ' + plan.changes.length +
          ' open Scarp source(s)? The replacements stay in editor buffers until you explicitly Save or Save All. ' +
          'Auto Save will NOT write these replacement snapshots, even if enabled. ' +
          'Save or Undo now; further typing resumes Auto Save for that edited file.',
        { title: 'Confirm open-buffer replacements', kind: 'warning' },
      );
      if (!approved) return;
      // The final preflight is all-or-nothing after native confirmation:
      // no replacement may partly apply if the user edited another tab.
      if (!previewIsCurrent()) {
        setReplacePreview(null);
        setError('At least one source changed during confirmation. Nothing was replaced.');
        return;
      }
      dispatch({ type: 'replace-open-files', changes: plan.changes, allSnapshots: plan.sourceSnapshots });
      autoSaveReview.current.holdReplacements(
        liveEditor.current.documents, plan.changes.map((change) => change.id),
      );
      setReplaceUndo(createOpenFileReplaceUndo(plan.sourceSnapshots, liveEditor.current.documents));
      setReplacePreview(null);
      setNotice('Replaced ' + plan.totalReplacements + ' occurrence(s) in ' +
        plan.changes.length + ' editor buffer(s). Review or Undo, then Save manually; further editing resumes Auto Save.');
    } catch (caught) {
      setError('Could not confirm replacements: ' + toMessage(caught));
    } finally {
      setBusy(false);
      gate.finish('replace-open-files');
    }
  }

  function undoLastOpenFileReplace(): void {
    const undo = replaceUndo;
    if (!undo || !canUndoOpenFileReplace(undo, liveEditor.current)) {
      setReplaceUndo(null);
      setError('Undo is unavailable because an open Scarp source changed. No edits were discarded.');
      return;
    }
    if (saveInProgress.current || filePickerInProgress.current ||
        selectionInProgress.current || commandInProgress.current ||
        nativeDialogGate.current.isActive) {
      setError('Finish the current file or compiler operation before undoing Replace All.');
      return;
    }
    dispatch({
      type: 'replace-open-files',
      changes: undo.changes,
      allSnapshots: undo.after,
    });
    setReplaceUndo(null);
    setReplacePreview(null);
    setError(null);
    setNotice('Undid last Replace All in ' + undo.changes.length +
      ' open buffer(s); no files on disk were changed.');
  }

  function goToSearchMatch(match: OpenFileSearchHit): void {
    // A click must not navigate to a position computed for earlier buffer contents.
    const current = liveEditor.current;
    const document = current.documents.find((item) => item.id === match.documentId);
    if (!document || !isCurrentSearchHit(document, match)) {
      setError('Search results changed. Review the updated matches and try again.');
      return;
    }
    recordTrailJump(document, match.line, match.column, 'search');
    pendingInsightJump.current = null;
    pendingProblem.current = null;
    pendingSearchLocation.current = match;
    if (current.activeId === document.id && mountedEditor.current &&
        mountedEditorDocumentId.current === document.id) {
      revealSearchLocation(mountedEditor.current, match);
      pendingSearchLocation.current = null;
    } else {
      dispatch({ type: 'activate', id: document.id });
    }
  }

  function closeSelectedCleanTabs(selections: readonly TabSelection[]): boolean {
    // Share the live native-operation guards; never interfere with pending
    // writes, compiler reads, picker operations or discard confirmations.
    if (saveInProgress.current || filePickerInProgress.current ||
        commandInProgress.current || selectionInProgress.current ||
        nativeDialogGate.current.isActive) {
      setError('Finish the current operation before closing selected tabs.');
      return false;
    }
    const before = liveEditor.current;
    const snapshots = resolveBulkClose(selections, before.documents);
    if (!snapshots) {
      setError('The selected tabs changed. Review your selection and try again.');
      return false;
    }
    dispatch({ type: 'close-clean-tabs', snapshots });
    if (liveEditor.current === before) {
      setError('The selected tabs could not be closed safely.');
      return false;
    }
    setError(null);
    setNotice('Closed ' + snapshots.length + ' saved tab(s). No source files changed.');
    return true;
  }

  function activateManagedTab(snapshot: StudioDocument): void {
    const current = liveEditor.current.documents.find(document => document.id === snapshot.id);
    if (!current || !isUnchangedSnapshot(current, snapshot)) {
      setError('This editor tab changed. Choose its current entry again.');
      return;
    }
    dispatch({ type: 'activate', id: current.id });
  }

  async function closeFile(id: string): Promise<void> {
    if (saveInProgress.current || filePickerInProgress.current ||
        selectionInProgress.current) {
      setError('Finish the current file operation before closing a tab.');
      return;
    }
    // Ctrl+W and close buttons can be pressed repeatedly while ask() is pending.
    // Also block tab closes during the window-exit confirmation.
    const gate = nativeDialogGate.current;
    if (!gate.begin('tab-close')) return;
    try {
      const document = liveEditor.current.documents.find((item) => item.id === id);
      if (!document) return;
      if (isDirty(document)) {
        try {
          const discard = await ask('Discard unsaved changes to ' + document.name + '?', {
            title: 'Close file',
            kind: 'warning',
          });
          if (!discard) return;
        } catch (caught) {
          setError('Could not confirm close: ' + toMessage(caught));
          return;
        }
      }
      const current = liveEditor.current.documents.find((item) => item.id === id);
      if (saveInProgress.current || !current || !isUnchangedSnapshot(current, document)) {
        setError('The file changed while confirming close. Review the changes and try again.');
        return;
      }
      dispatch({ type: 'close', id, snapshot: document });
      setNotice('Closed ' + document.name);
    } finally {
      gate.finish('tab-close');
    }
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented || event.getModifierState('AltGraph')) return;
      if (paletteMode !== null && event.key === 'Escape') {
        event.preventDefault();
        hidePalette();
        return;
      }
      if (paletteMode === null && event.key === 'Escape' && editorSettingsOpen) {
        event.preventDefault();
        setEditorSettingsOpen(false);
        return;
      }
      if (paletteMode === null && event.key === 'Escape' && searchOpen) {
        event.preventDefault();
        // A closed Find pane must not publish delayed native search results.
        invalidateProjectSearch();
        setSearchOpen(false);
        return;
      }
      const command = matchStudioShortcut(event, studioShortcutStore.getSnapshot().bindings);
      if (!command) return;
      if (paletteMode !== null && !['settings', 'quick-open', 'commands', 'go-to-line', 'go-to-symbol', 'stop-scarp'].includes(command)) return;
      if (command === 'next-diagnostic' && (!navigableDiagnostic || busy || compilerBusy || compilerSelecting)) return;
      event.preventDefault();
      if (event.repeat && command !== 'next-tab' && command !== 'previous-tab') return;
      switch (command) {
        case 'next-diagnostic': revealDiagnostic(); break;
        case 'run-scarp': void runCompiler('exec'); break;
        case 'verify-scarp': void runCompiler('verify'); break;
        case 'stop-scarp': void stopCompiler(); break;
        case 'toggle-focus': toggleFocusMode(); break;
        case 'save-all': void saveAllFiles(); break;
        case 'settings': setEditorSettingsOpen(open => !open); break;
        case 'quick-open': showPalette('files'); break;
        case 'commands': showPalette('commands'); break;
        case 'go-to-line': showPalette('line'); break;
        case 'go-to-symbol': showPalette('symbols'); break;
        case 'reopen-closed': void reopenLastClosedSource(); break;
        case 'show-problems': showProblems(); break;
        case 'toggle-output': toggleOutputPanel(); outputToggle.current?.focus(); break;
        case 'next-tab': cycleTab(1); break;
        case 'previous-tab': cycleTab(-1); break;
        case 'explorer': toggleExplorer(); break;
        case 'save': void saveFile(); break;
        case 'save-as': void saveFile(true); break;
        case 'new': newFile(); break;
        case 'open': void openFile(); break;
        case 'find-open-files': setSearchOpen(true); searchInput.current?.focus(); break;
        case 'close': {
          const currentId = liveEditor.current.activeId;
          if (currentId) void closeFile(currentId);
          break;
        }
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  });

  return (
    <div className={'studio-shell' + (focusMode ? ' focus-mode' : '')}>
      <header className="toolbar">
        <div className="identity" aria-label="Scarp Studio">
          <span className="identity-mark" aria-hidden="true">S</span>
          <span>Scarp <strong>Studio</strong></span>
          <span className="alpha-tag">ALPHA</span>
        </div>
        <button type="button" className="toolbar-quick-open" onClick={() => showPalette('files')}
          title={"Quick Open tabs and project sources (" + shortcut('quick-open') + ')'}>
          <span aria-hidden="true">⌕</span><span>Quick Open</span><kbd>{shortcut('quick-open')}</kbd>
        </button>
        <nav className="toolbar-actions" aria-label="Editor actions">
          <div className="toolbar-group" role="group" aria-label="File actions">
          <button onClick={newFile} title={"New (" + shortcut('new') + ')'}>New</button>
          <button onClick={() => void openFile()} title={"Open (" + shortcut('open') + ')'}>Open</button>
          <button onClick={() => void reopenLastClosedSource()} title={"Reopen last closed saved source (" + shortcut('reopen-closed') + ')'}
            disabled={!isTauri() || !recentlyClosed.entries.length || busy || compilerBusy || compilerSelecting}>Reopen</button>
          <button onClick={() => void openFolder()} title="Choose a folder">Folder</button>
          </div>
          <div className="toolbar-group" role="group" aria-label="Navigation">
          <button onClick={() => showPalette('commands')} title={"Commands (" + shortcut('commands') + ')'}>Commands</button>
          <button onClick={showStarterTemplates} title="New Scarp starter source templates">Examples</button>
          <button onClick={toggleExplorer}
            aria-expanded={explorerVisible} aria-controls="scarp-explorer"
            title={"Toggle Explorer (" + shortcut('explorer') + ')'}>Explorer</button>
          <button
            type="button"
            onClick={() => { invalidateProjectSearch(); setSearchOpen((open) => !open); }}
            aria-expanded={searchOpen}
            aria-controls="open-file-search"
            title={"Search all currently open Scarp buffers (" + shortcut('find-open-files') + ')'}
          >Find in Open Files</button>
          </div>
          <div className="toolbar-group" role="group" aria-label="Save and review">
          <button onClick={() => void saveFile()} disabled={!active || busy || compilerBusy || compilerSelecting} title={"Save (" + shortcut('save') + ')'}>Save</button>
          <button onClick={() => void saveAllFiles()} disabled={busy || compilerBusy || compilerSelecting || !documents.some(isDirty)}
            title={"Save All modified Scarp files (" + shortcut('save-all') + ')'}>Save All</button>
          <button onClick={() => void saveFile(true)} disabled={!active || busy || compilerBusy || compilerSelecting} title={"Save As (" + shortcut('save-as') + ')'}>Save As</button>
          <button onClick={() => void compareActiveSourceWithDisk()}
            disabled={!isTauri() || !active?.path || busy || compilerBusy || compilerSelecting || compilerScanning}
            title="Read-only snapshot comparison with the current saved file; never overwrites source">Compare with Disk</button>
          <button onClick={() => void reloadFile()} disabled={!active?.path || busy || compilerBusy || compilerSelecting}
            title="Reload the saved Scarp source from disk, confirming before discarding edits">Reload</button>
          </div>
        </nav>
        <button type="button" className="focus-mode-toggle" aria-pressed={focusMode}
          onClick={toggleFocusMode} title={"Toggle Focus Mode (" + shortcut('toggle-focus') + ')'}>{focusMode ? 'Exit focus' : 'Focus'}</button>
        <button
          className="settings-toggle"
          type="button"
          onClick={() => setEditorSettingsOpen((isOpen) => !isOpen)}
          aria-expanded={editorSettingsOpen}
          aria-controls="editor-settings"
        >⚙ Settings</button>
        <button
          className="theme-button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </header>

      {editorSettingsOpen && (
        <StudioSettingsPanel
          theme={theme} appearance={appearance} resolvedAppearance={resolvedAppearance}
          onAppearanceChange={(patch: Partial<AppearancePreferences>) => setAppearance(current => ({ ...current, ...patch }))}
          editor={editorPreferences} autoSave={autoSavePreferences}
          layout={workspaceLayout} onTheme={value => setAppearance(current => ({ ...current, theme: value }))}
          intelliSense={<IntelliSenseSettings preferences={intelligence.preferences}
            persistence={intelligence.persistence}
            diagnosticDocument={active ? { id: active.id, revision: active.revision, units: active.content.length } : null}
            onInspectDocument={() => {
              const current = currentActiveDocument(liveEditor.current);
              if (!current || !active || current.id !== active.id || current.revision !== active.revision) return null;
              return inspectIntelliSenseDocument(current.content, intelliSenseStore.getSnapshot().preferences.localAnalysisKiB);
            }}
            onChange={intelliSenseStore.update}
            onReset={intelliSenseStore.reset} />}
          commandLibrary={<CommandLibrarySettings library={commandLibrary} commands={builtInPaletteCommands}
            onTogglePin={toggleLibraryPin} onMovePin={(id,direction)=>setCommandLibrary(previous=>movePinnedCommand(previous,id,direction))}
            onClear={clearLibrary}/>}
          shortcuts={<StudioShortcutSettings bindings={shortcuts.bindings} persistence={shortcuts.persistence}
            onChange={studioShortcutStore.setBinding} onReset={studioShortcutStore.reset}
            revision={shortcuts.revision} onApplyTransfer={studioShortcutStore.applyTransfer} />}
          portability={<StudioPreferenceTransferPanel
            workspaceRoot={folderPath}
            current={portablePreferences}
            history={preferenceHistory}
            onApply={(expected, next) => {
              const live = captureStudioPreferences(appearance.theme, editorPreferences, intelliSenseStore.getSnapshot().preferences, workspaceLayout, autoSavePreferences.delay, appearance.contrast, appearance.motion);
              if (!sameStudioPreferences(live, expected)) return false;
              setAppearance({ ...next.appearance });
              setEditorPreferences({ ...next.editor });
              intelliSenseStore.update(next.intelliSense);
              setWorkspaceLayout({ ...next.layout });
              setAutoSavePreferences(current => ({ ...current, delay: next.files.autoSaveDelay }));
              setNotice('Applied reviewed Studio preferences. Auto Save enablement, compiler approval and workspace data are unchanged.');
              return true;
            }} />}
          compiler={<>
            <label className="editor-setting-checkbox" htmlFor="compiler-startup-scan">
              <input id="compiler-startup-scan" type="checkbox"
                checked={compilerPreferences.scanOnStartup}
                onChange={event => setCompilerPreferences({ scanOnStartup: event.target.checked })} />
              Scan for Scarp when Studio starts
            </label>
            <p>Applies on the next launch. Manual scans and first Run or Verify still work when off.</p>
            {renderCompilerSetup('settings')}
            <button className="settings-reset" type="button"
              onClick={() => setCompilerPreferences({ ...DEFAULT_COMPILER_PREFERENCES })}>Reset compiler preference only</button>
          </>}
          onEditorChange={patch => setEditorPreferences(current => ({ ...current, ...patch }))}
          onAutoSaveChange={patch => {
            // Revoke queued writes before React commits a disabled setting.
            if (patch.enabled !== undefined) autoSaveEnabledRef.current = patch.enabled;
            setAutoSavePreferences(current => ({ ...current, ...patch }));
          }}
          onLayoutChange={updateWorkspaceDimension}
          onResetEditor={() => {
            setEditorPreferences({ ...DEFAULT_EDITOR_PREFERENCES });
            setNotice('Restored editor display defaults.');
          }}
          onResetAutoSave={() => {
            autoSaveEnabledRef.current = false;
            setAutoSavePreferences({ ...DEFAULT_AUTO_SAVE });
            setNotice('Auto Save disabled; default delay restored.');
          }}
          onResetLayout={resetWorkspaceLayout}
          onResetAll={() => {
            const restored = restoreStudioDefaults();
            autoSaveEnabledRef.current = false;
            setAutoSavePreferences(restored.autoSave);
            setEditorPreferences(restored.editor);
            setAppearance({ ...DEFAULT_APPEARANCE });
            setCompilerPreferences({ ...DEFAULT_COMPILER_PREFERENCES });
            intelliSenseStore.reset();
            studioShortcutStore.reset();
            resetWorkspaceLayout();
            setNotice('Restored theme, editor, IntelliSense, shortcuts, layout, Auto Save and startup discovery defaults. Compiler approval, recovery and remembered workspace metadata are unchanged.');
          }}
          onClose={() => setEditorSettingsOpen(false)}
          recoveryNeedsReview={recoveryView.previous !== null || recoveryView.blocked}
          recovery={<DraftRecoveryPanel view={recoveryView}
            blocked={busy || compilerBusy || compilerSelecting || compilerScanning}
            onEnable={enableDraftRecovery} onDisable={disableDraftRecovery}
            onRestore={restorePreviousDrafts} onDiscard={discardPreviousDrafts}
            onCheckpoint={() => flushDraftRecovery(true)} />}
        />
      )}
      <div className="studio-main" ref={studioMainElement}>
        <aside id="scarp-explorer" className={'sidebar' + (explorerVisible ? '' : ' sidebar-hidden')}
          style={{ width: clampLayoutSize(workspaceLayout.explorerWidth, 'explorerWidth', workspaceDimensions.width),
            flexBasis: clampLayoutSize(workspaceLayout.explorerWidth, 'explorerWidth', workspaceDimensions.width) }} aria-label="Scarp file explorer">
          <div className="sidebar-heading">EXPLORER</div>
          {folderPath ? (
            <section className="sidebar-section">
              <div className="folder-label" title={folderPath}>▾ {fileName(folderPath)}</div>
              <button type="button" className="folder-refresh" disabled={busy || compilerBusy || compilerSelecting}
                onClick={() => void refreshFolder()} title="Re-scan selected Scarp project sources without opening a folder dialog">
                Refresh Explorer
              </button>
              <div className="sidebar-note">Scarp workspace: nested folders (up to 5 levels, 64 folders and 200 sources).</div>
              {folderListingLimited && (
                <p className="sidebar-note" role="status">
                  Workspace listing limited to 64 folders, 5 levels, 200 sources and at most 4096
                  inspected entries per folder. Some sources may not appear.
                </p>
              )}
              {unavailableProjectFolders.length > 0 && (
                <p className="sidebar-note" role="status">
                  Could not browse: {unavailableProjectFolders.join(', ')}.
                  Check folder access permissions.
                </p>
              )}
              <ProjectDependencyAuditPanel key={'dependency:'+folderPath} folder={selectedProjectPath}
                generation={editorState.sessionRevision+projectResultEpoch.current} busy={!isTauri()||busy||compilerBusy||compilerSelecting||compilerScanning}
                onAudit={scanProjectDependencies} onOpen={openDependencyAuditFile}/>
              <ProjectScaffoldPanel key={'scaffold:' + folderPath}
                directories={folderDirectories} unavailable={unavailableProjectFolders}
                busy={!isTauri() || busy || compilerBusy || compilerSelecting || compilerScanning}
                onCreate={createExplorerProject} />
              <WorkspaceCreatePanel key={'create:' + folderPath}
                directories={folderDirectories} unavailable={unavailableProjectFolders}
                busy={!isTauri() || busy || compilerBusy || compilerSelecting || compilerScanning}
                onCreate={createExplorerItem} />
              <ProjectExplorer key={folderPath} files={folderEntries} directories={folderDirectories}
                projectRoots={projectRoots} selectedProjectDirectory={projectDirectory}
                onSelectProject={chooseProjectTarget} documents={documents} activeId={activeId}
                busy={busy || compilerBusy || compilerSelecting}
                onOpen={path => void openFolderFile(path)} />
            </section>
          ) : (
            <div className="sidebar-note">Choose a folder to browse its .srp files.</div>
          )}
          <section className="sidebar-section open-editors">
            <div className="sidebar-heading">OPEN EDITORS</div>
            {documents.map((document) => (
              <button
                className={'file-row' + (document.id === activeId ? ' selected' : '')}
                key={document.id}
                aria-current={document.id === activeId ? 'true' : undefined}
                onClick={() => dispatch({ type: 'activate', id: document.id })}
                title={document.path || document.name}
              >
                <span aria-hidden="true" className="file-glyph">S</span>
                <span className="file-name">{documentLabels.get(document.id) ?? document.name}</span>
                {autoSaveReview.current.isHeld(document) && (
                  <span className="review-indicator" title="Review or Save these buffer changes; further editing resumes Auto Save">
                    Review
                  </span>
                )}
                {isDirty(document) && <span aria-label="unsaved changes">●</span>}
              </button>
            ))}
            {!documents.length && <p className="sidebar-note">No files open.</p>}
          </section>
          <ExplorerToolDirectory>
          <ExplorerToolSlot id="sessions">
          <WorkspaceSessionPanel key={folderPath ?? 'no-workspace'} root={folderPath}
            files={folderEntries} documents={documents} activeId={activeId}
            view={workspaceSessionView} busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            onRemember={rememberWorkspaceTabs} onRestore={(session, plan) => void restoreWorkspaceTabs(session, plan)}
            onForget={forgetWorkspaceTabs} onClearAll={clearRememberedWorkspaces} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="manage-tabs">
          <OpenEditorManager documents={documents} activeId={activeId}
            busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            onActivate={activateManagedTab} onClose={closeSelectedCleanTabs} />
          <WorkspaceDiskReviewPanel editor={editorState} native={isTauri()}
            busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            onScan={scanOpenFilesOnDisk} onReload={reloadReviewedCleanFiles} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="recently-closed">
          <RecentlyClosedPanel entries={recentlyClosed.entries}
            busy={!isTauri() || busy || compilerBusy || compilerSelecting || compilerScanning}
            onReopen={entry => void reopenClosedSource(entry)}
            onForget={forgetClosedSource} onClear={clearClosedSources} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="outline">
          <section className="sidebar-section" aria-label="Scarp declaration outline">
            <div className="sidebar-heading">DECLARATION OUTLINE</div>
            <button type="button" className="file-row" disabled={!active}
              onClick={() => showPalette('symbols')} title={"Go to Declaration (" + shortcut('go-to-symbol') + ')'}>
              <span className="file-name">Find declaration…</span>
            </button>
            {declarationOutline.map((symbol) => (
              <button type="button" className="file-row outline-row"
                key={symbol.line + ':' + symbol.kind + ':' + symbol.name}
                onClick={() => jumpToDeclaration(symbol)}
                title={'Go to ' + symbol.kind + ' ' + symbol.name + ' at line ' + symbol.line}>
                <span className="file-glyph" aria-hidden="true">
                  {symbol.kind === 'function' ? 'ƒ' : symbol.kind === 'record' ? '▣' : '◇'}
                </span>
                <span className="file-name">{symbol.name}</span>
                <span className="outline-line">:{symbol.line}</span>
              </button>
            ))}
            {!declarationOutline.length &&
              <p className="sidebar-note">No function, record or variant declarations in this file.</p>}
            {declarationOutline.length >= 500 &&
              <p className="sidebar-note" role="status">Declaration outline limited to 500 entries.</p>}
          </section>
          </ExplorerToolSlot>
          <ExplorerToolSlot id="insights">
          <SourceInsightsPanel document={active} onNavigate={jumpToSourceInsight} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="quality">
          <SourceQualityPanel documents={documents} activeId={activeId}
            busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            undoAvailable={!!qualityUndo && canUndoOpenFileReplace(qualityUndo, editorState)}
            onNavigate={jumpToSourceInsight} onApply={applyQualityCleanup} onUndo={undoQualityCleanup} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="identifier-edit">
          <IdentifierEditPanel editor={editorState} busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            undoAvailable={!!identifierUndo && canUndoOpenFileReplace(identifierUndo, editorState)}
            onApply={applyIdentifierEdit} onUndo={undoIdentifierEdit} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="line-tools">
          <LineRangeToolsPanel editor={editorState} cursorLine={cursor.line}
            busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            undoAvailable={!!lineRangeUndo && canUndoOpenFileReplace(lineRangeUndo, editorState)}
            onApply={applyLineRange} onUndo={undoLineRange} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="selection-edit">
          <SelectionEditPanel editor={editorState} busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            undoAvailable={!!selectionEditUndo && canUndoOpenFileReplace(selectionEditUndo, editorState)}
            onCapture={captureEditorSelections} onApply={applySelectionEdit} onUndo={undoSelectionEdit} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="working-changes">
          <WorkingChangesPanel document={active} onNavigate={jumpToSourceInsight} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="compare-buffers">
          <OpenBufferComparisonPanel editor={editorState} busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            undoAvailable={!!bufferTransferUndo && canUndoOpenFileReplace(bufferTransferUndo, editorState)}
            onApply={applyBufferTransfer} onUndo={undoBufferTransfer} onNavigate={jumpToSourceInsight} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="checkpoints">
          <SourceCheckpointsPanel editor={editorState} store={sourceCheckpoints}
            busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            undoAvailable={!!checkpointUndo && canUndoOpenFileReplace(checkpointUndo, editorState)}
            onCapture={captureSourceCheckpoint} onRestore={restoreSourceCheckpoint}
            onRemove={removeSourceCheckpoints} onUndo={undoSourceCheckpointRestore} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="imports">
          <SourceImportsPanel documents={documents} listed={folderEntries}
            activeId={activeId} busy={busy || compilerBusy || compilerSelecting}
            onOpen={path => void openFolderFile(path)} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="bookmarks">
          <SourceBookmarksPanel documents={documents} bookmarks={bookmarks}
            activeId={activeId} cursor={cursor}
            busy={busy || compilerBusy || compilerSelecting}
            onAdd={addCurrentBookmark}
            onRemove={id => setBookmarks(previous => removeSourceBookmark(previous, id))}
            onNavigate={jumpToBookmark} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="workspace-insights">
          <WorkspaceInsightsPanel documents={documents} listed={folderEntries}
            roots={projectRoots} activeId={activeId}
            busy={busy || compilerBusy || compilerSelecting}
            onActivate={id => dispatch({ type: 'activate', id })} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="symbols">
          <WorkspaceSymbolsPanel documents={documents} activeId={activeId}
            busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            onNavigate={jumpToSourceInsight} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="trail">
          <NavigationTrailPanel store={navigationTrail} documents={documents} activeId={activeId}
            busy={busy || compilerBusy || compilerSelecting || compilerScanning}
            onMark={markTrailCursor} onMove={replayTrailMove} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="references">
          <CodeReferencesPanel documents={documents} activeId={activeId}
            cursor={cursor} busy={busy || compilerBusy || compilerSelecting}
            onNavigate={jumpToSourceInsight} />
          </ExplorerToolSlot>
          <ExplorerToolSlot id="tasks">
          <WorkspaceTaskBoard documents={documents} activeId={activeId}
            busy={busy || compilerBusy || compilerSelecting}
            onNavigate={jumpToSourceInsight} />
          </ExplorerToolSlot>
          </ExplorerToolDirectory>
        </aside>

        {explorerVisible && <WorkspaceSplitter dimension="explorerWidth" value={workspaceLayout.explorerWidth}
          available={workspaceDimensions.width} controls="scarp-explorer"
          onChange={size => updateWorkspaceDimension('explorerWidth', size)}
          onReset={() => updateWorkspaceDimension('explorerWidth', DEFAULT_WORKSPACE_LAYOUT.explorerWidth)} />}
        <main className="workspace">
          <div className="tabs" role="tablist" aria-label="Open source files">
            {documents.map((document) => (
              <div
                role="tab"
                ref={document.id === activeId ? activeTabElement : undefined}
                id={'studio-tab-' + document.id}
                aria-selected={document.id === activeId}
                className={'tab' + (document.id === activeId ? ' active' : '')}
                key={document.id}
                onClick={() => dispatch({ type: 'activate', id: document.id })}
                onKeyDown={(event) => {
                  // Close buttons own their keyboard events; never interpret
                  // those as tab selection or arrow-navigation requests.
                  if (event.target !== event.currentTarget) return;
                  const ids = documents.map((item) => item.id);
                  const next = keyboardTabTarget(ids, document.id, event.key);
                  if (next !== null) {
                    event.preventDefault();
                    dispatch({ type: 'activate', id: next });
                    const position = ids.indexOf(next);
                    event.currentTarget.parentElement
                      ?.querySelectorAll<HTMLElement>('[role="tab"]')
                      .item(position)?.focus();
                  } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    dispatch({ type: 'activate', id: document.id });
                  }
                }}
                tabIndex={document.id === activeId ? 0 : -1}
                aria-controls="scarp-editor-panel"
                title={document.path || document.name}
              >
                <span>{documentLabels.get(document.id) ?? document.name}</span>
                {autoSaveReview.current.isHeld(document) && (
                  <span className="review-indicator" aria-label="Manual Save required after reviewed buffer changes"
                    title="Reviewed buffer changes are held from Auto Save until manual Save, Undo or further editing">
                    Review
                  </span>
                )}
                {isDirty(document) && <span className="dirty-indicator" aria-label="unsaved changes">●</span>}
                <button
                  className="tab-close"
                  onClick={(event) => { event.stopPropagation(); void closeFile(document.id); }}
                  onKeyDown={(event) => { event.stopPropagation(); }}
                  aria-label={'Close ' + (documentLabels.get(document.id) ?? document.name)}
                  title={'Close ' + (documentLabels.get(document.id) ?? document.name)}
                >×</button>
              </div>
            ))}
          </div>
          {searchOpen && (
            <section id="open-file-search" className="open-file-search" aria-label="Find in open Scarp files">
              <div className="open-file-search-toolbar">
                <label htmlFor="open-file-query">Find in open files</label>
                <input
                  id="open-file-query"
                  ref={searchInput}
                  type="search"
                  maxLength={121}
                  value={searchQuery}
                  placeholder="Search open .srp documents"
                  onChange={(event) => { invalidateProjectSearch(); setSearchQuery(event.target.value); }}
                />
                <label className="search-option">
                  <input
                    type="checkbox"
                    checked={searchCaseSensitive}
                    onChange={(event) => { invalidateProjectSearch(); setSearchCaseSensitive(event.target.checked); }}
                  />
                  Match case
                </label>
                <label className="search-option">
                  <input
                    type="checkbox"
                    checked={searchWholeWord}
                    onChange={(event) => { invalidateProjectSearch(); setSearchWholeWord(event.target.checked); }}
                  />
                  Whole word
                </label>
                <button type="button" onClick={() => void searchSelectedProject()}
                  disabled={!isTauri() || !folderPath || !searchQuery || busy ||
                    compilerBusy || compilerSelecting || compilerScanning}
                  title="Explicit read-only search of up to 24 already-listed project sources">
                  Search Project
                </button>
                <button type="button" onClick={() => {
                  invalidateProjectSearch();
                  setSearchOpen(false);
                }} aria-label="Close open-file search">Close</button>
              </div>
              {folderPath&&<ProjectSearchScopeControls listed={selectedFolderRef.current?.files??[]} scope={projectSearchScope}
                busy={busy||compilerBusy||compilerSelecting||compilerScanning} onChange={scope=>{
                  invalidateProjectSearch();setProjectSearchScope(scope);
                }}/>}
              {folderPath&&<ProjectSearchComparisonPanel key={'search-observations:'+folderPath}
                current={projectSearchResult&&projectSearchResult.query===searchQuery&&
                  projectSearchResult.selection===selectedFolderRef.current?{
                    query:projectSearchResult.query,
                    options:{caseSensitive:searchCaseSensitive,wholeWord:searchWholeWord},
                    summary:projectSearchResult.coverage,
                  }:null}
                busy={busy||compilerBusy||compilerSelecting||compilerScanning}/>}
              {folderPath&&<ProjectSearchLedgerPanel key={'search-ledger:'+folderPath}
                listed={selectedFolderRef.current?.files??[]} query={searchQuery}
                options={{caseSensitive:searchCaseSensitive,wholeWord:searchWholeWord}} scope={projectSearchScope}
                current={projectSearchResult&&projectSearchResult.query===searchQuery&&
                  projectSearchResult.selection===selectedFolderRef.current?projectSearchResult.coverage:null}
                busy={busy||compilerBusy||compilerSelecting||compilerScanning}
                onScopeChange={scope=>{invalidateProjectSearch();setProjectSearchScope(scope);}}/>}
              {folderPath&&<ProjectSearchPresetsPanel key={'search-presets:'+folderPath}
                listed={selectedFolderRef.current?.files??[]}
                current={{query:searchQuery,options:{caseSensitive:searchCaseSensitive,wholeWord:searchWholeWord},scope:projectSearchScope}}
                busy={busy||compilerBusy||compilerSelecting||compilerScanning}
                onApply={settings=>{
                  if(busy||compilerBusy||compilerSelecting||compilerScanning||filePickerInProgress.current||
                    saveInProgress.current||selectionInProgress.current||commandInProgress.current||nativeDialogGate.current.isActive)return false;
                  invalidateProjectSearch();setReplacePreview(null);pendingSearchLocation.current=null;
                  setSearchQuery(settings.query);setSearchCaseSensitive(settings.options.caseSensitive);
                  setSearchWholeWord(settings.options.wholeWord);setProjectSearchScope(settings.scope);
                  setError(null);return true;
                }}/>}
              {folderPath&&<ProjectSearchSweepPanel key={'search-sweep:'+folderPath}
                listed={selectedFolderRef.current?.files??[]}
                settings={{query:searchQuery,options:{caseSensitive:searchCaseSensitive,wholeWord:searchWholeWord},scope:projectSearchScope}}
                busy={busy||compilerBusy||compilerSelecting||compilerScanning} available={isTauri()}
                onRun={runProjectSearchSweep}/>}
              <div className="open-file-search-toolbar" aria-label="Literal replacement in open files">
                <label htmlFor="open-file-replacement">Replace with</label>
                <input id="open-file-replacement" type="text" maxLength={256}
                  value={replaceText} placeholder="Literal text; empty deletes matches"
                  onChange={(event) => setReplaceText(event.target.value)} />
                <button type="button" onClick={previewOpenFileReplacement}
                  disabled={!searchQuery || Boolean(openFileMatches.error) ||
                    openFileMatches.truncated || !openFileMatches.hits.length || busy}
                  title="Preview replacements in open buffers only; no disk writes">
                  Preview Replace
                </button>
              </div>
              <div className="search-status" role="status" aria-live="polite">
                {openFileMatches.error ||
                  (searchQuery
                    ? `${openFileMatches.hits.length} matches in open files`
                    : 'Search only already-open Scarp files. No files are read from disk.')}
                {openFileMatches.truncated &&
                  ` · Search budget reached; results may be incomplete. ${openFileMatches.skippedDocuments} buffers not fully searched.`}
              </div>
              {canUndoReplacement && (
                <div className="replace-preview-actions" aria-label="Undo last confirmed replacement">
                  <button type="button" onClick={undoLastOpenFileReplace}
                    disabled={busy || compilerBusy || compilerSelecting}
                    title="Revert the last batch in memory, only if no open source changed since replacement">
                    Undo Last Replace All
                  </button>
                  <span className="search-status">Undo is available until any open buffer changes or is saved.</span>
                </div>
              )}
              {replacePreview && (
                <section className="replace-preview" aria-label="Preview open-buffer replacements">
                  <strong>{replacePreview.totalReplacements} change(s) in {replacePreview.changes.length} open file(s)</strong>
                  <p>Review before confirming. Only editor buffers change; files on disk are not saved automatically.</p>
                  <div className="replace-preview-list" role="list">
                    {replacePreview.changes.map((change) => (
                      <div className="replace-preview-item" role="listitem" key={change.id}>
                        <strong>{change.documentName} · {change.matchCount} match(es)</strong>
                        <div className="replace-preview-diff"><del>{change.previewBefore}</del></div>
                        <div className="replace-preview-diff"><ins>{change.previewAfter}</ins></div>
                      </div>
                    ))}
                  </div>
                  <div className="replace-preview-actions">
                    <button type="button" onClick={() => void confirmOpenFileReplacement()}
                      disabled={!isTauri() || busy || compilerBusy || compilerSelecting}
                      title="Ask for confirmation, then modify only unchanged open buffers">
                      Confirm Replace in Open Files
                    </button>
                    <button type="button" onClick={() => setReplacePreview(null)}>Cancel Preview</button>
                  </div>
                </section>
              )}
              {searchQuery && !openFileMatches.error && (
                <div className="search-results" role="list" aria-label="Matches in open Scarp files">
                  {openFileMatches.hits.map((match) => (
                    <div role="listitem" key={match.documentId + ':' + match.offset}>
                      <button
                        className="search-result-row"
                        type="button"
                        onClick={() => goToSearchMatch(match)}
                        title={match.documentName + ' at line ' + match.line}
                      >
                        <span className="search-result-location">
                          {match.documentName} · {match.line}:{match.column}
                        </span>
                        <span className="search-result-preview">{match.preview}</span>
                      </button>
                    </div>
                  ))}
                  {!openFileMatches.hits.length && (
                    <p className="sidebar-note">No matches in open files.</p>
                  )}
                </div>
              )}
              {projectReplacementUndo && <button type="button" disabled={busy || compilerBusy || !canUndoOpenFileReplace(projectReplacementUndo,editorState)}
                onClick={undoProjectReplacements}>Undo last workspace replacements</button>}
              {projectSearchResult && projectSearchResult.query === searchQuery &&
                projectSearchResult.selection === selectedFolderRef.current && (
                <section className="project-search-results" aria-label="Read-only selected project search">
                  <div className="search-status" role="status">
                    Project (read-only): {projectSearchResult.result.hits.length} match(es) ·
                    {' '}{projectSearchResult.result.searchedFiles} / {projectSearchResult.result.totalListedFiles} selected .srp files fully searched
                    {projectSearchResult.result.truncated && (
                      <strong> · Incomplete ({projectSearchResult.result.skippedFiles} not fully searched).</strong>
                    )}
                    {projectSearchResult.coverage.batch&&<strong> · Batch {projectSearchResult.coverage.batch.index} of {projectSearchResult.coverage.batch.total}; {projectSearchResult.coverage.batch.deferred} candidate(s) outside this batch.</strong>}
                    {' '}No files changed.
                  </div>
                  <ProjectSearchCoverage key={'coverage-'+projectSearchEpoch.current} summary={projectSearchResult.coverage}/>
                  <ProjectReplacementPanel key={projectSearchEpoch.current} result={projectSearchResult.result} query={searchQuery}
                    options={{caseSensitive:searchCaseSensitive,wholeWord:searchWholeWord}} editor={editorState}
                    busy={busy || compilerBusy || compilerSelecting || compilerScanning}
                    onStage={stageProjectReplacements} onApply={applyProjectReplacements} />
                  <ProjectMatchExplorer key={'matches-'+projectSearchEpoch.current}
                    result={projectSearchResult.result} coverage={projectSearchResult.coverage}
                    busy={busy||compilerBusy||compilerSelecting||compilerScanning}
                    onNavigate={hit=>void goToProjectSearchHit(hit,projectSearchResult.selection)}/>
                </section>
              )}
            </section>
          )}
          {diskReconciliationUndo && <button type="button" disabled={busy||compilerBusy||!canUndoOpenFileReplace(diskReconciliationUndo,editorState)}
            onClick={undoDiskReconciliation}>Undo reconciliation working-text change (keep verified disk baseline)</button>}
          {diskReview && isCurrentDiskReview(diskReview.snapshot, active) && (
            <section className="disk-review" aria-label="Read-only disk comparison">
              <div className="disk-review-heading">
                <strong>COMPARE WITH DISK · READ-ONLY</strong>
                <button type="button" onClick={() => setDiskReview(null)}
                  aria-label="Dismiss disk comparison">Dismiss</button>
              </div>
              <p role="status" className="disk-review-summary">
                {diskReview.report.status === 'unchanged'
                  ? 'The disk file still matches its last loaded/saved source snapshot.'
                  : diskReview.report.status === 'disk-matches-editor'
                    ? 'The disk matches your current buffer, but differs from the last loaded/saved snapshot. Studio still treats that as an external change.'
                    : diskReview.report.status === 'external-change'
                      ? 'This file changed outside Studio. Reload to inspect the new disk version.'
                      : 'Conflict: both your unsaved editor content and the disk file differ from the last saved snapshot. Use Save As with a different filename to preserve your edits before Reload.'}
                {' '}Disk size: {diskReview.report.diskBytes} UTF-8 bytes.
                {' '}This is a limited excerpt, not an automatic merge or overwrite approval.
              </p>
              {diskReview.report.externalLine !== null && (
                <p className="disk-review-location">External difference near saved source line {diskReview.report.externalLine}.</p>
              )}
              {diskReview.report.editorLine !== null && (
                <p className="disk-review-location">Editor/disk difference near editor line {diskReview.report.editorLine}.</p>
              )}
              <div className="disk-review-excerpts">
                {diskReview.report.savedExcerpt !== null && (
                  <div><strong>Last saved snapshot</strong><pre>{diskReview.report.savedExcerpt}</pre></div>
                )}
                {diskReview.report.editorExcerpt !== null && (
                  <div><strong>Current editor buffer</strong><pre>{diskReview.report.editorExcerpt}</pre></div>
                )}
                {diskReview.report.diskExcerpt !== null && (
                  <div><strong>Current disk snapshot</strong><pre>{diskReview.report.diskExcerpt}</pre></div>
                )}
              </div>
              {isDirty(diskReview.snapshot) && diskReview.report.status !== 'unchanged' && (
                <DiskReconciliationPanel editor={editorState} snapshot={diskReview.snapshot} diskContent={diskReview.diskContent}
                  busy={busy || compilerBusy || compilerSelecting || compilerScanning} onApply={applyDiskReconciliation}/>
              )}
              <p className="disk-review-hint">No file was written. Reload rereads disk independently and asks before discarding dirty edits; Save As uses the normal guarded destination picker. Disk files may change again after this comparison.</p>
            </section>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
            </div>
          )}
          <div className="editor-output-region" ref={editorOutputRegion}>
          <div id="scarp-editor-panel" className="editor-panel" role="tabpanel"
            aria-labelledby={active ? 'studio-tab-' + active.id : undefined}
            aria-label={active ? undefined : 'Scarp source editor'}>
            {active ? (
              <Editor
                key={active.id}
                path={active.path || active.id + '.srp'}
                language="scarp"
                theme={resolvedAppearance.monacoTheme}
                value={active.content}
                onChange={(content) => {
                  const nextContent = content ?? '';
                  const pending = pendingSearchLocation.current;
                  // Monaco may initialize a newly selected tab before its onMount.
                  // Keep the pending jump unless the destination text really changed.
                  if (pending?.documentId === active.id &&
                      pending.sourceContent !== nextContent) {
                    pendingSearchLocation.current = null;
                  }
                  dispatch({ type: 'edit', id: active.id, content: nextContent });
                }}
                onMount={(editor, monaco) => {
                  editor.getModel()?.updateOptions({ tabSize: editorPreferences.tabSize, insertSpaces: editorPreferences.insertSpaces, trimAutoWhitespace: editorPreferences.trimAutoWhitespace });
                  mountedMonaco.current = monaco;
                  editorHandle.current = editor;
                  mountedEditor.current = editor;
                  mountedEditorDocumentId.current = active.id;
                  editor.onDidChangeCursorPosition((event) => {
                    setCursor({ line: event.position.lineNumber, column: event.position.column });
                  });
                  const pendingDiagnostic = pendingProblem.current;
                  if (pendingDiagnostic) {
                    pendingProblem.current = null;
                    const target = currentDiagnosticTarget(diagnostic, compilerOutputSource, liveEditor.current.documents);
                    if (target && !outputFreshnessWarning && sameDiagnosticTarget(target, pendingDiagnostic) &&
                        target.snapshot.documentId === active.id && liveEditor.current.activeId === active.id &&
                        editor.getModel()?.getValue() === target.snapshot.content) {
                      editor.setPosition(target);
                      editor.revealPositionInCenter(target);
                      editor.focus();
                    }
                  }
                  const insightJump = pendingInsightJump.current;
                  if (insightJump && insightJump.documentId === active.id) {
                    pendingInsightJump.current = null;
                    const fresh = liveEditor.current.documents.find(doc => doc.id === active.id);
                    if (fresh && fresh.revision === insightJump.revision &&
                        fresh.content === insightJump.source &&
                        editor.getModel()?.getValue() === fresh.content) {
                      const position = {
                        lineNumber: insightJump.line,
                        column: insightJump.column,
                      };
                      editor.setPosition(position);
                      editor.revealPositionInCenter(position);
                      editor.focus();
                    }
                  }
                  const pending = pendingSearchLocation.current;
                  if (pending && pending.documentId === active.id) {
                    const current = liveEditor.current.documents.find(
                      (item) => item.id === pending.documentId,
                    );
                    if (isCurrentSearchHit(current, pending)) {
                      revealSearchLocation(editor, pending);
                    }
                    pendingSearchLocation.current = null;
                  }
                }}
                loading={<div className="empty-state">Loading Scarp editor…</div>}
                options={{ ...editorDisplayOptions(editorPreferences), ...intelliSenseEditorOptions(intelligence.preferences), ...reducedMotionEditorOptions(resolvedAppearance) }}
              />
            ) : (
              <section className="empty-state welcome-screen" aria-label="Start working in Scarp Studio">
                <div className="welcome-content">
                  <div className="empty-mark" aria-hidden="true">S</div>
                  <h1>Welcome to Scarp Studio</h1>
                  <p>A local-first workspace for Scarp source code.</p>
                  <div className="welcome-actions" role="group" aria-label="Start editing">
                    <button type="button" onClick={newFile}><strong>New Scarp file</strong><kbd>{shortcut('new')}</kbd></button>
                    <button type="button" onClick={() => void openFile()}><strong>Open source</strong><kbd>{shortcut('open')}</kbd></button>
                    <button type="button" onClick={() => void openFolder()}><strong>Open project folder</strong><span>Explorer</span></button>
                    <button type="button" onClick={showStarterTemplates}><strong>Browse starter examples</strong><span>Scarp templates</span></button>
                  </div>
                  <div className="welcome-compiler">
                    <strong>Compiler setup</strong>
                    <span>{compilerPath ? 'Compiler approved for this session.' : automaticCompiler
                      ? 'A compiler was detected. Approve its exact path before running.'
                      : 'Install the separate official Scarp compiler to run saved .srp files.'}</span>
                    <button type="button" onClick={showCompilerSetup}>Open compiler setup</button>
                  </div>
                  <p className="welcome-footnote">Source is never executed automatically. Save your work before Run or Verify.</p>
                </div>
              </section>
            )}
          </div>
          {outputPanelMode === 'normal' && <WorkspaceSplitter dimension="outputHeight" value={workspaceLayout.outputHeight}
            available={workspaceDimensions.height} controls="scarp-output-panel"
            onChange={size => updateWorkspaceDimension('outputHeight', size)}
            onReset={() => updateWorkspaceDimension('outputHeight', DEFAULT_WORKSPACE_LAYOUT.outputHeight)} />}
          <section id="scarp-output-panel" className={'compiler-panel output-' + outputPanelMode}
            style={outputPanelMode === 'normal' ? { flexBasis: clampLayoutSize(workspaceLayout.outputHeight, 'outputHeight', workspaceDimensions.height) } : undefined}
            aria-label="Scarp compiler output">
            <div className="compiler-heading">
              <div className="compiler-title">
                <strong>SCARP OUTPUT</strong>
                <span className="compiler-state" role="status">{compilerBusy ? 'Running…' : compilerSelecting ? 'Checking compiler…' : compilerPath ? 'Ready' : 'Setup needed'}</span>
              </div>
              <div className="compiler-actions">
                <button onClick={() => void runCompiler('exec')}
                  disabled={runBlock !== null}
                  className="compiler-run-primary"
                  aria-describedby={runHint ? 'compiler-action-guidance' : undefined}
                  title={runHint ?? ('Execute the saved Scarp source using the official compiler (' + shortcut('run-scarp') + ')')}>▶ Run</button>
                <button onClick={() => void runCompiler('verify')}
                  disabled={verifyBlock !== null}
                  aria-describedby={verifyHint ? 'compiler-action-guidance' : undefined}
                  title={verifyHint ?? 'Statically verify saved Scarp source without runtime execution'}>Verify</button>
                <button onClick={() => void stopCompiler()} disabled={!compilerBusy && !compilerSelecting}
                  title="Stop a running Scarp process or compiler capability probe">Stop</button>
                <button type="button"
                  aria-expanded={compilerControlsOpen && outputPanelMode !== 'collapsed'} aria-controls="compiler-controls"
                  onClick={() => {
                    if (outputPanelMode === 'collapsed') {
                      showCompilerSetup();
                    } else setCompilerControlsOpen(open => !open);
                  }}>Setup &amp; Input</button>
                <button type="button" disabled={outputPanelMode === 'collapsed'}
                  aria-pressed={outputPanelMode === 'expanded'}
                  onClick={() => setOutputPanelMode(current => nextOutputPanelMode(current, 'expand'))}
                  title="Toggle expanded output panel">{outputPanelMode === 'expanded' ? 'Restore size' : 'Expand'}</button>
                <button type="button" ref={outputToggle} aria-expanded={outputPanelMode !== 'collapsed'}
                  aria-controls="compiler-panel-body" onClick={toggleOutputPanel}
                  title={"Toggle output panel (" + shortcut('toggle-output') + ')'}>{outputPanelMode === 'collapsed' ? 'Show output' : 'Hide output'}</button>
              </div>
            </div>
            <div id="compiler-action-guidance" className="compiler-action-guidance">
              {runHint ? <span>{runHint}{runBlock === 'invalid-input' && verifyBlock === null ? ' Verify remains available.' : ''}</span>
                : <span>{compilerPath ? 'Saved source ready. Run executes; Verify checks without execution.'
                  : 'Saved source ready. First Run or Verify requires explicit compiler approval.'}</span>}
              {runBlock === 'invalid-input' && <button type="button" onClick={showCompilerSetup}>Review input</button>}
            </div>
            <div id="compiler-panel-body" className="compiler-panel-body" hidden={outputPanelMode === 'collapsed'}>
            <div id="compiler-controls" className="compiler-controls" hidden={!compilerControlsOpen}>
            {renderCompilerSetup('output')}
             <div className="project-actions" aria-label="Selected Scarp project commands">
              <span>PROJECT</span>
              {folderPath && <label htmlFor="studio-project-root" className="project-target-label">Project target</label>}
              {folderPath && <select id="studio-project-root" className="project-target-select" aria-label="Choose Scarp project root"
                value={projectDirectory === null ? '' : '/' + projectDirectory}
                disabled={busy || compilerBusy || compilerSelecting || !isTauri()}
                title="Choose a manifest-bearing project for Info, Verify, Run and Tests"
                onChange={event => {
                  if (event.target.value.startsWith('/')) chooseProjectTarget(event.target.value.slice(1));
                }}>
                <option value="" disabled>Choose project target…</option>
                {projectRoots.map(root =>
                  <option key={root.directory} value={'/' + root.directory}>
                    {root.directory ? root.directory + '/' : 'Workspace root (manifest)'}
                  </option>)}
              </select>}
              {activeSourceHasOtherProject && <button type="button"
                className="project-target-from-source"
                disabled={!isTauri() || busy || compilerBusy || compilerSelecting}
                title={'Target the discovered project containing the active ' +
                  (active?.name ?? 'Scarp source') + ' file; does not execute code'}
                onClick={() => {
                  if (activeSourceProjectDirectory !== null) {
                    chooseProjectTarget(activeSourceProjectDirectory);
                  }
                }}>
                Use Active File's Project
              </button>}
              <button type="button" onClick={() => void runProjectAction('info')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !selectedProjectHasManifest || !selectedProjectPath}
                title="Inspect the chosen project's manifest and entrypoint">Info</button>
              <button type="button" onClick={() => void runProjectAction('verify')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !selectedProjectHasManifest || !selectedProjectPath ||
                  dirtySelectedProjectSources.length > 0}
                title="Verify the chosen Scarp project without executing code; save edited project sources first">Verify Project</button>
              <button type="button" onClick={() => void runProjectAction('run')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !selectedProjectHasManifest || !selectedProjectPath ||
                  dirtySelectedProjectSources.length > 0 || stdinValidationError !== null}
                title={stdinValidationError ?? 'Execute the project entrypoint with preloaded input; save modified files in this project first'}>Run Project</button>
              <button type="button" onClick={() => void runProjectAction('list-tests')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !selectedProjectHasManifest || !selectedProjectPath ||
                  dirtySelectedProjectSources.length > 0}
                title="List saved project tests without executing them; save edited project sources first">List Tests</button>
              <button type="button" onClick={() => void runProjectAction('run-tests')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !selectedProjectHasManifest || !selectedProjectPath ||
                  dirtySelectedProjectSources.length > 0}
                title="Explicitly execute saved project tests; save edited project sources first">Run Tests</button>
              {selectedProjectPath && <ProjectTestSelectionPanel key={selectedProjectPath} folder={selectedProjectPath}
                busy={busy || compilerBusy || compilerSelecting || compilerScanning || !compilerPath || !selectedProjectHasManifest}
                report={projectTestResult && isSelectedProjectTestReport(projectTestResult.folder,selectedProjectPath) ? projectTestResult.report : null}
                onCommand={(action,filter)=>void runProjectAction(action,filter)} />}
              {selectedProjectPath && <TestFixturesPanel key={selectedProjectPath+':fixtures'} folder={selectedProjectPath}
                generation={editorState.sessionRevision+projectResultEpoch.current}
                busy={!isTauri()||busy||compilerBusy||compilerSelecting||compilerScanning||!selectedProjectHasManifest}
                onScan={scanFixtures} onInspect={inspectFixture} onCreate={createFixture}/>}
              <button type="button" onClick={() => void runProjectAction('inspect-symbols')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !selectedProjectHasManifest || !selectedProjectPath ||
                  dirtySelectedProjectSources.length > 0}
                title="Inspect saved project symbols using Scarp 0.0.7-alpha.3 without executing code">Inspect Symbols</button>
              <button type="button" onClick={() => void runProjectAction('inspect-references')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !selectedProjectHasManifest || !selectedProjectPath ||
                  dirtySelectedProjectSources.length > 0}
                title="Inspect saved project references using Scarp 0.0.7-alpha.3 without executing code">Inspect References</button>
              <span>{selectedProjectPath ? fileName(selectedProjectPath) : 'Choose a Scarp project folder'}</span>
              {folderPath && !selectedProjectHasManifest && (
                <span className="project-dirty-warning" role="status">
                  {projectRoots.length
                    ? 'Choose a project target explicitly. Refresh never switches execution to another project.'
                    : 'No Scarp project manifest detected. Refresh Explorer after creating one.'}
                </span>
              )}
              {projectDiskEvidence&&projectDiskEvidence.folder===selectedProjectPath&&
                <ProjectCommandDiskEvidence evidence={projectDiskEvidence} historical={true}/>}
              {dirtySelectedProjectSources.length > 0 && (
                <span className="project-dirty-warning" role="status">
                  Save {dirtySelectedProjectSources.length} modified project source(s) before
                  Verify, Run, Test or Inspect. Project Info stays available.
                </span>
              )}
            </div>
            <div className="compiler-stdin">
              <label htmlFor="scarp-stdin">Program input (Run / Run Project; preloaded UTF-8 lines)</label>
              <label className="compiler-input-mode">
                <input type="checkbox" checked={promptInputMode} disabled={compilerBusy}
                  onChange={(event) => {
                    changeProgramInput(liveProgramInput.current.text, event.target.checked);
                  }} />
                Enable alpha.10 prompt functions (input/ask)
              </label>
              <div className="compiler-meta">
                All replies must be entered before Run or Run Project. The official
                --interactive flag requires alpha.10; this is not a live terminal.
                Output appears after completion.
              </div>
              <textarea
                id="scarp-stdin"
                value={stdinText}
                aria-invalid={stdinValidationError !== null}
                onChange={(event) => {
                  changeProgramInput(event.target.value, liveProgramInput.current.interactive);
                }}
                disabled={compilerBusy}
                maxLength={MAX_INPUT_BYTES}
                rows={2}
                spellCheck={false}
                aria-describedby="scarp-stdin-help"
                placeholder="Optional UTF-8 input for read_line()"
              />
              <div id="scarp-stdin-help" className="compiler-meta">
                {programInputBytes(stdinText)} / {MAX_INPUT_BYTES} UTF-8 bytes ·
                Max 4096 bytes per line and 256 lines. Input is not saved;
                avoid entering passwords or secrets.
                {stdinValidationError && (
                  <div role="status"><strong>{stdinValidationError}</strong> — edit Program Input before Run.</div>
                )}
              </div>
              <ProgramInputPresetsPanel store={inputPresets}
                current={{ text: stdinText, interactive: promptInputMode, revision: inputRevision.current }}
                busy={busy || compilerBusy || compilerSelecting || compilerScanning}
                onCapture={captureProgramInputPreset} onApply={applyProgramInputPreset}
                onRemove={removeProgramInputPresets} onUndo={undoProgramInputPreset} />
            </div>
            </div>
            <div className="results-view-switch" role="group" aria-label="Compiler result view">
              <button type="button" aria-pressed={resultsView === 'output'} onClick={() => setResultsView('output')}>Output</button>
              <button type="button" aria-pressed={resultsView === 'inspection'} onClick={() => setResultsView('inspection')}>Inspect</button>
              <button type="button" aria-pressed={resultsView === 'history'} onClick={() => setResultsView('history')}>History</button>
              <button type="button" ref={problemsTab} aria-pressed={resultsView === 'problems'} onClick={showProblems} title={"Show Problems (" + shortcut('show-problems') + ')'}>Problems ({problems.length})</button>
            </div>
            <div className="compiler-results" tabIndex={0} aria-label="Compiler results and diagnostics">
            {resultsView === 'inspection' ? <OutputInspectionPanel output={compilerOutput} freshnessWarning={outputFreshnessWarning}
              busy={busy || compilerBusy || compilerSelecting || compilerScanning} activity={compilerActivity} /> : resultsView === 'history' ? <CompilerActivityPanel store={compilerActivity} native={isTauri()} /> : resultsView === 'problems' ? <ProblemsPanel problems={problems} stale={Boolean(outputFreshnessWarning)}
              busy={busy || compilerBusy || compilerSelecting} onNavigate={navigateProblem} onShowOutput={() => setResultsView('output')} /> : <>

            {projectInfo && !outputFreshnessWarning && selectedProjectPath && sameFilePath(projectInfo.folder, selectedProjectPath) && (
              <ProjectInfoPanel snapshot={projectInfo} entry={projectInfoEntry(projectInfo, selectedFolderRef.current, documents)}
                baseline={projectInfoBaseline} busy={busy || compilerBusy || compilerSelecting || compilerScanning}
                onBaseline={setProjectInfoBaseline} onHide={() => setProjectInfo(null)} onOpen={snapshot => {
                  if (snapshot !== projectInfo || recoveryOperationsBlocked() ||
                    !selectedProjectPath || !sameFilePath(snapshot.folder, selectedProjectPath)) return;
                  const current = projectInfoEntry(snapshot, selectedFolderRef.current, liveEditor.current.documents);
                  if (current.kind === 'listed') void openFolderFile(current.path);
                }} />
            )}
            {navigationSnapshot && !outputFreshnessWarning && <CompilerNavigationComparison snapshot={navigationSnapshot} baseline={navigationBaseline} onBaseline={setNavigationBaseline}/>}
            {compilerNavigation && !outputFreshnessWarning && (
              <CompilerNavigationPanel report={compilerNavigation} onHide={() => setCompilerNavigation(null)} />
            )}
            {projectTestResult && isSelectedProjectTestReport(projectTestResult.folder, selectedProjectPath) && (
              <ProjectTestWorkbench result={projectTestResult} selection={selectedFolderRef.current}
                historical={Boolean(outputFreshnessWarning)}
                busy={busy || compilerBusy || compilerSelecting || compilerScanning}
                baseline={testBaseline} onBaseline={setTestBaseline}
                onOpenSource={openProjectTestSource} onHide={() => setProjectTestResult(null)} />
            )}
            {!outputFreshnessWarning && (projectDiagnosticReport || (compilerOutputSource && detailedSourceDiagnostic)) && (
              <DiagnosticReportPanel report={(projectDiagnosticReport ?? detailedSourceDiagnostic)!} />
            )}
            {diagnostic && (
              <div className="compiler-diagnostic" role="status">
                <strong>{diagnostic.code || 'Scarp Verify error'}</strong>
                <span>{diagnostic.message}</span>
                {navigableDiagnostic && (
                  <button type="button" disabled={busy || compilerBusy || compilerSelecting} onClick={revealDiagnostic}
                    title={"Navigate to this compiler error in the unchanged saved Scarp source (" + shortcut('next-diagnostic') + ')'}>
                    Go to line {diagnostic.line}, column {diagnostic.column} ({shortcut('next-diagnostic')})
                  </button>
                )}
                {diagnostic.help && <span className="compiler-diagnostic-help">{diagnostic.help}</span>}
              </div>
            )}
            <pre className="compiler-output" role="log" aria-live="polite">{outputFreshnessWarning
                    ? outputFreshnessWarning + '\n\n' + compilerOutput : compilerOutput}</pre>
            </>}
            </div>
            </div>
          </section>
          </div>
        </main>
      </div>
      {paletteMode !== null && (
        <div
          className="nav-overlay"
          onMouseDown={(event) => { if (event.target === event.currentTarget) hidePalette(); }}
        >
          <section className="nav-dialog" role="dialog" aria-modal="true"
            onKeyDown={(event) => {
              if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
              // Palette result buttons stay outside tab order; collection
              // controls participate in the dialog's real focus cycle.
              const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
                'input:not([disabled]),select:not([disabled]),button:not([disabled]):not([tabindex="-1"])'))
                .filter(element=>!element.closest('[hidden]'));
              if(!controls.length)return;
              event.preventDefault();
              const index=controls.indexOf(document.activeElement as HTMLElement);
              const next=index<0?(event.shiftKey?controls.length-1:0):
                (index+(event.shiftKey?-1:1)+controls.length)%controls.length;
              controls[next].focus();
            }}
            aria-label={paletteMode === 'files' ? 'Quick Open Scarp tabs and project sources' : paletteMode === 'commands' ? 'Scarp Studio commands' : paletteMode === 'symbols' ? 'Go to Scarp declaration' : 'Go to line'}>
            <div className="nav-query-row">
              <span aria-hidden="true">{paletteMode === 'files' ? '▤' : paletteMode === 'commands' ? '⌘' : paletteMode === 'symbols' ? 'ƒ' : ':'}</span>
              <input
                ref={paletteInput}
                role={paletteMode === 'line' ? undefined : 'combobox'}
                aria-autocomplete={paletteMode === 'line' ? undefined : 'list'}
                aria-expanded={paletteMode === 'line' ? undefined : true}
                aria-controls={paletteMode === 'line' ? undefined : 'studio-navigation-results'}
                aria-activedescendant={paletteMode !== 'line' && selectedPaletteId !== undefined
                  ? 'studio-navigation-option-' + selectedPaletteIndex : undefined}
                aria-label={paletteMode === 'files' ? 'Search open Scarp tabs and listed project files' : paletteMode === 'commands' ? 'Search editor commands' : paletteMode === 'symbols' ? 'Search declarations in the current Scarp file' : 'Line and optional column'}
                placeholder={paletteMode === 'files' ? 'Find an open or project .srp file…' : paletteMode === 'commands' ? 'Type a Studio command…' : paletteMode === 'symbols' ? 'Find a function, record or variant…' : 'Line or line:column (e.g. 12:4)'}
                value={paletteQuery}
                maxLength={MAX_NAVIGATION_QUERY_UNITS}
                onChange={(event) => {
                  setPaletteQuery(boundedNavigationQuery(event.target.value));
                  setPaletteIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    if (paletteMode !== 'line') {
                      setPaletteIndex(current => stepPaletteIndex(current, paletteResults.length,
                        event.key === 'ArrowDown' ? 1 : -1));
                    }
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    if (paletteMode === 'line') goToLine();
                    else if (paletteResults[selectedPaletteIndex]) executePaletteEntry(paletteResults[selectedPaletteIndex]);
                  }
                }}
              />
              <button type="button" ref={paletteDismiss} className="nav-dismiss" onClick={() => hidePalette()} aria-label="Close navigation">×</button>
            </div>
            {paletteMode==='commands'&&<div className="nav-collection-controls">
              <label>Collection <select aria-label="Command palette collection" value={commandCollection} onChange={event=>{
                if(isCommandCollection(event.target.value)){setCommandCollection(event.target.value);setPaletteIndex(0);paletteInput.current?.focus();}
              }}>
                {(['all','pinned','recent',...COMMAND_GROUPS] as const).map(collection=><option key={collection} value={collection}>{collectionLabel(collection)}</option>)}
              </select></label>
              <button type="button" disabled={!selectedPaletteId||!isLibraryCommand(selectedPaletteId)} onClick={()=>{
                if(selectedPaletteId){toggleLibraryPin(selectedPaletteId);paletteInput.current?.focus();}
              }}>{selectedPaletteId&&commandLibrary.pinned.includes(selectedPaletteId)?'Unpin selected':'Pin selected'}</button>
            </div>}
            {paletteMode === 'line' ? (
              <div className="nav-hint">
                {parseLineLocation(paletteQuery)
                  ? 'Press Enter to move the cursor. Out-of-range locations are clamped to the document.'
                  : 'Enter a positive line number, optionally followed by :column.'}
              </div>
            ) : (
              <div id="studio-navigation-results" className="nav-results" role="listbox" aria-label="Navigation results">
                {paletteResults.map((item, index) => (
                  <button type="button" role="option" tabIndex={-1} aria-selected={index === selectedPaletteIndex}
                    id={'studio-navigation-option-' + index}
                    ref={index === selectedPaletteIndex ? paletteSelectedResult : undefined}
                    key={item.id} className={'nav-result' + (index === selectedPaletteIndex ? ' selected' : '')}
                    onMouseDown={event => event.preventDefault()}
                    onMouseEnter={() => setPaletteIndex(index)}
                    onClick={() => executePaletteEntry(item)}>
                    <span className="nav-result-name">{item.label}</span>
                    <span className="nav-result-detail">{paletteMode==='commands'&&commandLibrary.pinned.includes(item.id)?'Pinned · ':''}
                      {paletteMode==='commands'&&commandGroup(item.id)?commandGroup(item.id)+' · ':''}{item.detail}</span>
                  </button>
                ))}
                {!paletteResults.length && <p className="nav-hint">{paletteMode === 'symbols'
                  ? 'No matching declarations in the current Scarp file.' : 'No matching Scarp Studio items.'}</p>}
                {paletteMode === 'symbols' && <p className="nav-hint">Current file only · up to 500 declarations · up to 40 results. Refine the query to find more.</p>}
              </div>
            )}
            <div className="nav-footer">
              {paletteMode !== 'line' && <span role="status">{paletteResults.length} result(s) · </span>}
              ↑ ↓ Navigate · Enter Select · Esc Close
            </div>
          </section>
        </div>
      )}
      <footer className="status-bar">
        {focusMode && <button type="button" className="status-nav" onClick={toggleFocusMode} title={"Exit Focus Mode (" + shortcut('toggle-focus') + ')'}>Focus mode · Exit</button>}
        <span className="status-notice" role="status" title={busy ? 'Working…' : notice}>{busy ? 'Working…' : notice}</span>
        <div className="status-items" aria-label="Editor status">
        <button type="button" className="status-nav status-problems" onClick={showProblems} title={"Show current structured problems (" + shortcut('show-problems') + ')'}>
          Problems: {problems.length}
        </button>
        <button className="status-nav" onClick={() => showPalette('line')} disabled={!active}
          title={"Go to Line (" + shortcut('go-to-line') + ')'}>
          {active ? 'Ln ' + cursor.line + ', Col ' + cursor.column : ''}
        </button>
        <span title={compilerPath || automaticCompiler || 'No compiler detected'}>
          {compilerPath ? 'Scarp compiler ready' :
            automaticCompiler ? 'Compiler detected · approval required' : 'Compiler not detected'}
        </span>
        <button type="button" className="status-nav"
          onClick={() => setEditorSettingsOpen(true)} title={"Configure Auto Save (" + shortcut('settings') + ')'}>
          Auto Save: {autoSavePreferences.enabled ? 'On' : 'Off'}
          {autoSaveReview.current.reviewCount(documents) > 0 &&
            ' · Review ' + autoSaveReview.current.reviewCount(documents)}
        </button>
        <button type="button" className="status-nav recovery-status" onClick={() => setEditorSettingsOpen(true)}
          title={recoveryView.error || "Local draft recovery (Settings)"}>
          Recovery: {recoveryView.previous ? "Review" : recoveryView.error && recoveryView.enabled ? "Warning" :
            recoveryView.blocked ? "Review" : recoveryView.paused ? "Paused" : recoveryView.enabled ? "On" : "Off"}
        </button>
        <span>Scarp · .srp</span>
        <span className="status-version" title="Unreleased development candidate">0.0.2-alpha.1 · development candidate</span>
        </div>
      </footer>
    </div>
  );
}
