import { useEffect, useMemo, useRef, useState } from 'react';
import type { editor as MonacoEditor } from 'monaco-editor';
import Editor from '@monaco-editor/react';
import { ask } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  fileName, isDirty,
} from './model/documents';
import { editorReducer, initialEditorState, isUnchangedSnapshot, sameDirtyDocuments, type EditorAction } from './model/editorState';
import { pickSourceFile, writeSourceFile } from './services/files';
import { chooseSourceFolder, readFolderSource } from './services/folders';
import {
  isCurrentSearchHit, searchOpenFiles, type OpenFileSearchHit,
} from './model/openFileSearch';

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchWholeWord, setSearchWholeWord] = useState(false);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const mountedEditor = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const mountedEditorDocumentId = useRef<string | null>(null);
  const pendingSearchLocation = useRef<OpenFileSearchHit | null>(null);
  const saveInProgress = useRef(false);
  // Prevent overlapping native discard prompts on repeated close attempts.
  const exitConfirmationInProgress = useRef(false);

  const active = documents.find((document) => document.id === activeId) || null;
  const openFileMatches = useMemo(() => searchOpenFiles(
    documents, searchQuery, {
      caseSensitive: searchCaseSensitive, wholeWord: searchWholeWord,
    },
  ), [documents, searchQuery, searchCaseSensitive, searchWholeWord]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

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
      if (!pending.length && !saveInProgress.current &&
          !exitConfirmationInProgress.current) return;
      event.preventDefault();
      if (saveInProgress.current) {
        setError('A file is being saved. Finish saving before exiting.');
        return;
      }
      if (exitConfirmationInProgress.current) return;
      exitConfirmationInProgress.current = true;
      try {
        if (await ask('Discard unsaved Scarp changes and exit?', {
          title: 'Unsaved changes',
          kind: 'warning',
        })) {
          if (saveInProgress.current ||
              !sameDirtyDocuments(pending, liveEditor.current.documents)) {
            setError('Files changed while confirming exit. Review your edits and try again.');
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

  function revealSearchLocation(
    editorInstance: MonacoEditor.IStandaloneCodeEditor, match: OpenFileSearchHit,
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
          <button onClick={() => void saveFile()} disabled={!active || busy} title="Save (Ctrl+S)">Save</button>
          <button onClick={() => void saveFile(true)} disabled={!active || busy} title="Save As (Ctrl+Shift+S)">Save As</button>
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            aria-expanded={searchOpen}
            aria-controls="open-file-search"
            title="Search all currently open Scarp buffers (Ctrl+Shift+F)"
          >Find in Open Files</button>
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
                  pendingSearchLocation.current = null;
                  dispatch({ type: 'edit', id: active.id, content: content ?? '' });
                }}
                onMount={(editor) => {
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
        </main>
      </div>
      <footer className="status-bar">
        <span>{busy ? 'Working…' : notice}</span>
        <span>{active ? 'Ln ' + cursor.line + ', Col ' + cursor.column : ''}</span>
        <span>Scarp · .srp</span>
        <span>v0.0.1-alpha.2</span>
      </footer>
    </div>
  );
}
