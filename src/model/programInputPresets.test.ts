import { describe, expect, it } from 'vitest';
import { MAX_INPUT_BYTES } from './programInput';
import { createProgramInputPresetStore, reviewInputPresetCapture, inputPresetCaptureIsCurrent,
  reviewInputPresetApply, inputPresetApplyIsCurrent, createInputPresetUndo, inputPresetUndoIsCurrent,
  reviewInputPresetRemoval, inputPresetRemovalIsCurrent, normalizeInputPresetLabel, filterInputPresets,
  inputPresetLineCount, MAX_INPUT_PRESETS, MAX_PRESET_TOTAL_BYTES, type ProgramInputSnapshot } from './programInputPresets';

const snapshot = (text: string, interactive = false, revision = 1): ProgramInputSnapshot => ({ text, interactive, revision });
const newStore = createProgramInputPresetStore;
function save(store: ReturnType<typeof newStore>, input: ProgramInputSnapshot, label = 'Example', replaceId: number | null = null) {
  const plan = reviewInputPresetCapture(store.getSnapshot(), input, label, replaceId);
  if (!plan.ok) throw Error(plan.error);
  const result = store.capture(plan.value, input);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
describe('program input preset capture', () => {
  it('retains exact Unicode, CRLF and prompt mode only after explicit capture', () => {
    const store = newStore();
    const input = snapshot('42\r\nनमस्ते 😀\r\n', true);
    const item = save(store, input, '  First practice  ');
    expect(item).toMatchObject({ id: 1, label: 'First practice', text: input.text, interactive: true });
    expect(item.bytes).toBe(new TextEncoder().encode(input.text).length);
    expect(store.getSnapshot().bytes).toBe(item.bytes);
    expect(Object.isFrozen(item)).toBe(true);
    expect(Object.isFrozen(store.getSnapshot().entries)).toBe(true);
  });
  it('supports empty input and explicit prompt mode', () => {
    const store = newStore();
    expect(save(store, snapshot('', true))).toMatchObject({ text: '', interactive: true, bytes: 0 });
  });
  it.each(['', '   ', 'a'.repeat(61), 'a\nb', 'a\u202eb', '\ud800'])('rejects invalid labels (%j)', label => {
    expect(normalizeInputPresetLabel(label)).toBeNull();
    expect(reviewInputPresetCapture(newStore().getSnapshot(), snapshot('x'), label).ok).toBe(false);
  });
  it('rejects duplicate case-insensitive labels without replacing existing entries', () => {
    const store = newStore();
    const original = save(store, snapshot('a'), 'Demo');
    expect(reviewInputPresetCapture(store.getSnapshot(), snapshot('b'), ' demo ').ok).toBe(false);
    expect(store.getSnapshot().entries).toEqual([original]);
  });
  it.each(['x'.repeat(MAX_INPUT_BYTES + 1), '\ud800', 'x'.repeat(4097), 'a\n'.repeat(257)])(
    'applies the existing input validation before storing %j', text => {
      expect(reviewInputPresetCapture(newStore().getSnapshot(), snapshot(text), 'Invalid').ok).toBe(false);
    });
  it('replaces a selected preset only with current reviewed input and allocates a fresh ID', () => {
    const store = newStore();
    const item = save(store, snapshot('a'), 'Old');
    const other = save(store, snapshot('b'), 'Other');
    const changed = save(store, snapshot('c', true, 2), 'New', item.id);
    expect(changed.id).toBeGreaterThan(other.id);
    expect(store.getSnapshot().entries).toEqual([changed, other]);
    expect(store.getSnapshot().bytes).toBe(2);
    expect(reviewInputPresetCapture(store.getSnapshot(), snapshot('x'), 'x', item.id).ok).toBe(false);
    expect(reviewInputPresetCapture(store.getSnapshot(), snapshot('c', true, 2), 'New', changed.id).ok).toBe(false);
  });
  it('does not allow a replacement to collide with another existing label', () => {
    const store = newStore();
    const item = save(store, snapshot('a'), 'First');
    save(store, snapshot('b'), 'Second');
    expect(reviewInputPresetCapture(store.getSnapshot(), snapshot('c'), 'SECOND', item.id).ok).toBe(false);
  });
  it('rejects stale, forged and ABA capture reviews', () => {
    const store = newStore();
    const input = snapshot('a');
    const review = reviewInputPresetCapture(store.getSnapshot(), input, 'First');
    if (!review.ok) throw Error(review.error);
    expect(inputPresetCaptureIsCurrent(review.value, store.getSnapshot(), input)).toBe(true);
    expect(store.capture(review.value, snapshot('a', false, 3)).ok).toBe(false);
    expect(store.capture(review.value, snapshot('a', true)).ok).toBe(false);
    expect(store.capture({ ...review.value, bytes: 0 }, input).ok).toBe(false);
    save(store, input, 'Other');
    expect(store.capture(review.value, input).ok).toBe(false);
  });
  it('enforces count capacity without evicting old entries', () => {
    const store = newStore();
    for (let i = 0; i < MAX_INPUT_PRESETS; i++) save(store, snapshot(''), 'Preset ' + i);
    expect(reviewInputPresetCapture(store.getSnapshot(), snapshot('x'), 'Overflow').ok).toBe(false);
    expect(store.getSnapshot().entries).toHaveLength(MAX_INPUT_PRESETS);
    expect(store.getSnapshot().entries[0].label).toBe('Preset 0');
  });
  it('enforces total bytes and permits a smaller reviewed replacement at capacity', () => {
    const store = newStore();
    const large = ('x'.repeat(4095) + '\n').repeat(4);
    for (let i = 0; i < MAX_PRESET_TOTAL_BYTES / MAX_INPUT_BYTES; i++) save(store, snapshot(large), 'Big ' + i);
    expect(store.getSnapshot().bytes).toBe(MAX_PRESET_TOTAL_BYTES);
    expect(reviewInputPresetCapture(store.getSnapshot(), snapshot('x'), 'Overflow').ok).toBe(false);
    const first = store.getSnapshot().entries[0];
    save(store, snapshot('x'), 'Smaller', first.id);
    expect(store.getSnapshot().bytes).toBe(MAX_PRESET_TOTAL_BYTES - MAX_INPUT_BYTES + 1);
  });
});
describe('reviewed input apply and undo', () => {
  it('applies exact replies and mode without interpreting them or changing the store', () => {
    const store = newStore();
    const item = save(store, snapshot('42\r\n😀', true));
    const current = snapshot('before', false, 3);
    const plan = reviewInputPresetApply(store.getSnapshot(), current, item.id);
    if (!plan.ok) throw Error(plan.error);
    expect(plan.value).toMatchObject({ targetText: '42\r\n😀', targetInteractive: true, snapshot: current });
    expect(inputPresetApplyIsCurrent(plan.value, store.getSnapshot(), current)).toBe(true);
    expect(store.getSnapshot().entries).toEqual([item]);
  });
  it('can review replacing an invalid draft with valid saved replies', () => {
    const store = newStore();
    const item = save(store, snapshot('valid'));
    const current = snapshot('x'.repeat(4097), false, 8);
    expect(reviewInputPresetApply(store.getSnapshot(), current, item.id).ok).toBe(true);
  });
  it('does not create a no-op apply review', () => {
    const store = newStore();
    const current = snapshot('same', true);
    const item = save(store, current);
    expect(reviewInputPresetApply(store.getSnapshot(), current, item.id).ok).toBe(false);
    expect(reviewInputPresetApply(store.getSnapshot(), current, 999).ok).toBe(false);
  });
  it('rejects modified target, changed input generation and changed preset inventory', () => {
    const store = newStore();
    const item = save(store, snapshot('stored', true));
    const current = snapshot('old', false, 3);
    const review = reviewInputPresetApply(store.getSnapshot(), current, item.id);
    if (!review.ok) throw Error(review.error);
    expect(inputPresetApplyIsCurrent({ ...review.value, targetText: 'forged' }, store.getSnapshot(), current)).toBe(false);
    expect(inputPresetApplyIsCurrent({ ...review.value, targetInteractive: false }, store.getSnapshot(), current)).toBe(false);
    expect(inputPresetApplyIsCurrent(review.value, store.getSnapshot(), snapshot('old', false, 5))).toBe(false);
    save(store, snapshot('other'), 'Other');
    expect(inputPresetApplyIsCurrent(review.value, store.getSnapshot(), current)).toBe(false);
  });
  it('supports exact one-step undo and rejects intervening typing, prompt changes or ABA', () => {
    const before = snapshot('old', false, 10);
    const after = snapshot('stored', true, 11);
    const undo = createInputPresetUndo(before, after)!;
    expect(inputPresetUndoIsCurrent(undo, after)).toBe(true);
    expect(inputPresetUndoIsCurrent(undo, snapshot('new', true, 12))).toBe(false);
    expect(inputPresetUndoIsCurrent(undo, snapshot('stored', true, 13))).toBe(false);
    expect(inputPresetUndoIsCurrent(undo, snapshot('stored', false, 11))).toBe(false);
    expect(createInputPresetUndo(before, snapshot('stored', true, 12))).toBeNull();
    expect(createInputPresetUndo(before, snapshot('old', false, 11))).toBeNull();
  });
});
describe('input preset removal and filtering', () => {
  it('removes only reviewed items and leaves current field ownership with the caller', () => {
    const store = newStore();
    const input = snapshot('private');
    const a = save(store, input, 'First');
    const b = save(store, snapshot('x'), 'Second');
    const review = reviewInputPresetRemoval(store.getSnapshot(), [a.id]);
    if (!review.ok) throw Error(review.error);
    expect(store.remove(review.value)).toBe(true);
    expect(store.getSnapshot().entries).toEqual([b]);
    expect(input.text).toBe('private');
    expect(store.remove(review.value)).toBe(false);
  });
  it('invalidates clear-all review when any preset is added or replaced', () => {
    const store = newStore();
    const a = save(store, snapshot('a'));
    const plan = reviewInputPresetRemoval(store.getSnapshot(), [a.id]);
    if (!plan.ok) throw Error(plan.error);
    save(store, snapshot('b'), 'New');
    expect(inputPresetRemovalIsCurrent(plan.value, store.getSnapshot())).toBe(false);
    expect(store.remove(plan.value)).toBe(false);
    for (const ids of [[], [0], [a.id,a.id], [999]]) expect(reviewInputPresetRemoval(store.getSnapshot(), ids).ok).toBe(false);
  });
  it('searches labels only, excluding private reply text', () => {
    const store = newStore();
    const a = save(store, snapshot('secret'), 'Practice one');
    save(store, snapshot('Practice one'), 'Other');
    expect(filterInputPresets(store.getSnapshot().entries, 'PRACTICE one')).toEqual([a]);
    expect(filterInputPresets(store.getSnapshot().entries, 'secret')).toEqual([]);
  });
  it.each([['',0], ['a',1], ['a\n',1], ['a\r\nb',2], ['\n',1], ['a\rb',1], ['a\n\n',2]])(
    'counts supplied LF-delimited lines in %j', (text, expected) => expect(inputPresetLineCount(text)).toBe(expected));
  it('publishes only reviewed state mutations', () => {
    const store = newStore();
    let calls = 0; const off = store.subscribe(() => calls++);
    const a = save(store, snapshot('x'));
    const removal = reviewInputPresetRemoval(store.getSnapshot(), [a.id]);
    if (!removal.ok) throw Error(removal.error);
    expect(store.remove(removal.value)).toBe(true);
    expect(store.remove(removal.value)).toBe(false);
    expect(calls).toBe(2);
    off(); save(store, snapshot('y'));
    expect(calls).toBe(2);
  });
});
