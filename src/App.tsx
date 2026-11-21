import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import StudioSettingsPanel from './components/StudioSettingsPanel';
import { ask, open } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  fileName, isDirty, type StudioDocument,
} from './model/documents';
import { editorReducer, initialEditorState, isUnchangedSnapshot, sameDirtyDocuments, type EditorAction } from './model/editorState';
import { pickSourceFile, writeSourceFile } from './services/files';
import { chooseSourceFolder, readFolderSource } from './services/folders';
import { captureRunSnapshot, validateRunSnapshot, type ScarpRunSnapshot } from './model/compilerReadiness';
import { exitBlockReason } from './model/exitGuards';
import { canAutoSave, loadStudioSettings, storeStudioSettings, type StudioSettings } from './model/studioSettings';
import { detectScarp, executeScarp, openScarpDownloads, probeScarp, stopScarp, type ScarpMode } from './services/compiler';

type FolderEntry = { name: string; path: string };

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
    const next = editorReducer(liveEditor.current, action);
    liveEditor.current = next;
    setEditorState(next);
  }
  const [settings, setSettings] = useState<StudioSettings>(loadStudioSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = settings.theme;
  function changeSettings(patch: Partial<StudioSettings>): void {
    setSettings((current) => ({ ...current, ...patch }));
  }
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Scarp Studio • editor foundation');
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const saveInProgress = useRef(false);
  const autoSaveTimers = useRef(new Map<string, {
    document: StudioDocument; delay: number; timeout: number;
  }>());
  const commandInProgress = useRef(false);
  const selectionInProgress = useRef(false);
  const exitConfirmationInProgress = useRef(false);
  const [compilerSelecting, setCompilerSelecting] = useState(false);
  // Never silently trust a stored compiler path across sessions: an executable
  // may be replaced after the user previously approved it.
  const [compilerPath, setCompilerPath] = useState<string | null>(null);
  const [compilerInfo, setCompilerInfo] = useState<string | null>(null);
  const [compilerOutput, setCompilerOutput] = useState(
    'Scarp Studio scans common compiler locations automatically.\n' +
    'Source files are never executed automatically.',
  );
  const [compilerBusy, setCompilerBusy] = useState(false);
  const [compilerScanning, setCompilerScanning] = useState(false);
  const [detectedCompilers, setDetectedCompilers] = useState<string[]>([]);
  const [preferredDetectedCompiler, setPreferredDetectedCompiler] = useState<string | null>(null);
  // A newer manual scan or first-Run scan invalidates an older startup/focus result.
  const compilerScanRevision = useRef(0);

  const active = documents.find((document) => document.id === activeId) || null;
  const automaticCompiler = detectedCompilers.includes(preferredDetectedCompiler ?? '')
    ? preferredDetectedCompiler : detectedCompilers[0] ?? null;

  // Discover on startup and again when Studio regains focus after a download.
  // Detection reads filenames only; no discovered executable is launched.
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let pending = false;
    const refresh = () => {
      if (pending || commandInProgress.current || selectionInProgress.current) return;
      pending = true;
      const revision = ++compilerScanRevision.current;
      void detectScarp().then((found) => {
        if (!disposed && revision === compilerScanRevision.current) {
          setDetectedCompilers(found);
        }
      }).catch(() => {
        // The manual selection and Scan action remain available.
      }).finally(() => { pending = false; });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      disposed = true;
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storeStudioSettings(settings);
  }, [settings, theme]);

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
      if (!pending.length && !blocked && !exitConfirmationInProgress.current) return;
      event.preventDefault();
      if (blocked) {
        setError(blocked);
        return;
      }
      if (exitConfirmationInProgress.current) return;
      exitConfirmationInProgress.current = true;
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
        exitConfirmationInProgress.current = false;
      }
    }).then((cleanup) => {
      if (removed) cleanup();
      else unlisten = cleanup;
    }).catch((caught: unknown) => setError(toMessage(caught)));
    return () => { removed = true; unlisten?.(); };
  }, []);

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
      setNotice(result.files.length + ' top-level .srp files found');
    } catch (caught) {
      setError('Could not open folder: ' + toMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function openFolderFile(path: string): Promise<void> {
    setError(null);
    try {
      const content = await readFolderSource(path);
      activateOpenedFile(path, content);
    } catch (caught) {
      setError('Could not read folder file: ' + toMessage(caught));
    }
  }

  /**
   * Save a snapshot of the correct document even when the active tab changes
   * while an OS dialog or write is pending. Writes re-check external changes.
   */
  async function saveDocument(
    id: string, forceSaveAs = false, automatic = false, expected?: StudioDocument,
  ): Promise<void> {
    const document = liveEditor.current.documents.find((item) => item.id === id);
    if (!document || saveInProgress.current) return;
    if (automatic && (!settings.autoSave || !canAutoSave(document) || document !== expected)) return;
    saveInProgress.current = true;
    if (!automatic) {
      setError(null);
      setBusy(true);
    }
    try {
      const path = await writeSourceFile(
        document,
        forceSaveAs,
        liveEditor.current.documents
          .filter((item) => item.id !== document.id && item.path !== null)
          .map((item) => item.path as string),
      );
      if (!path) return;
      // Record the exact bytes written; newer keystrokes remain visibly dirty.
      dispatch({ type: 'saved', id: document.id, path, savedContent: document.content });
      setNotice((automatic ? 'Auto saved ' : 'Saved ') + fileName(path));
      if (automatic) setError((current) =>
        current?.startsWith('Auto Save failed for ') ? null : current);
    } catch (caught) {
      setError((automatic ? 'Auto Save failed for ' + document.name + ': '
        : 'Could not save source: ') + toMessage(caught));
    } finally {
      saveInProgress.current = false;
      if (!automatic) setBusy(false);
    }
  }

  async function saveFile(forceSaveAs = false): Promise<void> {
    const id = liveEditor.current.activeId;
    if (id) await saveDocument(id, forceSaveAs);
  }

  // Per-document debounce: switching tabs or editing another document does
  // not postpone an unrelated file's pending save. No Save As prompts here.
  useEffect(() => {
    const timers = autoSaveTimers.current;
    for (const [id, pending] of timers) {
      const current = documents.find((doc) => doc.id === id);
      if (!settings.autoSave || !isTauri() || !current || !canAutoSave(current) ||
          current !== pending.document || pending.delay !== settings.autoSaveDelay) {
        window.clearTimeout(pending.timeout);
        timers.delete(id);
      }
    }
    if (!settings.autoSave || !isTauri()) return;
    for (const document of documents) {
      if (!canAutoSave(document) || timers.has(document.id)) continue;
      const timeout = window.setTimeout(() => {
        if (timers.get(document.id)?.timeout !== timeout) return;
        timers.delete(document.id);
        void saveDocument(document.id, false, true, document);
      }, settings.autoSaveDelay);
      timers.set(document.id, { document, delay: settings.autoSaveDelay, timeout });
    }
  }, [documents, settings.autoSave, settings.autoSaveDelay]);

  useEffect(() => () => {
    for (const timer of autoSaveTimers.current.values()) {
      window.clearTimeout(timer.timeout);
    }
    autoSaveTimers.current.clear();
  }, []);

  async function rescanCompilers(): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current) return;
    selectionInProgress.current = true;
    setCompilerScanning(true);
    setError(null);
    const revision = ++compilerScanRevision.current;
    try {
      const found = await detectScarp();
      if (revision !== compilerScanRevision.current) return;
      setDetectedCompilers(found);
      setPreferredDetectedCompiler(null);
      setNotice(found.length
        ? 'Found ' + found.length + ' Scarp compiler candidate(s); approval required before use.'
        : 'No extracted Scarp compiler found in standard install locations.');
    } catch (caught) {
      if (revision === compilerScanRevision.current) {
        setError('Compiler search failed: ' + toMessage(caught));
      }
    } finally {
      selectionInProgress.current = false;
      setCompilerScanning(false);
    }
  }

  async function openCompilerDownloads(): Promise<void> {
    if (!isTauri()) {
      setError('Download the official compiler from https://github.com/scarp-lang/scarp/releases');
      return;
    }
    try {
      await openScarpDownloads();
      setNotice('Download the official Scarp ZIP, extract it to Downloads/Scarp, then return to Studio (or click Scan).');
    } catch (caught) {
      setError('Could not open compiler downloads: ' + toMessage(caught));
    }
  }

  /** Show the full location before executing even a version probe. */
  async function approveCompilerLocation(path: string): Promise<boolean> {
    const approved = await ask(
      'Is this your Scarp compiler location?\\n\\n' + path +
      '\\n\\nIf you confirm, Studio will launch this executable to check its version ' +
      'and supported commands. It has the same operating-system access as your account. ' +
      'Only confirm a compiler you trust.',
      { title: 'Confirm Scarp compiler location', kind: 'warning' },
    );
    if (!approved) return false;
    const info = await probeScarp(path);
    setCompilerPath(path);
    setCompilerInfo(info);
    setCompilerOutput(info + '\\nCompiler path confirmed: ' + path +
      '\\nRun operates on the saved source on disk.');
    setNotice('Scarp compiler confirmed for this session');
    return true;
  }

  async function confirmDetectedCompiler(): Promise<void> {
    if (!isTauri() || commandInProgress.current || selectionInProgress.current) return;
    if (!automaticCompiler) {
      setError('No detected compiler to confirm. Scan again or choose the executable manually.');
      return;
    }
    selectionInProgress.current = true;
    setCompilerSelecting(true);
    setError(null);
    try {
      await approveCompilerLocation(automaticCompiler);
    } catch (caught) {
      setError('Could not confirm compiler location: ' + toMessage(caught));
    } finally {
      selectionInProgress.current = false;
      setCompilerSelecting(false);
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
      await approveCompilerLocation(chosen);
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
    let snapshot: ScarpRunSnapshot;
    try {
      const selected = liveEditor.current.documents.find(
        (item) => item.id === liveEditor.current.activeId,
      ) ?? null;
      snapshot = captureRunSnapshot(selected);
    } catch (caught) {
      setError(toMessage(caught));
      return;
    }
    // First Run uses an automatically discovered candidate. A user must
    // approve launching that candidate once per Studio session; no file picker.
    let binary = compilerPath;
    if (!binary) {
      selectionInProgress.current = true;
      setCompilerSelecting(true);
      try {
        const revision = ++compilerScanRevision.current;
        const available = detectedCompilers.length ? detectedCompilers : await detectScarp();
        if (revision === compilerScanRevision.current) setDetectedCompilers(available);
        const chosen = (automaticCompiler && available.includes(automaticCompiler))
          ? automaticCompiler : available[0];
        if (!chosen) {
          const message = 'Scarp was not found. Download the official compiler ZIP, extract it into Downloads/Scarp, and click Run again.';
          setCompilerOutput(message);
          setError(message);
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
    // A tab, source buffer or saved file can change while discovery, a native
    // trust dialog, and compiler probing are awaited. Never run stale code.
    try {
      if (saveInProgress.current) throw new Error('Finish saving before running the compiler.');
      const selected = liveEditor.current.documents.find(
        (item) => item.id === liveEditor.current.activeId,
      ) ?? null;
      validateRunSnapshot(snapshot, selected);
    } catch (caught) {
      setError(toMessage(caught));
      return;
    }
    commandInProgress.current = true;
    setCompilerBusy(true);
    setError(null);
    setCompilerOutput((mode === 'exec' ? 'Running ' : 'Verifying ') + fileName(snapshot.path) + '…');
    try {
      const result = await executeScarp(binary, snapshot.path, mode, snapshot.savedContent);
      setCompilerOutput(result);
      setNotice('Scarp ' + mode + ' finished; see output');
    } catch (caught) {
      const message = toMessage(caught);
      setCompilerOutput('Scarp ' + mode + ' could not complete:\n' + message);
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

  async function closeFile(id: string): Promise<void> {
    if (saveInProgress.current) {
      setError('Finish the current save before closing a tab.');
      return;
    }
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
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && settingsOpen) {
        event.preventDefault();
        setSettingsOpen(false);
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === ',') {
        event.preventDefault();
        setSettingsOpen((open) => !open);
      } else if (key === 's') {
        event.preventDefault();
        void saveFile(event.shiftKey);
      } else if (key === 'n') {
        event.preventDefault();
        newFile();
      } else if (key === 'o' && !event.shiftKey) {
        event.preventDefault();
        void openFile();
      } else if (key === 'w' && activeId) {
        event.preventDefault();
        void closeFile(activeId);
      } else if (key === 'f5') {
        event.preventDefault();
        void runCompiler(event.shiftKey ? 'verify' : 'exec');
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
          <button onClick={() => void saveFile()} disabled={!active || busy} title="Save (Ctrl+S)">Save</button>
          <button onClick={() => void saveFile(true)} disabled={!active || busy} title="Save As (Ctrl+Shift+S)">Save As</button>
        </nav>
        <button
          className="theme-button"
          onClick={() => changeSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
        <button
          className="settings-nav-button"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-pressed={settingsOpen}
          title="Editor and compiler settings (Ctrl+,)"
        >⚙ Settings</button>
      </header>

      <div className="studio-main">
        <aside className="sidebar" aria-label="Scarp file explorer">
          <div className="sidebar-heading">EXPLORER</div>
          {folderPath ? (
            <section className="sidebar-section">
              <div className="folder-label" title={folderPath}>▾ {fileName(folderPath)}</div>
              <div className="sidebar-note">Top-level Scarp files</div>
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
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
            </div>
          )}
          <div className="editor-panel">
            {settingsOpen ? (
              <StudioSettingsPanel
                settings={settings}
                onChange={changeSettings}
                onClose={() => setSettingsOpen(false)}
                compilerCandidate={automaticCompiler}
                trustedCompiler={compilerPath}
                compilerVersion={compilerInfo}
                compilerBusy={!isTauri() || compilerBusy || compilerSelecting || compilerScanning}
                onConfirmCompiler={() => void confirmDetectedCompiler()}
                onScanCompiler={() => void rescanCompilers()}
                onChooseCompiler={() => void selectCompiler()}
                onDownloadCompiler={() => void openCompilerDownloads()}
              />
            ) : active ? (
              <Editor
                key={active.id}
                path={active.path || active.id + '.srp'}
                language="scarp"
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                value={active.content}
                onChange={(content) => {
                  dispatch({ type: 'edit', id: active.id, content: content ?? '' });
                }}
                onMount={(editor) => {
                  editor.onDidChangeCursorPosition((event) => {
                    setCursor({ line: event.position.lineNumber, column: event.position.column });
                  });
                }}
                loading={<div className="empty-state">Loading Scarp editor…</div>}
                options={{
                  automaticLayout: true, fontSize: settings.fontSize, fontFamily: 'Consolas, monospace',
                  minimap: { enabled: settings.minimap }, scrollBeyondLastLine: false,
                  tabSize: 4, wordWrap: settings.wordWrap ? 'on' : 'off', detectIndentation: false,
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
                <button onClick={() => void rescanCompilers()}
                  disabled={!isTauri() || compilerBusy || compilerSelecting || compilerScanning}
                  title="Search PATH, standard install locations and extracted Downloads/Scarp folders">
                  {compilerScanning ? 'Scanning…' : 'Scan Compiler'}
                </button>
                <button onClick={() => void openCompilerDownloads()}
                  title="Download the SHA-256-pinned Windows compiler ZIP from official GitHub releases">
                  Download Compiler
                </button>
                <button onClick={() => void selectCompiler()} disabled={compilerBusy || compilerSelecting || compilerScanning}
                  title="Optional: choose a trusted compiler if automatic discovery missed it">
                  {compilerSelecting ? 'Checking…' : 'Choose Manually'}
                </button>
                <button onClick={() => void runCompiler('exec')}
                  disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !active || !active.path || isDirty(active)}
                  title="Run saved Scarp source (Ctrl+F5); detect the compiler on demand">Run</button>
                <button onClick={() => void runCompiler('verify')}
                  disabled={!isTauri() || compilerBusy || compilerSelecting || busy || !active || !active.path || isDirty(active)}
                  title="Verify saved Scarp source without executing it (Ctrl+Shift+F5)">Verify</button>
                <button onClick={() => void stopCompiler()} disabled={!compilerBusy}
                  title="Stop the active compiler process">Stop</button>
              </div>
            </div>
            <div className="compiler-meta">
              {compilerInfo || (automaticCompiler
                ? 'Detected (not yet trusted): ' + automaticCompiler
                : 'Compiler not detected. Download the official ZIP, extract it, then click Scan.')}
              {automaticCompiler && !compilerPath && (
                <div className="compiler-path-confirm">
                  <span>Is your Scarp compiler at <code>{automaticCompiler}</code>?</span>
                  <button onClick={() => void confirmDetectedCompiler()}
                    disabled={compilerSelecting || compilerScanning || compilerBusy}>
                    Yes, confirm this location
                  </button>
                </div>
              )}
              {detectedCompilers.length > 1 && !compilerPath && (
                <label className="compiler-choice">Detected compiler:
                  <select
                    value={automaticCompiler ?? ''}
                    onChange={(event) => setPreferredDetectedCompiler(event.target.value)}
                    aria-label="Detected compiler to use on first Run"
                  >
                    {detectedCompilers.map((candidate) => (
                      <option key={candidate} value={candidate}>{candidate}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <pre className="compiler-output" role="log" aria-live="polite">{compilerOutput}</pre>
          </section>
        </main>
      </div>
      <footer className="status-bar">
        <span>{busy ? 'Working…' : notice}</span>
        <span>{active ? 'Ln ' + cursor.line + ', Col ' + cursor.column : ''}</span>
        <button className="status-settings-button"
          onClick={() => setSettingsOpen(true)}
          title="Configure Auto Save and editor preferences">
          Auto Save: {settings.autoSave ? 'On' : 'Off'}
        </button>
        <span title={compilerPath || automaticCompiler || 'No Scarp compiler detected'}>
          {compilerPath ? 'Compiler ready' : automaticCompiler ? 'Compiler detected · approval needed' : 'Compiler not found'}
        </span>
        <span>Scarp · .srp</span>
        <span>v0.0.2-alpha.1</span>
      </footer>
    </div>
  );
}
