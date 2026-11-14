import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { ask, open } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  fileName, isDirty, sameFilePath,
} from './model/documents';
import { editorReducer, initialEditorState, isUnchangedSnapshot, sameDirtyDocuments, type EditorAction } from './model/editorState';
import { pickSourceFile, writeSourceFile } from './services/files';
import { chooseSourceFolder, readFolderSource } from './services/folders';
import {
  clampLineLocation, cycleTabId, filterNavigationEntries, parseLineLocation,
  type NavigationEntry,
} from './model/navigation';
import { scanScarpFunctions, type ScarpFunctionSymbol } from './language/assist';
import { NativeDialogGate } from './model/dialogGate';
import { getScarpStarterTemplate, scarpStarterTemplates } from './model/starterTemplates';
import { runnableSource } from './model/compilerReadiness';
import { MAX_INPUT_BYTES, programInputBytes, validateProgramInput } from './model/programInput';
import { exitBlockReason } from './model/exitGuards';
import { executeScarp, probeScarp, stopScarp, type ScarpMode } from './services/compiler';
import { diagnosticSourcePosition, parseScarpDiagnostic } from './model/diagnostics';
import { verifiedProblemMarker } from './model/problemMarkers';
import { scarpProjectAction, type ScarpProjectAction } from './services/project';

import {
  isCurrentSearchHit, searchOpenFiles, type OpenFileSearchHit,
} from './model/openFileSearch';

type Theme = 'dark' | 'light';
type FolderEntry = { name: string; path: string };
type PaletteMode = 'files' | 'commands' | 'line';

/** Actions are deliberately limited to the Scarp-only editor. */
const studioCommands: readonly NavigationEntry[] = [
  { id: 'new', label: 'New Scarp File', detail: 'Ctrl+N' },
  { id: 'open', label: 'Open Scarp File', detail: 'Ctrl+O' },
  { id: 'folder', label: 'Choose Scarp Folder', detail: 'Explorer' },
  { id: 'save', label: 'Save Current File', detail: 'Ctrl+S' },
  { id: 'save-as', label: 'Save Current File As', detail: 'Ctrl+Shift+S' },
  { id: 'close', label: 'Close Current Tab', detail: 'Ctrl+W' },
  { id: 'find-open-files', label: 'Find in Open Scarp Files', detail: 'Ctrl+Shift+F' },
  { id: 'quick-open', label: 'Quick Open Tabs', detail: 'Ctrl+P' },
  { id: 'go-to-line', label: 'Go to Line and Column', detail: 'Ctrl+G' },
  { id: 'next-tab', label: 'Next Open Tab', detail: 'Ctrl+Tab' },
  { id: 'previous-tab', label: 'Previous Open Tab', detail: 'Ctrl+Shift+Tab' },
  { id: 'theme', label: 'Toggle Dark / Light Theme', detail: 'Appearance' },
  { id: 'explorer', label: 'Show / Hide Scarp Explorer', detail: 'Ctrl+B' },
  { id: 'select-compiler', label: 'Select Trusted Scarp Compiler', detail: 'Run / Verify' },
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

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function App() {
  const [editorState, setEditorState] = useState(initialEditorState);
  // Apply actions synchronously to the live state so native close requests and
  // file operations observe new edits before React renders the next frame.
  const liveEditor = useRef(editorState);
  const { documents, activeId } = editorState;
  function dispatch(action: EditorAction): void {
    const before = liveEditor.current;
    const next = editorReducer(before, action);
    if (next === before) return;
    // Source positions are invalid after edits, saving, or tab transitions.
    setCompilerOutputSource(null);
    liveEditor.current = next;
    setEditorState(next);
  }
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>([]);
  const [folderListingLimited, setFolderListingLimited] = useState(false);
  const [explorerVisible, setExplorerVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Scarp Studio • editor foundation');
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchWholeWord, setSearchWholeWord] = useState(false);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const mountedEditor = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const mountedMonaco = useRef<typeof import('monaco-editor') | null>(null);
  const mountedEditorDocumentId = useRef<string | null>(null);
  const pendingSearchLocation = useRef<OpenFileSearchHit | null>(null);
  const saveInProgress = useRef(false);
  // Prevent overlapping native discard prompts on repeated close attempts.
  const nativeDialogGate = useRef(new NativeDialogGate());
  const commandInProgress = useRef(false);
  const selectionInProgress = useRef(false);
  const [compilerSelecting, setCompilerSelecting] = useState(false);
  // Never silently trust a stored compiler path across sessions: an executable
  // may be replaced after the user previously approved it.
  const [compilerPath, setCompilerPath] = useState<string | null>(null);
  const [compilerInfo, setCompilerInfo] = useState<string | null>(null);
  const [compilerOutput, setCompilerOutput] = useState(
    'Select a trusted official Scarp executable to enable Run and Verify.\n' +
    'Source files are never executed automatically.',
  );
  const [compilerBusy, setCompilerBusy] = useState(false);
  const [compilerDiagnosticStderr, setCompilerDiagnosticStderr] = useState<string | null>(null);
  const [compilerOutputSource, setCompilerOutputSource] = useState<{path: string; content: string} | null>(null);
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
  const diagnosticPosition = active?.path && compilerOutputSource &&
    sameFilePath(active.path, compilerOutputSource.path) &&
    active.content === compilerOutputSource.content
    ? diagnosticSourcePosition(diagnostic, active.path, active.content) : null;
  const problemMarker = useMemo(() => verifiedProblemMarker(diagnostic, compilerOutputSource, active),
    [diagnostic, compilerOutputSource, active]);
  const functionOutline = useMemo(
    () => active ? scanScarpFunctions(active.content) : [],
    [active?.content],
  );

  const openFileMatches = useMemo(() => searchOpenFiles(
    documents, searchQuery, {
      caseSensitive: searchCaseSensitive, wholeWord: searchWholeWord,
    },
  ), [documents, searchQuery, searchCaseSensitive, searchWholeWord]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

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
    ? documents.map((item) => ({
      id: item.id,
      label: item.name,
      detail: (item.path ?? 'Unsaved Scarp source') + (isDirty(item) ? ' • modified' : ''),
    }))
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
      dispatch({ type: 'activate', id: entry.id });
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
      case 'save': void saveFile(); break;
      case 'save-as': void saveFile(true); break;
      case 'close':
        if (liveEditor.current.activeId) void closeFile(liveEditor.current.activeId);
        break;
      case 'find-open-files': setSearchOpen(true); break;
      case 'quick-open': showPalette('files'); break;
      case 'go-to-line': showPalette('line'); break;
      case 'next-tab': cycleTab(1); break;
      case 'previous-tab': cycleTab(-1); break;
      case 'theme': setTheme((current) => current === 'dark' ? 'light' : 'dark'); break;
      case 'explorer': setExplorerVisible((visible) => !visible); break;
      case 'select-compiler': void selectCompiler(); break;
      case 'run-scarp': void runCompiler('exec'); break;
      case 'verify-scarp': void runCompiler('verify'); break;
      case 'stop-scarp': void stopCompiler(); break;
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('studio.theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);

  // The close event must be cancelled synchronously before any native dialog.
  useEffect(() => {
    if (!isTauri()) return;
    let removed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested(async (event) => {
      const pending = liveEditor.current.documents.filter(isDirty);
      const blocked = exitBlockReason(
        saveInProgress.current, commandInProgress.current, selectionInProgress.current,
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
          );
          if (newBlocker ||
              !sameDirtyDocuments(pending, liveEditor.current.documents)) {
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
    setError(null);
    try {
      const selected = await pickSourceFile();
      if (selected) activateOpenedFile(selected.path, selected.content);
    } catch (caught) {
      setError('Could not open source: ' + toMessage(caught));
    }
  }

  async function openFolder(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const result = await chooseSourceFolder();
      if (!result) return;
      setFolderPath(result.path);
      setFolderEntries(result.files);
      setFolderListingLimited(result.truncated);
      setNotice(result.files.length + ' top-level .srp files shown' +
        (result.truncated ? ' (large folder; listing limited)' : ''));
    } catch (caught) {
      setError('Could not open folder: ' + toMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function openFolderFile(path: string): Promise<void> {
    setError(null);
    try {
      const content = await readFolderSource(path, folderEntries);
      activateOpenedFile(path, content);
    } catch (caught) {
      setError('Could not read folder file: ' + toMessage(caught));
    }
  }

  async function saveFile(forceSaveAs = false): Promise<void> {
    const document = liveEditor.current.documents.find((item) => item.id === activeId);
    if (!document || saveInProgress.current) return;
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
      );
      if (!path) return;
      // Preserve edits made during the asynchronous native save operation.
      dispatch({ type: 'saved', id: document.id, path, savedContent: document.content });
      setNotice('Saved ' + fileName(path));
    } catch (caught) {
      setError('Could not save source: ' + toMessage(caught));
    } finally {
      saveInProgress.current = false;
      setBusy(false);
    }
  }

  async function selectCompiler(): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current) return;
    selectionInProgress.current = true;
    setCompilerSelecting(true);
    setError(null);
    try {
      const chosen = await open({
        title: 'Select the trusted official Scarp executable (scarp.exe on Windows)',
        multiple: false,
      });
      if (typeof chosen !== 'string') return;
      const approved = await ask(
        'Scarp Studio will launch the selected executable to check its version and supported commands. ' +
        'Only continue if you trust this file. Do you want to continue?',
        { title: 'Trust the selected Scarp compiler?', kind: 'warning' },
      );
      if (!approved) return;
      const info = await probeScarp(chosen);
      setCompilerPath(chosen);
      setCompilerInfo(info);
      setCompilerOutputSource(null);
      setCompilerDiagnosticStderr(null);
      setCompilerOutput(info + '\nCompiler is ready. Run operates on the saved file on disk.');
      setNotice('Scarp compiler configured');
    } catch (caught) {
      setError('Compiler selection failed: ' + toMessage(caught));
    } finally {
      selectionInProgress.current = false;
      setCompilerSelecting(false);
    }
  }

  async function runCompiler(mode: ScarpMode): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current) return;
    if (saveInProgress.current) {
      setError('Finish saving before running the compiler.');
      return;
    }
    let source: string;
    let expectedContent: string;
    try {
      const selected = liveEditor.current.documents.find(
        (item) => item.id === liveEditor.current.activeId,
      ) ?? null;
      source = runnableSource(selected);
      expectedContent = selected!.savedContent;
      if (!compilerPath) throw new Error('Select the trusted Scarp compiler first.');
      if (mode === 'exec') validateProgramInput(stdinText);
    } catch (caught) {
      setError(toMessage(caught));
      return;
    }
    commandInProgress.current = true;
    setCompilerBusy(true);
    setError(null);
    setCompilerOutputSource({ path: source, content: expectedContent });
    setCompilerDiagnosticStderr(null);
    setCompilerOutput((mode === 'exec' ? 'Running ' : 'Verifying ') + fileName(source) + '…');
    try {
      const result = await executeScarp(
        compilerPath, source, mode, expectedContent,
        mode === 'exec' ? stdinText : '',
        mode === 'exec' && promptInputMode,
      );
      setCompilerOutput(result.output);
      setCompilerDiagnosticStderr(result.diagnosticStderr);
      setNotice('Scarp ' + mode + ' finished; see output');
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
    if (!current?.path || !compilerOutputSource ||
        !sameFilePath(current.path, compilerOutputSource.path) ||
        current.content !== compilerOutputSource.content ||
        mountedEditorDocumentId.current !== current.id) return;
    const position = diagnosticSourcePosition(diagnostic, current.path, current.content);
    const editor = mountedEditor.current;
    if (!position || !editor) return;
    pendingSearchLocation.current = null;
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
  }

  async function runProjectAction(action: ScarpProjectAction): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current ||
        saveInProgress.current) return;
    if (!compilerPath || !folderPath) {
      setError('Select the official compiler and a Scarp project folder first.');
      return;
    }
    commandInProgress.current = true;
    setCompilerBusy(true);
    setError(null);
    // Project operations may inspect other files. They never assign an editor
    // diagnostic position to the current open tab.
    setCompilerDiagnosticStderr(null);
    setCompilerOutputSource(null);
    setCompilerOutput('Scarp project ' + action + '…');
    try {
      const output = await scarpProjectAction(compilerPath, folderPath, action);
      setCompilerOutput(output);
      setNotice('Scarp project ' + action + ' finished');
    } catch (caught) {
      const message = toMessage(caught);
      setCompilerOutput('Scarp project ' + action + ' could not complete:\\n' + message);
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
    if (saveInProgress.current) {
      setError('Finish the current save before closing a tab.');
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
      } else if (key === 'w' && activeId) {
        event.preventDefault();
        void closeFile(activeId);
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
          <button onClick={() => void saveFile()} disabled={!active || busy} title="Save (Ctrl+S)">Save</button>
          <button onClick={() => void saveFile(true)} disabled={!active || busy} title="Save As (Ctrl+Shift+S)">Save As</button>
        </nav>
        <button
          className="theme-button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </header>

      <div className="studio-main">
        <aside id="scarp-explorer" className={'sidebar' + (explorerVisible ? '' : ' sidebar-hidden')} aria-label="Scarp file explorer">
          <div className="sidebar-heading">EXPLORER</div>
          {folderPath ? (
            <section className="sidebar-section">
              <div className="folder-label" title={folderPath}>▾ {fileName(folderPath)}</div>
              <div className="sidebar-note">Top-level Scarp files</div>
              {folderListingLimited && (
                <p className="sidebar-note" role="status">
                  Large folder: listing limited to 200 Scarp files from the first
                  4096 directory entries. Some files may not appear.
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
              <div className="search-status" role="status" aria-live="polite">
                {openFileMatches.error ||
                  (searchQuery
                    ? `${openFileMatches.hits.length} matches in open files`
                    : 'Search only already-open Scarp files. No files are read from disk.')}
                {openFileMatches.truncated &&
                  ` · Search budget reached; results may be incomplete. ${openFileMatches.skippedDocuments} buffers skipped.`}
              </div>
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
                  automaticLayout: true, fontSize: 14, fontFamily: 'Consolas, monospace',
                  minimap: { enabled: false }, scrollBeyondLastLine: false,
                  tabSize: 4, wordWrap: 'on', detectIndentation: false,
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
                <button onClick={() => void stopCompiler()} disabled={!compilerBusy}
                  title="Stop the active compiler process">Stop</button>
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
              <button type="button" onClick={() => void runProjectAction('list-tests')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath}
                title="List discovered project tests without running them">List Tests</button>
              <button type="button" onClick={() => void runProjectAction('run-tests')}
                disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !compilerPath || !folderPath}
                title="Explicitly execute the chosen project's test files">Run Tests</button>
              <span>{folderPath ? fileName(folderPath) : 'Choose a Scarp project folder'}</span>
            </div>
            <div className="compiler-stdin">
              <label htmlFor="scarp-stdin">Program input (Run only; preloaded UTF-8 lines)</label>
              <label className="compiler-input-mode">
                <input type="checkbox" checked={promptInputMode} disabled={compilerBusy}
                  onChange={(event) => setPromptInputMode(event.target.checked)} />
                Enable alpha.10 prompt functions (input/ask)
              </label>
              <div className="compiler-meta">
                All replies must be entered before Run. This enables the official --interactive
                flag for alpha.10; it is not a live terminal. Output appears after completion.
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
            aria-label={paletteMode === 'files' ? 'Quick Open Scarp tabs' : paletteMode === 'commands' ? 'Scarp Studio commands' : 'Go to line'}>
            <div className="nav-query-row">
              <span aria-hidden="true">{paletteMode === 'files' ? '▤' : paletteMode === 'commands' ? '⌘' : ':'}</span>
              <input
                ref={paletteInput}
                aria-label={paletteMode === 'files' ? 'Search open Scarp tabs' : paletteMode === 'commands' ? 'Search editor commands' : 'Line and optional column'}
                placeholder={paletteMode === 'files' ? 'Find an open .srp file…' : paletteMode === 'commands' ? 'Type a Studio command…' : 'Line or line:column (e.g. 12:4)'}
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
