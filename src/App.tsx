import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditorApi } from 'monaco-editor';
import { ask, open } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  fileName, isDirty, sameFilePath,
} from './model/documents';
import { editorReducer, initialEditorState, isUnchangedSnapshot, sameDirtyDocuments, type EditorAction } from './model/editorState';
import { pickSourceFile, writeSourceFile } from './services/files';
import { chooseSourceFolder, readFolderSource } from './services/folders';
import { runnableSource } from './model/compilerReadiness';
import { exitBlockReason } from './model/exitGuards';
import {
  parseScarpDiagnostic, diagnosticBelongsToSource, scalarColumnToUtf16,
} from './model/diagnostics';
import { executeScarp, probeScarp, stopScarp, type ScarpMode } from './services/compiler';

type Theme = 'dark' | 'light';
type FolderEntry = { name: string; path: string };

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
    const next = editorReducer(liveEditor.current, action);
    liveEditor.current = next;
    setEditorState(next);
  }
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Scarp Studio • editor foundation');
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const saveInProgress = useRef(false);
  const commandInProgress = useRef(false);
  const selectionInProgress = useRef(false);
  const exitConfirmationInProgress = useRef(false);
  const [compilerSelecting, setCompilerSelecting] = useState(false);
  const [compilerPath, setCompilerPath] = useState<string | null>(() => {
    try { return localStorage.getItem('studio.compilerPath'); }
    catch { return null; }
  });
  const [compilerInfo, setCompilerInfo] = useState<string | null>(null);
  const [compilerOutput, setCompilerOutput] = useState(
    'Select a trusted official Scarp executable to enable Run and Verify.\n' +
    'Source files are never executed automatically.',
  );
  const [compilerBusy, setCompilerBusy] = useState(false);
  const [compilerDiagnosticStderr, setCompilerDiagnosticStderr] = useState<string | null>(null);
  const [compilerOutputSource, setCompilerOutputSource] = useState<{
    path: string; content: string;
  } | null>(null);
  const editorRef = useRef<MonacoEditorApi.IStandaloneCodeEditor | null>(null);

  const active = documents.find((document) => document.id === activeId) || null;
  const diagnostic = parseScarpDiagnostic(compilerDiagnosticStderr);
  const canNavigateDiagnostic = Boolean(
    diagnostic?.path && diagnostic.line && diagnostic.column &&
    active?.path && compilerOutputSource &&
    sameFilePath(active.path, compilerOutputSource.path) &&
    active.content === compilerOutputSource.content &&
    diagnosticBelongsToSource(diagnostic.path, active.path) &&
    diagnostic.line <= active.content.split(/\r?\n/).length,
  );

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
        liveEditor.current.documents
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
      try { localStorage.setItem('studio.compilerPath', chosen); } catch { /* optional persistence */ }
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
      const result = await executeScarp(compilerPath, source, mode, expectedContent);
      setCompilerOutput(result.output);
      setCompilerDiagnosticStderr(result.diagnosticStderr);
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

  function revealDiagnostic(path: string, line: number, scalarColumn: number): void {
    const current = liveEditor.current.documents.find(
      (item) => item.id === liveEditor.current.activeId,
    );
    if (!current?.path || !compilerOutputSource ||
        !sameFilePath(current.path, compilerOutputSource.path) ||
        current.content !== compilerOutputSource.content ||
        !diagnosticBelongsToSource(path, current.path)) return;
    const sourceLines = current.content.split(/\r?\n/);
    if (line < 1 || line > sourceLines.length) return;
    const position = {
      lineNumber: line,
      column: scalarColumnToUtf16(sourceLines[line - 1], scalarColumn),
    };
    editorRef.current?.revealPositionInCenter(position);
    editorRef.current?.setPosition(position);
    editorRef.current?.focus();
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
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
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
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
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
            {active ? (
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
                  editorRef.current = editor;
                  editor.onDidChangeCursorPosition((event) => {
                    setCursor({ line: event.position.lineNumber, column: event.position.column });
                  });
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
            {diagnostic && (
              <div className="compiler-diagnostic" role="status">
                <strong>{diagnostic.code || 'Scarp error'}</strong>
                <span>{diagnostic.message}</span>
                {canNavigateDiagnostic && diagnostic.path && diagnostic.line && diagnostic.column && (
                  <button type="button"
                    onClick={() => revealDiagnostic(diagnostic.path!, diagnostic.line!, diagnostic.column!)}
                    title="Focus the reported error location in the open Scarp file">
                    Go to line {diagnostic.line}, column {diagnostic.column}
                  </button>
                )}
                {diagnostic.help && <span className="compiler-diagnostic-help">{diagnostic.help}</span>}
              </div>
            )}
            <pre className="compiler-output" role="log" aria-live="polite">{compilerOutput}</pre>
          </section>
        </main>
      </div>
      <footer className="status-bar">
        <span>{busy ? 'Working…' : notice}</span>
        <span>{active ? 'Ln ' + cursor.line + ', Col ' + cursor.column : ''}</span>
        <span>Scarp · .srp</span>
        <span>v0.0.2-alpha.1</span>
      </footer>
    </div>
  );
}
