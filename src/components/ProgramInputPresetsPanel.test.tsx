import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProgramInputPresetsPanel } from './ProgramInputPresetsPanel';
import { createProgramInputPresetStore, reviewInputPresetCapture } from '../model/programInputPresets';

describe('program input preset panel', () => {
  it('starts collapsed and never reveals saved replies or invokes actions during render', () => {
    const current = { text: 'private replies', interactive: false, revision: 1 };
    const store = createProgramInputPresetStore();
    const plan = reviewInputPresetCapture(store.getSnapshot(), current, 'Private test');
    if (!plan.ok) throw Error(plan.error);
    store.capture(plan.value, current);
    const unexpected = () => { throw Error('unexpected action'); };
    const markup = renderToStaticMarkup(createElement(ProgramInputPresetsPanel, {
      current, store, busy: false, onCapture: unexpected, onApply: unexpected, onRemove: unexpected, onUndo: unexpected,
    }));
    expect(markup).toContain('Manage input presets');
    expect(markup).not.toContain('private replies');
    expect(markup).not.toContain('Private test');
  });
});
