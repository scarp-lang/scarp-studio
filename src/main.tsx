import React from 'react';
import ReactDOM from 'react-dom/client';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { loader } from '@monaco-editor/react';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import App from './App';
import { registerScarpLanguage } from './language/scarp';
import './styles.css';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
registerScarpLanguage(monaco);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
