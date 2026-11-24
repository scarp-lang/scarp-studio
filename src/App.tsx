import { useEffect, useMemo, useRef, useState } from 'react';
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
import { chooseSourceFolder, readFolderSource, scanSourceFolder } from './services/folders';
import { buildQuickOpenEntries, type QuickOpenEntry } from './model/projectQuickOpen';
import { isCurrentListedSourceRead, resolveListedProjectOpen } from './model/listedProjectOpen';
import {
  DEFAULT_EDITOR_PREFERENCES, FONT_SIZES, TAB_SIZES,
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
import { diagnosticSourcePosition, parseScarpDiagnostic } from './model/diagnostics';
import { verifiedProblemMarker } from './model/problemMarkers';
import {
  captureVerifiedSource, isCurrentVerifiedSource, retainVerifiedSourceSnapshot,
  type VerifiedSourceSnapshot,
} from './model/verifiedSource';
import { scarpProjectAction, type ScarpProjectAction } from './services/project';
import { parseScarpTestReportForAction, type ScarpTestReport } from './model/projectTestReport';
import { resolveListedTestSource } from './model/projectTestNavigation';
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
  loadAutoSavePreferences, persistAutoSavePreferences,
  type AutoSaveDelay,
} from './model/autoSaveSettings';

import {
  isCurrentSearchHit, searchOpenFiles, type OpenFileSearchHit,
} from './model/openFileSearch';
import { planOpenFileReplacement, type OpenFileReplacePlan } from './model/openFileReplace';
import {
  editorChangeInvalidatesProjectSearch, searchListedProjectSources,
  type ProjectSearchHit, type ProjectSearchResult,
} from './model/projectSearch';
import { canUndoOpenFileReplace, createOpenFileReplaceUndo, type OpenFileReplaceUndo } from './model/openFileReplaceUndo';

import { nextOutputPanelMode, revealOutputPanel, type OutputPanelMode } from './model/outputPanelLayout';

type Theme = 'dark' | 'light';
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
  { id: 'settings', label: 'Open Editor and Auto Save Settings', detail: 'Ctrl+,' },
  { id: 'explorer', label: 'Show / Hide Scarp Explorer', detail: 'Ctrl+B' },
  { id: 'select-compiler', label: 'Select Trusted Scarp Compiler', detail: 'Run / Verify' },
  { id: 'scan-compiler', label: 'Scan for Installed Scarp Compiler', detail: 'Non-executing discovery' },
  { id: 'download-compiler', label: 'Download Official Scarp Compiler', detail: 'Official alpha.20 Windows ZIP' },
  { id: 'run-scarp', label: 'Run Current Scarp Source', detail: 'F5 · saved .srp only' },
  { id: 'verify-scarp', label: 'Verify Current Scarp Source', detail: 'Ctrl+F5 · static analysis' },
  { id: 'stop-scarp', label: 'Stop Running Scarp Program', detail: 'Shift+F5' },
  { id: 'toggle-output', label: 'Toggle Scarp Output Panel', detail: 'Ctrl+J' },
  { id: 'expand-output', label: 'Expand Scarp Output Panel', detail: 'More room for diagnostics' },
  { id: 'compiler-controls', label: 'Show Compiler Setup and Program Input', detail: 'Output panel controls' },
  ...scarpStarterTemplates.map((starter) => ({
    id: 'template:' + starter.id,
    label: 'Template: ' + starter.title,
    detail: starter.description,
  })),
];

function getInitialTheme(): Theme {
  try {
    return localStorage.getItem('studio.theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

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

export default function App() {
  const [editorState, setEditorState] = useState(initialEditorState);
  // Apply actions synchronously to the live state so native close requests and
  // file operations observe new edits before React renders the next frame.
  const liveEditor = useRef(editorState);
  // Advances whenever a selected-project source changes or its Explorer is
  // successfully replaced. In-flight test reports must match this generation.
  const projectResultEpoch = useRef(0);
  const { documents, activeId } = editorState;
  // Completed searches survive safe navigation but never selected-project
  // source mutations, listing replacement or changed search options.
  const projectSearchEpoch = useRef(0);
  const [projectSearchResult, setProjectSearchResult] = useState<{
    selection: { path: string; files: FolderEntry[] };
    query: string;
    result: ProjectSearchResult;
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
    }
    // Keep a valid previous Verify result through tab switches and unrelated
    // edits, but invalidate it on any change to the actual verified source.
    // Monotonic revisions prevent stale markers returning after A→B→A edits.
    setCompilerOutputSource((previous) =>
      retainVerifiedSourceSnapshot(previous, next.documents));
    liveEditor.current = next;
    setEditorState(next);
  }
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [editorPreferences, setEditorPreferences] = useState(getInitialEditorPreferences);
  const [autoSavePreferences, setAutoSavePreferences] = useState(loadAutoSavePreferences);
  const autoSaveEnabledRef = useRef(autoSavePreferences.enabled);
  autoSaveEnabledRef.current = autoSavePreferences.enabled;
  const autoSaveReview = useRef(new AutoSaveReviewGate());
  const autoSaveScheduler = useRef<AutoSaveScheduler | null>(null);
  const autoSaveAction = useRef<(document: StudioDocument) => boolean | void>(() => true);
  const [editorSettingsOpen, setEditorSettingsOpen] = useState(false);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>([]);
  // Preserve exact folder-listing identity across asynchronous source reads.
  const selectedFolderRef = useRef<{ path: string; files: FolderEntry[] } | null>(null);
  const [folderListingLimited, setFolderListingLimited] = useState(false);
  const [unavailableProjectFolders, setUnavailableProjectFolders] = useState<string[]>([]);
  const [explorerVisible, setExplorerVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Scarp Studio • editor foundation');
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [diskReview, setDiskReview] = useState<{
    snapshot: StudioDocument;
    report: DiskReview;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [replacePreview, setReplacePreview] = useState<OpenFileReplacePlan | null>(null);
  const [replaceUndo, setReplaceUndo] = useState<OpenFileReplaceUndo | null>(null);
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
  const [outputPanelMode, setOutputPanelMode] = useState<OutputPanelMode>('normal');
  const [compilerControlsOpen, setCompilerControlsOpen] = useState(true);
  const outputToggle = useRef<HTMLButtonElement | null>(null);
  const [projectTestResult, setProjectTestResult] = useState<{folder: string; report: ScarpTestReport} | null>(null);
  const [compilerDiagnosticStderr, setCompilerDiagnosticStderr] = useState<string | null>(null);
  const [compilerOutputSource, setCompilerOutputSource] = useState<VerifiedSourceSnapshot | null>(null);
  // This input is session-local, not persisted or stored in source files.
  const [stdinText, setStdinText] = useState('');
  const [promptInputMode, setPromptInputMode] = useState(false);
  // Increment synchronously in input handlers; an async first-Run trust
  // dialog must never launch a CLI with an older preloaded input snapshot.
  const inputRevision = useRef(0);
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
  function showCompilerSetup(): void {
    setOutputPanelMode(revealOutputPanel);
    setCompilerControlsOpen(true);
  }

  // The same selected-project dirty-source policy governs both button state
  // and the guarded native action handler. Read-only Info stays available.
  const dirtySelectedProjectSources = useMemo(
    () => folderPath ? dirtyProjectSourceNames(documents, folderPath) : [],
    [documents, folderPath],
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
  const diagnosticPosition = isCurrentVerifiedSource(compilerOutputSource, active) && active?.path
    ? diagnosticSourcePosition(diagnostic, active.path, active.content) : null;
  const problemMarker = useMemo(() => verifiedProblemMarker(diagnostic, compilerOutputSource, active),
    [diagnostic, compilerOutputSource, active]);
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

  function jumpToDeclaration(symbol: ScarpOutlineSymbol): void {
    const editor = editorHandle.current;
    if (!editor) return;
    const position = { lineNumber: symbol.line, column: symbol.startColumn };
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
    setNotice('Scarp ' + symbol.kind + ': ' + symbol.name);
  }

  const paletteEntries: readonly NavigationEntry[] = paletteMode === 'files'
    ? buildQuickOpenEntries(documents, folderEntries)
    : paletteMode === 'symbols' ? buildDeclarationEntries(active, declarationOutline) : studioCommands;
  const paletteResults = paletteMode === 'line'
    ? []
    : filterNavigationEntries(paletteEntries, paletteQuery);
  const selectedPaletteIndex = clampPaletteIndex(paletteIndex, paletteResults.length);
  const selectedPaletteId = paletteResults[selectedPaletteIndex]?.id;

  function showPalette(mode: PaletteMode): void {
    if (paletteMode === null) {
      paletteReturnFocus.current = document.activeElement instanceof HTMLElement
        ? document.activeElement : null;
    }
    paletteRestoreOnClose.current = false;
    setPaletteMode(mode);
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
    if (entry.id.startsWith('template:')) {
      createFromTemplate(entry.id.slice('template:'.length));
      return;
    }
    switch (entry.id) {
      case 'new': newFile(); break;
      case 'open': void openFile(); break;
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
      case 'theme': setTheme((current) => current === 'dark' ? 'light' : 'dark'); break;
      case 'settings': setEditorSettingsOpen(true); break;
      case 'explorer': setExplorerVisible((visible) => !visible); break;
      case 'select-compiler': void selectCompiler(); break;
      case 'scan-compiler': void rescanCompilers(); break;
      case 'download-compiler': void downloadCompiler(); break;
      case 'run-scarp': void runCompiler('exec'); break;
      case 'verify-scarp': void runCompiler('verify'); break;
      case 'stop-scarp': void stopCompiler(); break;
      case 'toggle-output': setOutputPanelMode(current => nextOutputPanelMode(current, 'toggle')); break;
      case 'expand-output': setOutputPanelMode('expanded'); break;
      case 'compiler-controls': showCompilerSetup(); break;
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('studio.theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);

  useEffect(() => {
    // Editor preferences remain local and never modify a source file.
    try {
      localStorage.setItem('studio.editorPreferences', JSON.stringify(editorPreferences));
    } catch { /* Continue with in-memory settings when storage is unavailable. */ }
  }, [editorPreferences]);

  // This operation only inspects bounded local directories. It never runs
  // candidate executables and does not grant trust, even after a prior session.
  useEffect(() => {
    if (!isTauri()) return;
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
      if (!pending.length && !blocked && !nativeDialogGate.current.isActive) return;
      event.preventDefault();
      if (blocked) {
        setError(blocked);
        return;
      }
      if (!nativeDialogGate.current.begin('window-exit')) return;
      try {
        if (await ask('Discard unsaved Scarp changes and exit?', {
          title: 'Unsaved changes',
          kind: 'warning',
        })) {
          const newBlocker = exitBlockReason(
            saveInProgress.current, commandInProgress.current, selectionInProgress.current,
            filePickerInProgress.current,
          );
          if (newBlocker ||
              !sameExitEditorState(exitSnapshot, liveEditor.current)) {
            setError(newBlocker ||
              'Files changed while confirming exit. Review your edits and try again.');
            return;
          }
          await getCurrentWindow().destroy();
        }
      } catch (caught) {
        setError(toMessage(caught));
      } finally {
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
      invalidateProjectSearch();
      selectedFolderRef.current = { path: result.path, files: result.files };
      setFolderPath(result.path);
      setFolderEntries(result.files);
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
      invalidateProjectSearch();
      selectedFolderRef.current = { path: result.path, files: result.files };
      setFolderEntries(result.files);
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
      setDiskReview({ snapshot: selected, report });
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
      const current = liveEditor.current.documents.find((item) => item.id === document.id);
      setNotice(current && isDirty(current)
        ? 'Saved ' + fileName(path) + ' snapshot; newer edits remain unsaved'
        : 'Saved ' + fileName(path));
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
    try {
      const result = await saveAllModifiedSources(
        ids,
        (id) => liveEditor.current.documents.find((document) => document.id === id),
        (id) => liveEditor.current.documents
          .filter((document) => document.id !== id && document.path !== null)
          .map((document) => document.path as string),
        (document, path) => dispatch({
          type: 'saved', id: document.id, path, savedContent: document.content,
        }),
      );
      setNotice(result.cancelled
        ? 'Save All cancelled; ' + result.saved + ' source(s) saved'
        : 'Saved ' + result.saved + ' Scarp source(s)');
    } catch (caught) {
      setError(toMessage(caught));
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
    setCompilerDiagnosticStderr(null);
    setProjectTestResult(null);
    setCompletedProjectOutput(null);
    setCompletedSourceOutput(null);
    setCompletedRunInputGeneration(null);
    setCompilerOutput(info + '\nCompiler is ready. Run operates on the saved file on disk.');
    setNotice('Scarp compiler approved for this session');
    return true;
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
      setNotice('Opened the official Scarp alpha.20 download; extract it and scan for the compiler.');
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
    setCompletedProjectOutput(null);
    setCompletedSourceOutput(null);
    setCompletedRunInputGeneration(null);
    setCompilerOutput((mode === 'exec' ? 'Running ' : 'Verifying ') + fileName(source) + '…');
    try {
      const result = await executeScarp(
        binary, source, mode, expectedContent,
        mode === 'exec' ? stdinText : '',
        mode === 'exec' && promptInputMode,
      );
      // The compiler operated on the saved disk snapshot captured BEFORE the
      // async probe/launch. An edit, same-content Save, Save As or close/reopen
      // while it runs makes the old output informational, not a live result.
      const staleSource = sourceResultIsStale(verifiedSnapshot, liveEditor.current.documents);
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
      setError(message);
    } finally {
      commandInProgress.current = false;
      setCompilerBusy(false);
    }
  }

  function revealDiagnostic(): void {
    const current = liveEditor.current.documents.find(
      (item) => item.id === liveEditor.current.activeId,
    );
    if (!isCurrentVerifiedSource(compilerOutputSource, current ?? null) ||
        !current?.path || mountedEditorDocumentId.current !== current.id) return;
    const position = diagnosticSourcePosition(diagnostic, current.path, current.content);
    const editor = mountedEditor.current;
    if (!position || !editor) return;
    pendingSearchLocation.current = null;
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
  }

  function openProjectTestSource(testPath: string, reportFolder: string): void {
    // Re-resolve on click: the report may outlive an Explorer refresh or
    // project change. The shared openFolderFile path also rejects stale
    // async reads and preserves existing dirty editor buffers.
    const path = resolveListedTestSource(
      testPath, reportFolder, selectedFolderRef.current,
    );
    if (!path || folderPath !== reportFolder) {
      setError('This test source is not in the current Scarp Explorer listing. Refresh Explorer and try again.');
      return;
    }
    void openFolderFile(path);
  }

  async function runProjectAction(action: ScarpProjectAction): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current ||
        saveInProgress.current || filePickerInProgress.current ||
        nativeDialogGate.current.isActive) return;
    if (!compilerPath || !folderPath) {
      if (!compilerPath) showCompilerSetup();
      setError('Select the official compiler and a Scarp project folder first.');
      return;
    }
    if (projectActionRequiresSavedSources(action)) {
      try {
        if (action === 'run') validateProgramInput(stdinText);
        // Disk-backed project actions cannot reflect unsaved source edits.
        // Only tabs belonging to this project matter; unrelated and untitled
        // documents should not prevent working with the selected project.
        const dirtySources = dirtyProjectSourceNames(liveEditor.current.documents, folderPath);
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
    setCompilerDiagnosticStderr(null);
    setCompilerOutputSource(null);
    setProjectTestResult(null);
    setCompletedProjectOutput(null);
    setCompletedSourceOutput(null);
    setCompletedRunInputGeneration(null);
    setCompilerOutput('Scarp project ' + action + '…');
    try {
      const output = await scarpProjectAction(
        compilerPath, folderPath, action,
        action === 'run' ? stdinText : '',
        action === 'run' && promptInputMode,
      );
      const freshness = projectResultFreshness(
        action,
        { epoch: reportEpoch, listing: reportSelection },
        { epoch: projectResultEpoch.current, listing: selectedFolderRef.current },
      );
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
        ? parseScarpTestReportForAction(output.testReportJson, action, output.exitCode)
        : null;
      if (structured) {
        setProjectTestResult({ folder: folderPath, report: structured });
      }
      setNotice(freshness.stale
        ? 'Scarp project ' + action + ' result is stale; save changed sources and rerun'
        : 'Scarp project ' + action + ' finished');
    } catch (caught) {
      const message = toMessage(caught);
      setCompilerOutput('Scarp project ' + action + ' could not complete:\n' + message);
      setError(message);
    } finally {
      commandInProgress.current = false;
      setCompilerBusy(false);
    }
  }

  async function stopCompiler(): Promise<void> {
    if (!isTauri()) return;
    try {
      const stopping = await stopScarp();
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
        selection.files, snapshot.documents, searchQuery, options,
        (path, maxBytes) => readScarpSource(path, maxBytes), current,
      );
      if (!result || !current()) return;
      if (result.error) {
        setError('Could not search the project: ' + result.error);
        return;
      }
      setProjectSearchResult({ selection, query: searchQuery, result });
      setNotice('Project search: ' + result.hits.length + ' match(es) in ' +
        result.searchedFiles + ' fully scanned source(s)' +
        (result.truncated ? ' (incomplete)' : ''));
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
    pendingSearchLocation.current = match;
    if (current.activeId === document.id && mountedEditor.current &&
        mountedEditorDocumentId.current === document.id) {
      revealSearchLocation(mountedEditor.current, match);
      pendingSearchLocation.current = null;
    } else {
      dispatch({ type: 'activate', id: document.id });
    }
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
      if (paletteMode === null && event.key === 'F8' &&
          !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
          diagnosticPosition) {
        event.preventDefault();
        revealDiagnostic();
        return;
      }
      if (paletteMode === null && event.key === 'F5' && !event.altKey) {
        event.preventDefault();
        if (event.shiftKey) void stopCompiler();
        else void runCompiler(event.ctrlKey ? 'verify' : 'exec');
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.altKey && !event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (paletteMode === null) void saveAllFiles();
        return;
      }
      if (!modifier || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === ',') {
        event.preventDefault();
        setEditorSettingsOpen((open) => !open);
        return;
      }
      if (key === 'p') {
        event.preventDefault();
        showPalette(event.shiftKey ? 'commands' : 'files');
        return;
      }
      if (key === 'g' && !event.shiftKey) {
        event.preventDefault();
        showPalette('line');
        return;
      }
      if (key === 'o' && event.shiftKey) {
        event.preventDefault();
        showPalette('symbols');
        return;
      }
      if (paletteMode !== null) return;
      if (key === 'j' && !event.shiftKey) {
        event.preventDefault();
        setOutputPanelMode(current => nextOutputPanelMode(current, 'toggle'));
        outputToggle.current?.focus();
      } else if (key === 'tab' && event.ctrlKey) {
        event.preventDefault();
        cycleTab(event.shiftKey ? -1 : 1);
      } else if (key === 'b' && !event.shiftKey) {
        event.preventDefault();
        setExplorerVisible((visible) => !visible);
      } else if (key === 's') {
        event.preventDefault();
        void saveFile(event.shiftKey);
      } else if (key === 'n') {
        event.preventDefault();
        newFile();
      } else if (key === 'o' && !event.shiftKey) {
        event.preventDefault();
        void openFile();
      } else if (key === 'f' && event.shiftKey) {
        event.preventDefault();
        setSearchOpen(true);
        searchInput.current?.focus();
      } else if (key === 'w') {
        event.preventDefault();
        const currentId = liveEditor.current.activeId;
        if (currentId) void closeFile(currentId);
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  });

  return (
    <div className="studio-shell">
      <header className="toolbar">
        <div className="identity" aria-label="Scarp Studio">
          <span className="identity-mark" aria-hidden="true">S</span>
          <span>Scarp <strong>Studio</strong></span>
          <span className="alpha-tag">ALPHA</span>
        </div>
        <button type="button" className="toolbar-quick-open" onClick={() => showPalette('files')}
          title="Quick Open tabs and project sources (Ctrl+P)">
          <span aria-hidden="true">⌕</span><span>Quick Open</span><kbd>Ctrl+P</kbd>
        </button>
        <nav className="toolbar-actions" aria-label="Editor actions">
          <div className="toolbar-group" role="group" aria-label="File actions">
          <button onClick={newFile} title="New (Ctrl+N)">New</button>
          <button onClick={() => void openFile()} title="Open (Ctrl+O)">Open</button>
          <button onClick={() => void openFolder()} title="Choose a folder">Folder</button>
          </div>
          <div className="toolbar-group" role="group" aria-label="Navigation">
          <button onClick={() => showPalette('commands')} title="Commands (Ctrl+Shift+P)">Commands</button>
          <button onClick={showStarterTemplates} title="New Scarp starter source templates">Examples</button>
          <button onClick={() => setExplorerVisible((visible) => !visible)}
            aria-expanded={explorerVisible} aria-controls="scarp-explorer"
            title="Toggle Explorer (Ctrl+B)">Explorer</button>
          <button
            type="button"
            onClick={() => { invalidateProjectSearch(); setSearchOpen((open) => !open); }}
            aria-expanded={searchOpen}
            aria-controls="open-file-search"
            title="Search all currently open Scarp buffers (Ctrl+Shift+F)"
          >Find in Open Files</button>
          </div>
          <div className="toolbar-group" role="group" aria-label="Save and review">
          <button onClick={() => void saveFile()} disabled={!active || busy || compilerBusy || compilerSelecting} title="Save (Ctrl+S)">Save</button>
          <button onClick={() => void saveAllFiles()} disabled={busy || compilerBusy || compilerSelecting || !documents.some(isDirty)}
            title="Save All modified Scarp files (Ctrl+Alt+S)">Save All</button>
          <button onClick={() => void saveFile(true)} disabled={!active || busy || compilerBusy || compilerSelecting} title="Save As (Ctrl+Shift+S)">Save As</button>
          <button onClick={() => void compareActiveSourceWithDisk()}
            disabled={!isTauri() || !active?.path || busy || compilerBusy || compilerSelecting || compilerScanning}
            title="Read-only snapshot comparison with the current saved file; never overwrites source">Compare with Disk</button>
          <button onClick={() => void reloadFile()} disabled={!active?.path || busy || compilerBusy || compilerSelecting}
            title="Reload the saved Scarp source from disk, confirming before discarding edits">Reload</button>
          </div>
        </nav>
        <button
          className="settings-toggle"
          type="button"
          onClick={() => setEditorSettingsOpen((isOpen) => !isOpen)}
          aria-expanded={editorSettingsOpen}
          aria-controls="editor-settings"
        >⚙ Settings</button>
        <button
          className="theme-button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </header>

      {editorSettingsOpen && (
        <section id="editor-settings" className="editor-settings" aria-label="Scarp editor settings">
          <label className="editor-setting-checkbox" htmlFor="studio-auto-save">
            <input id="studio-auto-save" type="checkbox"
              checked={autoSavePreferences.enabled}
              onChange={(event) => {
                // Synchronously revoke queued writes before React commits the
                // settings update. Async pre-write guards read this ref.
                autoSaveEnabledRef.current = event.target.checked;
                setAutoSavePreferences((current) => ({
                  ...current, enabled: event.target.checked,
                }));
              }} />
            Auto Save (named .srp files only; off by default)
          </label>
          <label htmlFor="studio-auto-save-delay">Save after inactivity</label>
          <select id="studio-auto-save-delay" aria-label="Auto Save delay"
            value={autoSavePreferences.delay} disabled={!autoSavePreferences.enabled}
            onChange={(event) => setAutoSavePreferences((current) => ({
              ...current, delay: Number(event.target.value) as AutoSaveDelay,
            }))}>
            <option value={1000}>1 second</option>
            <option value={3000}>3 seconds (recommended)</option>
            <option value={5000}>5 seconds</option>
          </select>
          <span className="editor-settings-hint">Auto Save never opens Save As, pauses during compiler commands and rejects external disk changes.</span>
          <label htmlFor="editor-font-size">Font size</label>
          <select
            id="editor-font-size"
            value={editorPreferences.fontSize}
            onChange={(event) => setEditorPreferences((current) => ({
              ...current, fontSize: Number(event.target.value) as EditorPreferences['fontSize'],
            }))}
          >
            {FONT_SIZES.map((size) => <option key={size} value={size}>{size} px</option>)}
          </select>
          <label htmlFor="editor-tab-size">Tab width</label>
          <select
            id="editor-tab-size"
            value={editorPreferences.tabSize}
            onChange={(event) => setEditorPreferences((current) => ({
              ...current, tabSize: Number(event.target.value) as EditorPreferences['tabSize'],
            }))}
          >
            {TAB_SIZES.map((size) => <option key={size} value={size}>{size} spaces</option>)}
          </select>
          <label className="editor-setting-checkbox" htmlFor="editor-word-wrap">
            <input
              id="editor-word-wrap"
              type="checkbox"
              checked={editorPreferences.wordWrap}
              onChange={(event) => setEditorPreferences((current) => ({
                ...current, wordWrap: event.target.checked,
              }))}
            />
            Wrap long lines
          </label>
          <label className="editor-setting-checkbox" htmlFor="editor-minimap">
            <input
              id="editor-minimap"
              type="checkbox"
              checked={editorPreferences.minimap}
              onChange={(event) => setEditorPreferences((current) => ({
                ...current, minimap: event.target.checked,
              }))}
            />
            Show code minimap
          </label>
          <label className="editor-setting-checkbox" htmlFor="editor-whitespace">
            <input
              id="editor-whitespace"
              type="checkbox"
              checked={editorPreferences.showWhitespace}
              onChange={(event) => setEditorPreferences((current) => ({
                ...current, showWhitespace: event.target.checked,
              }))}
            />
            Show spaces and tabs
          </label>
          <button
            className="settings-reset"
            type="button"
            onClick={() => {
              // Revocation is synchronous: an in-flight Auto Save preflight
              // cannot write old content while the UI state is still batching.
              const restored = restoreStudioDefaults();
              autoSaveEnabledRef.current = false;
              setAutoSavePreferences(restored.autoSave);
              setEditorPreferences(restored.editor);
              setNotice('Restored Studio Settings defaults; Auto Save is off.');
            }}
            title="Reset editor appearance and disable Auto Save"
          >Restore all defaults</button>
        </section>
      )}
      <div className="studio-main">
        <aside id="scarp-explorer" className={'sidebar' + (explorerVisible ? '' : ' sidebar-hidden')} aria-label="Scarp file explorer">
          <div className="sidebar-heading">EXPLORER</div>
          {folderPath ? (
            <section className="sidebar-section">
              <div className="folder-label" title={folderPath}>▾ {fileName(folderPath)}</div>
              <button type="button" className="folder-refresh" disabled={busy || compilerBusy || compilerSelecting}
                onClick={() => void refreshFolder()} title="Re-scan selected Scarp project sources without opening a folder dialog">
                Refresh Explorer
              </button>
              <div className="sidebar-note">Scarp sources: root, src/, tests/, examples/</div>
              {folderListingLimited && (
                <p className="sidebar-note" role="status">
                  Project file listing limited to 200 sources (at most 4096 entries
                  inspected per directory). Some files may not appear.
                </p>
              )}
              {unavailableProjectFolders.length > 0 && (
                <p className="sidebar-note" role="status">
                  Could not browse: {unavailableProjectFolders.join(', ')}.
                  Check folder access permissions.
                </p>
              )}
              {folderEntries.length ? folderEntries.map((entry) => (
                <button
                  className="file-row"
                  key={entry.path}
                  title={entry.path}
                  onClick={() => void openFolderFile(entry.path)}
                >
                  <span aria-hidden="true" className="file-glyph">S</span>{entry.name}
                </button>
              )) : <p className="sidebar-note">No .srp files found.</p>}
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
                <span className="file-name">{document.name}</span>
                {autoSaveReview.current.isHeld(document) && (
                  <span className="review-indicator" title="Review or Save these replacements; further editing resumes Auto Save">
                    Review
                  </span>
                )}
                {isDirty(document) && <span aria-label="unsaved changes">●</span>}
              </button>
            ))}
            {!documents.length && <p className="sidebar-note">No files open.</p>}
          </section>
          <section className="sidebar-section" aria-label="Scarp declaration outline">
            <div className="sidebar-heading">DECLARATION OUTLINE</div>
            <button type="button" className="file-row" disabled={!active}
              onClick={() => showPalette('symbols')} title="Go to Declaration (Ctrl+Shift+O)">
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
        </aside>

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
                <span>{document.name}</span>
                {autoSaveReview.current.isHeld(document) && (
                  <span className="review-indicator" aria-label="Manual Save required after Replace All"
                    title="Replace All changes are held from Auto Save until manual Save, Undo or further editing">
                    Review
                  </span>
                )}
                {isDirty(document) && <span className="dirty-indicator" aria-label="unsaved changes">●</span>}
                <button
                  className="tab-close"
                  onClick={(event) => { event.stopPropagation(); void closeFile(document.id); }}
                  onKeyDown={(event) => { event.stopPropagation(); }}
                  aria-label={'Close ' + document.name}
                  title={'Close ' + document.name}
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
              {projectSearchResult && projectSearchResult.query === searchQuery &&
                projectSearchResult.selection === selectedFolderRef.current && (
                <section className="project-search-results" aria-label="Read-only selected project search">
                  <div className="search-status" role="status">
                    Project (read-only): {projectSearchResult.result.hits.length} match(es) ·
                    {' '}{projectSearchResult.result.searchedFiles} / {projectSearchResult.result.totalListedFiles} listed .srp files fully searched
                    {projectSearchResult.result.truncated && (
                      <strong> · Incomplete ({projectSearchResult.result.skippedFiles} not fully searched).</strong>
                    )}
                    {' '}No files changed.
                  </div>
                  <div className="search-results" role="list" aria-label="Matches in selected Scarp project">
                    {projectSearchResult.result.hits.map((hit) => (
                      <div role="listitem"
                        key={hit.path + ':' + hit.match.offset + ':' + hit.match.sourceRevision}>
                        <button className="search-result-row" type="button"
                          onClick={() => void goToProjectSearchHit(hit, projectSearchResult.selection)}
                          title={hit.name + ' at ' + hit.match.line + ':' + hit.match.column}>
                          <span className="search-result-location">
                            {hit.name} · {hit.match.line}:{hit.match.column}
                            {hit.fromOpenTab && ' · open buffer'}
                          </span>
                          <span className="search-result-preview">{hit.match.preview}</span>
                        </button>
                      </div>
                    ))}
                    {!projectSearchResult.result.hits.length && (
                      <p className="sidebar-note">No matches among the searched project sources.</p>
                    )}
                  </div>
                </section>
              )}
            </section>
          )}
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
              <p className="disk-review-hint">No file was written. Reload rereads disk independently and asks before discarding dirty edits; Save As uses the normal guarded destination picker. Disk files may change again after this comparison.</p>
            </section>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
            </div>
          )}
          <div id="scarp-editor-panel" className="editor-panel" role="tabpanel"
            aria-labelledby={active ? 'studio-tab-' + active.id : undefined}
            aria-label={active ? undefined : 'Scarp source editor'}>
            {active ? (
              <Editor
                key={active.id}
                path={active.path || active.id + '.srp'}
                language="scarp"
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
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
                  mountedMonaco.current = monaco;
                  editorHandle.current = editor;
                  mountedEditor.current = editor;
                  mountedEditorDocumentId.current = active.id;
                  editor.onDidChangeCursorPosition((event) => {
                    setCursor({ line: event.position.lineNumber, column: event.position.column });
                  });
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
                options={{
                  automaticLayout: true, fontSize: editorPreferences.fontSize, fontFamily: 'Consolas, monospace',
                  minimap: { enabled: editorPreferences.minimap }, scrollBeyondLastLine: false,
                  renderWhitespace: editorPreferences.showWhitespace ? 'all' : 'none',
                  tabSize: editorPreferences.tabSize, wordWrap: editorPreferences.wordWrap ? 'on' : 'off', detectIndentation: false,
                }}
              />
            ) : (
              <section className="empty-state welcome-screen" aria-label="Start working in Scarp Studio">
                <div className="welcome-content">
                  <div className="empty-mark" aria-hidden="true">S</div>
                  <h1>Welcome to Scarp Studio</h1>
                  <p>A local-first workspace for Scarp source code.</p>
                  <div className="welcome-actions" role="group" aria-label="Start editing">
                    <button type="button" onClick={newFile}><strong>New Scarp file</strong><kbd>Ctrl+N</kbd></button>
                    <button type="button" onClick={() => void openFile()}><strong>Open source</strong><kbd>Ctrl+O</kbd></button>
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
          <section className={'compiler-panel output-' + outputPanelMode} aria-label="Scarp compiler output">
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
                  title={runHint ?? 'Execute the saved Scarp source using the official compiler (F5)'}>▶ Run</button>
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
                      setOutputPanelMode(revealOutputPanel); setCompilerControlsOpen(true);
                    } else setCompilerControlsOpen(open => !open);
                  }}>Setup &amp; Input</button>
                <button type="button" disabled={outputPanelMode === 'collapsed'}
                  aria-pressed={outputPanelMode === 'expanded'}
                  onClick={() => setOutputPanelMode(current => nextOutputPanelMode(current, 'expand'))}
                  title="Toggle expanded output panel">{outputPanelMode === 'expanded' ? 'Restore size' : 'Expand'}</button>
                <button type="button" ref={outputToggle} aria-expanded={outputPanelMode !== 'collapsed'}
                  aria-controls="compiler-panel-body" onClick={() => setOutputPanelMode(current => nextOutputPanelMode(current, 'toggle'))}
                  title="Toggle output panel (Ctrl+J)">{outputPanelMode === 'collapsed' ? 'Show output' : 'Hide output'}</button>
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
            <div className="compiler-setup-actions compiler-actions">
                <button type="button" onClick={() => void rescanCompilers()}
                  disabled={!isTauri() || compilerBusy || compilerSelecting || compilerScanning || busy}
                  title="Scan PATH, standard installed locations and extracted Scarp Downloads folders without executing software">
                  {compilerScanning ? 'Scanning…' : 'Scan Compiler'}
                </button>
                <button type="button" onClick={() => void downloadCompiler()}
                  disabled={!isTauri() || compilerBusy || compilerSelecting || compilerScanning || busy}
                  title="Open the official Scarp alpha.20 ZIP. Verify its published SHA-256 before trusting the extracted executable.">Download Compiler</button>
                <button onClick={() => void selectCompiler()} disabled={!isTauri() || compilerBusy || compilerSelecting || compilerScanning}
                  title="Optional: manually choose a trusted Scarp executable if automatic discovery missed it">
                  {compilerSelecting ? 'Checking Compiler…' : compilerPath ? 'Change Compiler' : 'Choose Manually'}
                </button>
            </div>
            <div className="compiler-meta">
              {compilerInfo || (compilerPath
                ? 'Compiler configured; version checked on the next Run/Verify.'
                : automaticCompiler
                  ? 'Detected (not yet trusted): ' + automaticCompiler
                  : 'No compiler detected. Download the official ZIP, extract it, then click Scan Compiler.')}
              {automaticCompiler && !compilerPath && (
                <div className="compiler-location-approval">
                  <span>Is your Scarp compiler at <code>{automaticCompiler}</code>?</span>
                  <button type="button" onClick={() => void confirmDetectedCompiler()}
                    disabled={compilerSelecting || compilerScanning || compilerBusy}>
                    Yes, confirm this location
                  </button>
                </div>
              )}
              {detectedCompilers.length > 1 && !compilerPath && (
                <label className="compiler-candidate-select">Detected candidate:
                  <select aria-label="Detected compiler to trust and use on Run"
                    value={automaticCompiler ?? ''}
                    onChange={(event) => setPreferredDetectedCompiler(event.target.value)}>
                    {detectedCompilers.map((candidate) =>
                      <option key={candidate} value={candidate}>{candidate}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="project-actions" aria-label="Selected Scarp project commands">
              <span>PROJECT</span>
              <button type="button" onClick={() => void runProjectAction('info')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath}
                title="Inspect the chosen project's manifest and entrypoint">Info</button>
              <button type="button" onClick={() => void runProjectAction('verify')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath ||
                  dirtySelectedProjectSources.length > 0}
                title="Verify the chosen Scarp project without executing code; save edited project sources first">Verify Project</button>
              <button type="button" onClick={() => void runProjectAction('run')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath ||
                  dirtySelectedProjectSources.length > 0 || stdinValidationError !== null}
                title={stdinValidationError ?? 'Execute the project entrypoint with preloaded input; save modified files in this project first'}>Run Project</button>
              <button type="button" onClick={() => void runProjectAction('list-tests')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath ||
                  dirtySelectedProjectSources.length > 0}
                title="List saved project tests without executing them; save edited project sources first">List Tests</button>
              <button type="button" onClick={() => void runProjectAction('run-tests')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath ||
                  dirtySelectedProjectSources.length > 0}
                title="Explicitly execute saved project tests; save edited project sources first">Run Tests</button>
              <span>{folderPath ? fileName(folderPath) : 'Choose a Scarp project folder'}</span>
              {dirtySelectedProjectSources.length > 0 && (
                <span className="project-dirty-warning" role="status">
                  Save {dirtySelectedProjectSources.length} modified project source(s) before
                  Verify, Run, List Tests or Run Tests. Project Info stays available.
                </span>
              )}
            </div>
            <div className="compiler-stdin">
              <label htmlFor="scarp-stdin">Program input (Run / Run Project; preloaded UTF-8 lines)</label>
              <label className="compiler-input-mode">
                <input type="checkbox" checked={promptInputMode} disabled={compilerBusy}
                  onChange={(event) => {
                    inputRevision.current++;
                    setPromptInputMode(event.target.checked);
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
                  inputRevision.current++;
                  setStdinText(event.target.value);
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
            </div>
            </div>
            <div className="compiler-results" tabIndex={0} aria-label="Compiler results and diagnostics">
            {projectTestResult && projectTestResult.folder === folderPath && (
              <section className="project-test-report" aria-label="Scarp project test results">
                <div className="project-test-heading">
                  <strong>{projectTestResult.report.mode === 'list' ? 'DISCOVERED TESTS' : 'PROJECT TEST RESULTS'}</strong>
                  <span>{projectTestResult.report.discovered} total ·
                    {projectTestResult.report.passed} passed ·
                    {projectTestResult.report.failed} failed</span>
                  <button type="button" onClick={() => setProjectTestResult(null)}
                    title="Hide the structured project test summary">Hide</button>
                </div>
                <ul className="project-test-list">
                  {projectTestResult.report.tests.map((test) => (
                    <li key={test.path} className={'project-test-' + test.status}>
                      <strong>{test.status === 'passed' ? 'PASS' :
                        test.status === 'failed' ? 'FAIL' : 'TEST'}</strong>
                      <span>{test.path}</span>
                      <button type="button" className="project-test-open"
                        disabled={busy || compilerBusy || compilerSelecting ||
                          !resolveListedTestSource(
                            test.path, projectTestResult.folder, selectedFolderRef.current,
                          )}
                        onClick={() => openProjectTestSource(test.path, projectTestResult.folder)}
                        title="Open only if this test is in the current Scarp Explorer listing">
                        Open Source
                      </button>
                      {test.message && (
                        <div className="project-test-error">
                          <strong>{test.code || test.phase || 'Scarp test failure'}</strong>
                          {' — ' + test.message}
                          {test.help && <div>{test.help}</div>}
                        </div>
                      )}
                    </li>
                  ))}
                  {!projectTestResult.report.tests.length &&
                    <li>No project tests were discovered.</li>}
                </ul>
              </section>
            )}
            {diagnostic && (
              <div className="compiler-diagnostic" role="status">
                <strong>{diagnostic.code || 'Scarp Verify error'}</strong>
                <span>{diagnostic.message}</span>
                {diagnosticPosition && (
                  <button type="button" onClick={revealDiagnostic}
                    title="Navigate to this Verify error in the unchanged Scarp source (F8)">
                    Go to line {diagnostic.line}, column {diagnostic.column} (F8)
                  </button>
                )}
                {diagnostic.help && <span className="compiler-diagnostic-help">{diagnostic.help}</span>}
              </div>
            )}
            <pre className="compiler-output" role="log" aria-live="polite">{outputFreshnessWarning
                    ? outputFreshnessWarning + '\n\n' + compilerOutput : compilerOutput}</pre>
            </div>
            </div>
          </section>
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
              // The input owns listbox selection; only input and Close are
              // in the modal tab order. Keep focus inside until dismissal.
              event.preventDefault();
              if (document.activeElement === paletteDismiss.current) paletteInput.current?.focus();
              else paletteDismiss.current?.focus();
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
                    <span className="nav-result-detail">{item.detail}</span>
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
        <span className="status-notice" role="status" title={busy ? 'Working…' : notice}>{busy ? 'Working…' : notice}</span>
        <div className="status-items" aria-label="Editor status">
        <button className="status-nav" onClick={() => showPalette('line')} disabled={!active}
          title="Go to Line (Ctrl+G)">
          {active ? 'Ln ' + cursor.line + ', Col ' + cursor.column : ''}
        </button>
        <span title={compilerPath || automaticCompiler || 'No compiler detected'}>
          {compilerPath ? 'Scarp compiler ready' :
            automaticCompiler ? 'Compiler detected · approval required' : 'Compiler not detected'}
        </span>
        <button type="button" className="status-nav"
          onClick={() => setEditorSettingsOpen(true)} title="Configure Auto Save (Ctrl+,)">
          Auto Save: {autoSavePreferences.enabled ? 'On' : 'Off'}
          {autoSaveReview.current.reviewCount(documents) > 0 &&
            ' · Review ' + autoSaveReview.current.reviewCount(documents)}
        </button>
        <span>Scarp · .srp</span>
        <span className="status-version" title="Unreleased development candidate">0.0.2-alpha.1 · development candidate</span>
        </div>
      </footer>
    </div>
  );
}
