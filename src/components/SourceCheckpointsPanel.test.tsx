import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SourceCheckpointsPanel } from './SourceCheckpointsPanel';
import { createSourceCheckpointStore, checkpointCaptureReview } from '../model/sourceCheckpoints';
import { initialEditorState } from '../model/editorState';

const unexpected = () => { throw Error('unexpected action during render'); };
describe('source checkpoints presentation', () => {
  it('starts collapsed and never exposes source text or captures during render', () => {
    const editor = { ...initialEditorState, documents: [{ ...initialEditorState.documents[0], content: 'private source' }] };
    const store = createSourceCheckpointStore();
    const markup = renderToStaticMarkup(createElement(SourceCheckpointsPanel, {
      editor, store, busy: false, undoAvailable: false, onCapture: unexpected,
      onRestore: unexpected, onRemove: unexpected, onUndo: unexpected,
    }));
    expect(markup).toContain('Session source checkpoints');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('private source');
    expect(store.getSnapshot().entries).toEqual([]);
  });
  it('shows captured labels and limits without exposing captured source by default', () => {
    const editor = { ...initialEditorState, documents: [{ ...initialEditorState.documents[0], content: 'private source' }] };
    const store = createSourceCheckpointStore();
    const review = checkpointCaptureReview(store.getSnapshot(), editor, 'Before edit');
    if (!review.ok) throw Error(review.error);
    store.capture(review.value, editor, 10);
    const markup = renderToStaticMarkup(createElement(SourceCheckpointsPanel, {
      editor, store, busy: false, undoAvailable: false, onCapture: unexpected, onRestore: unexpected,
      onRemove: unexpected, onUndo: unexpected, initiallyExpanded: true,
    }));
    expect(markup).toContain('Before edit');
    expect(markup).toContain('session-only');
    expect(markup).not.toContain('private source');
  });
});
