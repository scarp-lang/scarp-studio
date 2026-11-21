import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { ask, open } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  fileName, isDirty, sameFilePath,
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
  clampLineLocation, cycleTabId, filterNavigationEntries, parseLineLocation,
  type NavigationEntry,
} from './model/navigation';
import { scanScarpFunctions, type ScarpFunctionSymbol } from './language/assist';
import { NativeDialogGate } from './model/dialogGate';
import { getScarpStarterTemplate, scarpStarterTemplates } from './model/starterTemplates';
import { runnableSource } from './model/compilerReadiness';
import { MAX_INPUT_BYTES, programInputBytes, validateProgramInput } from './model/programInput';
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
import { dirtyProjectSourceNames, projectSourceBuffersChanged } from './model/projectSourceState';
import { projectResultFreshness, sourceResultIsStale } from './model/resultFreshness';
import { isCurrentSingleSaveRequest } from './model/saveSnapshotGuard';

import {
  isCurrentSearchHit, searchOpenFiles, type OpenFileSearchHit,
} from './model/openFileSearch';
import { planOpenFileReplacement, type OpenFileReplacePlan } from './model/openFileReplace';
import { canUndoOpenFileReplace, createOpenFileReplaceUndo, type OpenFileReplaceUndo } from './model/openFileReplaceUndo';

type Theme = 'dark' | 'light';
type FolderEntry = { name: string; path: string };
type PaletteMode = 'files' | 'commands' | 'line';

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
  { id: 'close', label: 'Close Current Tab', detail: 'Ctrl+W' },
  { id: 'find-open-files', label: 'Find in Open Scarp Files', detail: 'Ctrl+Shift+F' },
  { id: 'replace-open-files', label: 'Find and Replace in Open Scarp Files', detail: 'Preview and confirm; editor buffers only' },
  { id: 'undo-replace-open-files', label: 'Undo Last Replace All in Open Scarp Files', detail: 'Only if every buffer is unchanged' },
  { id: 'quick-open', label: 'Quick Open Tabs and Project Sources', detail: 'Ctrl+P' },
  { id: 'go-to-line', label: 'Go to Line and Column', detail: 'Ctrl+G' },
  { id: 'next-tab', label: 'Next Open Tab', detail: 'Ctrl+Tab' },
  { id: 'previous-tab', label: 'Previous Open Tab', detail: 'Ctrl+Shift+Tab' },
  { id: 'theme', label: 'Toggle Dark / Light Theme', detail: 'Appearance' },
  { id: 'explorer', label: 'Show / Hide Scarp Explorer', detail: 'Ctrl+B' },
  { id: 'select-compiler', label: 'Select Trusted Scarp Compiler', detail: 'Run / Verify' },
  { id: 'scan-compiler', label: 'Scan for Installed Scarp Compiler', detail: 'Non-executing discovery' },
  { id: 'download-compiler', label: 'Download Official Scarp Compiler', detail: 'Official alpha.17 Windows ZIP' },
  { id: 'run-scarp', label: 'Run Current Scarp Source', detail: 'F5 · saved .srp only' },
  { id: 'verify-scarp', label: 'Verify Current Scarp Source', detail: 'Ctrl+F5 · static analysis' },
  { id: 'stop-scarp', label: 'Stop Running Scarp Program', detail: 'Shift+F5' },
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
  function dispatch(action: EditorAction): void {
    const before = liveEditor.current;
    const next = editorReducer(before, action);
    if (next === before) return;
    const project = selectedFolderRef.current?.path;
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
  const compilerScanRevision = useRef(0);
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
  const [compilerBusy, setCompilerBusy] = useState(false);
  const [projectTestResult, setProjectTestResult] = useState<{folder: string; report: ScarpTestReport} | null>(null);
  const [compilerDiagnosticStderr, setCompilerDiagnosticStderr] = useState<string | null>(null);
  const [compilerOutputSource, setCompilerOutputSource] = useState<VerifiedSourceSnapshot | null>(null);
  // This input is session-local, not persisted or stored in source files.
  const [stdinText, setStdinText] = useState('');
  const [promptInputMode, setPromptInputMode] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode | null>(null);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteInput = useRef<HTMLInputElement | null>(null);
  const editorHandle = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const active = documents.find((document) => document.id === activeId) || null;
  const diagnostic = useMemo(() => parseScarpDiagnostic(compilerDiagnosticStderr), [compilerDiagnosticStderr]);
  const diagnosticPosition = isCurrentVerifiedSource(compilerOutputSource, active) && active?.path
    ? diagnosticSourcePosition(diagnostic, active.path, active.content) : null;
  const problemMarker = useMemo(() => verifiedProblemMarker(diagnostic, compilerOutputSource, active),
    [diagnostic, compilerOutputSource, active]);
  const functionOutline = useMemo(
    () => active ? scanScarpFunctions(active.content) : [],
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

  function jumpToFunction(symbol: ScarpFunctionSymbol): void {
    const editor = editorHandle.current;
    if (!editor) return;
    const position = { lineNumber: symbol.line, column: symbol.startColumn };
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
    setNotice('Scarp function: ' + symbol.name);
  }

  const paletteEntries: readonly NavigationEntry[] = paletteMode === 'files'
    ? buildQuickOpenEntries(documents, folderEntries)
    : studioCommands;
  const paletteResults = paletteMode === 'line'
    ? []
    : filterNavigationEntries(paletteEntries, paletteQuery);

  function showPalette(mode: PaletteMode): void {
    setPaletteMode(mode);
    setPaletteQuery('');
    setPaletteIndex(0);
  }

  function hidePalette(): void {
    setPaletteMode(null);
    setPaletteQuery('');
    setPaletteIndex(0);
  }

  useEffect(() => {
    if (paletteMode !== null) paletteInput.current?.focus();
    else if (!searchOpen) editorHandle.current?.focus();
  }, [paletteMode, activeId, searchOpen]);

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
    hidePalette();
    editor.focus();
    setNotice('Jumped to line ' + position.line + ', column ' + position.column);
  }

  function executePaletteEntry(entry: NavigationEntry): void {
    const mode = paletteMode;
    hidePalette();
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
      case 'close':
        if (liveEditor.current.activeId) void closeFile(liveEditor.current.activeId);
        break;
      case 'find-open-files': setSearchOpen(true); break;
      case 'replace-open-files': setSearchOpen(true); break;
      case 'undo-replace-open-files': undoLastOpenFileReplace(); break;
      case 'quick-open': showPalette('files'); break;
      case 'go-to-line': showPalette('line'); break;
      case 'next-tab': cycleTab(1); break;
      case 'previous-tab': cycleTab(-1); break;
      case 'theme': setTheme((current) => current === 'dark' ? 'light' : 'dark'); break;
      case 'explorer': setExplorerVisible((visible) => !visible); break;
      case 'select-compiler': void selectCompiler(); break;
      case 'scan-compiler': void rescanCompilers(); break;
      case 'download-compiler': void downloadCompiler(); break;
      case 'run-scarp': void runCompiler('exec'); break;
      case 'verify-scarp': void runCompiler('verify'); break;
      case 'stop-scarp': void stopCompiler(); break;
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
    void detectScarp().then((found) => {
      if (mounted) setDetectedCompilers(found);
    }).catch(() => { /* Manual scan exposes any discovery error explicitly. */ });
    return () => { mounted = false; };
  }, []);

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
      'Is your trusted official Scarp compiler located at:\\n' + chosen +
      '\\n\\nStudio will launch this executable to check its version and supported commands. Continue?',
      { title: 'Confirm Scarp compiler location', kind: 'warning' },
    );
    if (!approved) return false;
    const info = await probeScarp(chosen);
    setCompilerPath(chosen);
    setCompilerInfo(info);
    setCompilerOutputSource(null);
    setCompilerDiagnosticStderr(null);
    setProjectTestResult(null);
    setCompilerOutput(info + '\\nCompiler is ready. Run operates on the saved file on disk.');
    setNotice('Scarp compiler approved for this session');
    return true;
  }

  async function rescanCompilers(): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current ||
        filePickerInProgress.current || saveInProgress.current ||
        nativeDialogGate.current.isActive) return;
    selectionInProgress.current = true;
    setCompilerScanning(true);
    const revision = ++compilerScanRevision.current;
    try {
      const found = await detectScarp();
      if (revision !== compilerScanRevision.current) return;
      setDetectedCompilers(found);
      setPreferredDetectedCompiler(null);
      setNotice(found.length
        ? 'Found ' + found.length + ' Scarp compiler candidate(s); approval required before use.'
        : 'No Scarp executable found. Download the official ZIP, extract it, then scan again.');
    } catch (caught) {
      if (revision === compilerScanRevision.current) {
        setError('Compiler search failed: ' + toMessage(caught));
      }
    } finally {
      selectionInProgress.current = false;
      setCompilerScanning(false);
    }
  }

  async function downloadCompiler(): Promise<void> {
    try {
      await openCompilerDownloads();
      setNotice('Opened the official Scarp alpha.17 download; extract it and scan for the compiler.');
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
      if (!compilerPath) throw new Error('Select the trusted Scarp compiler first.');
      if (mode === 'exec') validateProgramInput(stdinText);
    } catch (caught) {
      setError(toMessage(caught));
      return;
    }
    commandInProgress.current = true;
    setCompilerBusy(true);
    setError(null);
    setCompilerOutputSource(verifiedSnapshot);
    setCompilerDiagnosticStderr(null);
    setProjectTestResult(null);
    setCompilerOutput((mode === 'exec' ? 'Running ' : 'Verifying ') + fileName(source) + '…');
    try {
      const result = await executeScarp(
        compilerPath, source, mode, expectedContent,
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
      setNotice(staleSource
        ? 'Scarp result is stale; save the changed source and rerun'
        : 'Scarp ' + mode + ' finished; see output');
    } catch (caught) {
      const message = toMessage(caught);
      setCompilerOutputSource(null);
      setCompilerDiagnosticStderr(null);
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
      setError('Select the official compiler and a Scarp project folder first.');
      return;
    }
    if (action === 'run' || action === 'verify' || action === 'run-tests') {
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
    // Capture the current listing instance AND the selected-project source
    // generation before the async compiler begins. Edits during Run Tests can
    // leave its disk-backed JSON report stale by the time the process exits.
    const reportEpoch = projectResultEpoch.current;
    const reportSelection = selectedFolderRef.current;
    commandInProgress.current = true;
    setCompilerBusy(true);
    setError(null);
    // Project operations may inspect other files. They never assign an editor
    // diagnostic position to the current open tab.
    setCompilerDiagnosticStderr(null);
    setCompilerOutputSource(null);
    setProjectTestResult(null);
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
          ' open Scarp source(s)? This changes editor buffers only; save each file separately.',
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
      setReplaceUndo(createOpenFileReplaceUndo(plan.sourceSnapshots, liveEditor.current.documents));
      setReplacePreview(null);
      setNotice('Replaced ' + plan.totalReplacements + ' occurrence(s) in ' +
        plan.changes.length + ' editor buffer(s). Save modified tabs to write to disk.');
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
      if (paletteMode === null && event.key === 'Escape' && searchOpen) {
        event.preventDefault();
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
      if (paletteMode !== null) return;
      if (key === 'tab' && event.ctrlKey) {
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
        <nav className="toolbar-actions" aria-label="Editor actions">
          <button onClick={newFile} title="New (Ctrl+N)">New</button>
          <button onClick={() => void openFile()} title="Open (Ctrl+O)">Open</button>
          <button onClick={() => void openFolder()} title="Choose a folder">Folder</button>
          <button onClick={() => showPalette('commands')} title="Commands (Ctrl+Shift+P)">Commands</button>
          <button onClick={showStarterTemplates} title="New Scarp starter source templates">Examples</button>
          <button onClick={() => setExplorerVisible((visible) => !visible)}
            aria-expanded={explorerVisible} aria-controls="scarp-explorer"
            title="Toggle Explorer (Ctrl+B)">Explorer</button>
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            aria-expanded={searchOpen}
            aria-controls="open-file-search"
            title="Search all currently open Scarp buffers (Ctrl+Shift+F)"
          >Find in Open Files</button>
          <button onClick={() => void saveFile()} disabled={!active || busy || compilerBusy || compilerSelecting} title="Save (Ctrl+S)">Save</button>
          <button onClick={() => void saveAllFiles()} disabled={busy || compilerBusy || compilerSelecting || !documents.some(isDirty)}
            title="Save All modified Scarp files (Ctrl+Alt+S)">Save All</button>
          <button onClick={() => void saveFile(true)} disabled={!active || busy || compilerBusy || compilerSelecting} title="Save As (Ctrl+Shift+S)">Save As</button>
          <button onClick={() => void reloadFile()} disabled={!active?.path || busy || compilerBusy || compilerSelecting}
            title="Reload the saved Scarp source from disk, confirming before discarding edits">Reload</button>
        </nav>
        <button
          className="settings-toggle"
          type="button"
          onClick={() => setEditorSettingsOpen((isOpen) => !isOpen)}
          aria-expanded={editorSettingsOpen}
          aria-controls="editor-settings"
        >Editor settings</button>
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
          <button
            className="settings-reset"
            type="button"
            onClick={() => setEditorPreferences({ ...DEFAULT_EDITOR_PREFERENCES })}
          >Restore defaults</button>
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
                onClick={() => dispatch({ type: 'activate', id: document.id })}
                title={document.path || document.name}
              >
                <span aria-hidden="true" className="file-glyph">S</span>
                <span className="file-name">{document.name}</span>
                {isDirty(document) && <span aria-label="unsaved changes">●</span>}
              </button>
            ))}
            {!documents.length && <p className="sidebar-note">No files open.</p>}
          </section>
          <section className="sidebar-section" aria-label="Scarp function outline">
            <div className="sidebar-heading">FUNCTION OUTLINE</div>
            {functionOutline.map((symbol) => (
              <button type="button" className="file-row outline-row"
                key={symbol.line + ':' + symbol.name}
                onClick={() => jumpToFunction(symbol)}
                title={'Go to ' + symbol.name + ' at line ' + symbol.line}>
                <span className="file-glyph" aria-hidden="true">ƒ</span>
                <span className="file-name">{symbol.name}</span>
                <span className="outline-line">:{symbol.line}</span>
              </button>
            ))}
            {!functionOutline.length && <p className="sidebar-note">No function declarations in this file.</p>}
            {functionOutline.length >= 500 &&
              <p className="sidebar-note" role="status">Function outline limited to 500 entries.</p>}
          </section>
        </aside>

        <main className="workspace">
          <div className="tabs" role="tablist" aria-label="Open source files">
            {documents.map((document) => (
              <div
                role="tab"
                aria-selected={document.id === activeId}
                className={'tab' + (document.id === activeId ? ' active' : '')}
                key={document.id}
                onClick={() => dispatch({ type: 'activate', id: document.id })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    dispatch({ type: 'activate', id: document.id });
                  }
                }}
                tabIndex={0}
                title={document.path || document.name}
              >
                <span>{document.name}</span>
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
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <label className="search-option">
                  <input
                    type="checkbox"
                    checked={searchCaseSensitive}
                    onChange={(event) => setSearchCaseSensitive(event.target.checked)}
                  />
                  Match case
                </label>
                <label className="search-option">
                  <input
                    type="checkbox"
                    checked={searchWholeWord}
                    onChange={(event) => setSearchWholeWord(event.target.checked)}
                  />
                  Whole word
                </label>
                <button type="button" onClick={() => setSearchOpen(false)}
                  aria-label="Close open-file search">Close</button>
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
                  ` · Search budget reached; results may be incomplete. ${openFileMatches.skippedDocuments} buffers skipped.`}
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
            </section>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
            </div>
          )}
          <div className="editor-panel">
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
                  minimap: { enabled: false }, scrollBeyondLastLine: false,
                  tabSize: editorPreferences.tabSize, wordWrap: editorPreferences.wordWrap ? 'on' : 'off', detectIndentation: false,
                }}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-mark">S</div>
                <h1>Scarp Studio</h1>
                <p>Open a .srp file or create a new one to begin.</p>
                <button onClick={newFile}>New Scarp File</button>
              </div>
            )}
          </div>
          <section className="compiler-panel" aria-label="Scarp compiler output">
            <div className="compiler-heading">
              <strong>SCARP OUTPUT</strong>
              <div className="compiler-actions">
                <button onClick={() => void selectCompiler()} disabled={compilerBusy || compilerSelecting}
                  title="Choose a trusted Scarp executable; Studio will execute it to verify its version">
                  {compilerSelecting ? 'Checking Compiler…' : compilerPath ? 'Change Compiler' : 'Select Compiler'}
                </button>
                <button onClick={() => void runCompiler('exec')}
                  disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !active || !active.path || isDirty(active)}
                  title="Execute the saved Scarp source using the official compiler">Run</button>
                <button onClick={() => void runCompiler('verify')}
                  disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !active || !active.path || isDirty(active)}
                  title="Statically verify saved Scarp source without runtime execution">Verify</button>
                <button onClick={() => void stopCompiler()} disabled={!compilerBusy && !compilerSelecting}
                  title="Stop a running Scarp process or compiler capability probe">Stop</button>
              </div>
            </div>
            <div className="compiler-meta">{compilerInfo || (compilerPath
              ? 'Compiler configured; version checked on the next Run/Verify.'
              : 'No compiler selected')}</div>
            <div className="project-actions" aria-label="Selected Scarp project commands">
              <span>PROJECT</span>
              <button type="button" onClick={() => void runProjectAction('info')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath}
                title="Inspect the chosen project's manifest and entrypoint">Info</button>
              <button type="button" onClick={() => void runProjectAction('verify')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath}
                title="Verify the chosen Scarp project without executing code">Verify Project</button>
              <button type="button" onClick={() => void runProjectAction('run')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath ||
                  dirtyProjectSourceNames(documents, folderPath).length > 0}
                title="Execute the project entrypoint with preloaded input; save modified files in this project first">Run Project</button>
              <button type="button" onClick={() => void runProjectAction('list-tests')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath}
                title="List discovered project tests without running them">List Tests</button>
              <button type="button" onClick={() => void runProjectAction('run-tests')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath}
                title="Explicitly execute the chosen project's test files">Run Tests</button>
              <span>{folderPath ? fileName(folderPath) : 'Choose a Scarp project folder'}</span>
            </div>
            <div className="compiler-stdin">
              <label htmlFor="scarp-stdin">Program input (Run / Run Project; preloaded UTF-8 lines)</label>
              <label className="compiler-input-mode">
                <input type="checkbox" checked={promptInputMode} disabled={compilerBusy}
                  onChange={(event) => setPromptInputMode(event.target.checked)} />
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
                onChange={(event) => setStdinText(event.target.value)}
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
              </div>
            </div>
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
            <pre className="compiler-output" role="log" aria-live="polite">{compilerOutput}</pre>
          </section>
        </main>
      </div>
      {paletteMode !== null && (
        <div
          className="nav-overlay"
          onMouseDown={(event) => { if (event.target === event.currentTarget) hidePalette(); }}
        >
          <section className="nav-dialog" role="dialog" aria-modal="true"
            aria-label={paletteMode === 'files' ? 'Quick Open Scarp tabs and project sources' : paletteMode === 'commands' ? 'Scarp Studio commands' : 'Go to line'}>
            <div className="nav-query-row">
              <span aria-hidden="true">{paletteMode === 'files' ? '▤' : paletteMode === 'commands' ? '⌘' : ':'}</span>
              <input
                ref={paletteInput}
                aria-label={paletteMode === 'files' ? 'Search open Scarp tabs and listed project files' : paletteMode === 'commands' ? 'Search editor commands' : 'Line and optional column'}
                placeholder={paletteMode === 'files' ? 'Find an open or project .srp file…' : paletteMode === 'commands' ? 'Type a Studio command…' : 'Line or line:column (e.g. 12:4)'}
                value={paletteQuery}
                onChange={(event) => { setPaletteQuery(event.target.value); setPaletteIndex(0); }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    if (paletteMode !== 'line') {
                      setPaletteIndex((current) => paletteResults.length
                        ? (current + (event.key === 'ArrowDown' ? 1 : -1) + paletteResults.length) % paletteResults.length
                        : 0);
                    }
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    if (paletteMode === 'line') goToLine();
                    else if (paletteResults[paletteIndex]) executePaletteEntry(paletteResults[paletteIndex]);
                  }
                }}
              />
              <button type="button" className="nav-dismiss" onClick={hidePalette} aria-label="Close navigation">×</button>
            </div>
            {paletteMode === 'line' ? (
              <div className="nav-hint">
                {parseLineLocation(paletteQuery)
                  ? 'Press Enter to move the cursor. Out-of-range locations are clamped to the document.'
                  : 'Enter a positive line number, optionally followed by :column.'}
              </div>
            ) : (
              <div className="nav-results" role="listbox" aria-label="Navigation results">
                {paletteResults.map((item, index) => (
                  <button type="button" role="option" aria-selected={index === paletteIndex}
                    key={item.id} className={'nav-result' + (index === paletteIndex ? ' selected' : '')}
                    onMouseEnter={() => setPaletteIndex(index)}
                    onClick={() => executePaletteEntry(item)}>
                    <span className="nav-result-name">{item.label}</span>
                    <span className="nav-result-detail">{item.detail}</span>
                  </button>
                ))}
                {!paletteResults.length && <p className="nav-hint">No matching Scarp Studio items.</p>}
              </div>
            )}
            <div className="nav-footer">↑ ↓ Navigate · Enter Select · Esc Close</div>
          </section>
        </div>
      )}
      <footer className="status-bar">
        <span>{busy ? 'Working…' : notice}</span>
        <button className="status-nav" onClick={() => showPalette('line')} disabled={!active}
          title="Go to Line (Ctrl+G)">
          {active ? 'Ln ' + cursor.line + ', Col ' + cursor.column : ''}
        </button>
        <span>Scarp · .srp</span>
        <span>0.0.2-alpha.1 · development candidate</span>
      </footer>
    </div>
  );
}
