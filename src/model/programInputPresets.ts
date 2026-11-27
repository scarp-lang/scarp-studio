import { validateProgramInput, programInputBytes } from './programInput';
import { assertWellFormedUtf16 } from './utf8Text';

export const MAX_INPUT_PRESETS = 16;
export const MAX_PRESET_LABEL_UNITS = 60;
export const MAX_PRESET_TOTAL_BYTES = 96 * 1024;
export interface ProgramInputSnapshot {
  readonly text: string;
  readonly interactive: boolean;
  readonly revision: number;
}
export interface ProgramInputPreset {
  readonly id: number;
  readonly label: string;
  readonly text: string;
  readonly interactive: boolean;
  readonly bytes: number;
}
export interface ProgramInputPresetState {
  readonly entries: readonly ProgramInputPreset[];
  readonly revision: number;
  readonly bytes: number;
}
export interface InputPresetCaptureReview {
  readonly storeRevision: number;
  readonly snapshot: ProgramInputSnapshot;
  readonly label: string;
  readonly bytes: number;
  readonly replaceId: number | null;
}
export interface InputPresetApplyReview {
  readonly storeRevision: number;
  readonly snapshot: ProgramInputSnapshot;
  readonly presetId: number;
  readonly targetText: string;
  readonly targetInteractive: boolean;
}
export interface InputPresetRemovalReview {
  readonly storeRevision: number;
  readonly ids: readonly number[];
}
export interface InputPresetUndo {
  readonly before: ProgramInputSnapshot;
  readonly after: ProgramInputSnapshot;
}
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });
const labelControls = /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const total = (entries: readonly ProgramInputPreset[]) => entries.reduce((sum, item) => sum + item.bytes, 0);
export function normalizeInputPresetLabel(raw: string): string | null {
  const label = raw.trim();
  if (!label || label.length > MAX_PRESET_LABEL_UNITS || labelControls.test(raw)) return null;
  try { assertWellFormedUtf16(label, 'Preset label'); } catch { return null; }
  return label;
}
function validInput(snapshot: ProgramInputSnapshot): boolean {
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || typeof snapshot.interactive !== 'boolean') return false;
  try { validateProgramInput(snapshot.text); return true; } catch { return false; }
}
export function sameInputSnapshot(a: ProgramInputSnapshot, b: ProgramInputSnapshot): boolean {
  return a.revision === b.revision && a.text === b.text && a.interactive === b.interactive;
}
const freezeSnapshot = (snapshot: ProgramInputSnapshot): ProgramInputSnapshot =>
  Object.freeze({ text: snapshot.text, interactive: snapshot.interactive, revision: snapshot.revision });

export function reviewInputPresetCapture(state: ProgramInputPresetState, snapshot: ProgramInputSnapshot,
  rawLabel: string, replaceId: number | null = null): Result<InputPresetCaptureReview> {
  const label = normalizeInputPresetLabel(rawLabel);
  if (!label) return fail('Use a nonempty preset label of at most 60 characters without control codes.');
  if (!validInput(snapshot)) return fail('Current Program Input is invalid or exceeds Studio limits.');
  const replacing = replaceId === null ? undefined : state.entries.find(entry => entry.id === replaceId);
  if (replaceId !== null && !replacing) return fail('The preset to replace is no longer available.');
  if (state.entries.some(entry => entry.id !== replaceId && entry.label.toLowerCase() === label.toLowerCase())) {
    return fail('Another preset already has that label.');
  }
  if (!replacing && state.entries.length >= MAX_INPUT_PRESETS) return fail('Preset capacity reached. Remove a preset first.');
  const bytes = programInputBytes(snapshot.text);
  if (state.bytes - (replacing?.bytes ?? 0) + bytes > MAX_PRESET_TOTAL_BYTES) return fail('Session preset byte budget reached.');
  if (replacing && replacing.label === label && replacing.text === snapshot.text && replacing.interactive === snapshot.interactive) {
    return fail('The current Program Input and label already match this preset.');
  }
  return { ok: true, value: Object.freeze({ storeRevision: state.revision, snapshot: freezeSnapshot(snapshot),
    label, bytes, replaceId }) };
}
export function inputPresetCaptureIsCurrent(review: InputPresetCaptureReview, state: ProgramInputPresetState,
  current: ProgramInputSnapshot): boolean {
  if (review.storeRevision !== state.revision || !sameInputSnapshot(review.snapshot, current)) return false;
  const fresh = reviewInputPresetCapture(state, current, review.label, review.replaceId);
  return fresh.ok && fresh.value.label === review.label && fresh.value.bytes === review.bytes;
}
export function reviewInputPresetApply(state: ProgramInputPresetState, current: ProgramInputSnapshot,
  presetId: number): Result<InputPresetApplyReview> {
  const preset = state.entries.find(item => item.id === presetId);
  if (!preset) return fail('Selected input preset no longer exists.');
  // It must be possible to replace an invalid current draft with a valid
  // stored preset. The reviewed baseline still matches exact text/revision.
  if (current.text === preset.text && current.interactive === preset.interactive) return fail('Current input already matches this preset.');
  if (!validInput({ text: preset.text, interactive: preset.interactive, revision: current.revision })) return fail('Preset contains invalid input.');
  return { ok: true, value: Object.freeze({ storeRevision: state.revision, snapshot: freezeSnapshot(current),
    presetId, targetText: preset.text, targetInteractive: preset.interactive }) };
}
export function inputPresetApplyIsCurrent(review: InputPresetApplyReview, state: ProgramInputPresetState,
  current: ProgramInputSnapshot): boolean {
  if (review.storeRevision !== state.revision || !sameInputSnapshot(review.snapshot, current)) return false;
  const fresh = reviewInputPresetApply(state, current, review.presetId);
  return fresh.ok && fresh.value.targetText === review.targetText &&
    fresh.value.targetInteractive === review.targetInteractive;
}
export function createInputPresetUndo(before: ProgramInputSnapshot, after: ProgramInputSnapshot): InputPresetUndo | null {
  if (after.revision !== before.revision + 1 || before.text === after.text && before.interactive === after.interactive) return null;
  // The before value may be invalid input. Undo restores it as an editable
  // draft only; independent native Run validation still rejects invalid data.
  return Object.freeze({ before: freezeSnapshot(before), after: freezeSnapshot(after) });
}
export function inputPresetUndoIsCurrent(undo: InputPresetUndo, current: ProgramInputSnapshot): boolean {
  return sameInputSnapshot(undo.after, current) && undo.after.revision === undo.before.revision + 1;
}
export function reviewInputPresetRemoval(state: ProgramInputPresetState, ids: readonly number[]): Result<InputPresetRemovalReview> {
  if (!ids.length || ids.length > MAX_INPUT_PRESETS || new Set(ids).size !== ids.length ||
      ids.some(id => !Number.isSafeInteger(id) || id <= 0 || !state.entries.some(item => item.id === id))) {
    return fail('Choose distinct existing input presets.');
  }
  return { ok: true, value: Object.freeze({ storeRevision: state.revision,
    ids: Object.freeze(state.entries.filter(item => ids.includes(item.id)).map(item => item.id)) }) };
}
export function inputPresetRemovalIsCurrent(review: InputPresetRemovalReview, state: ProgramInputPresetState): boolean {
  return review.storeRevision === state.revision && reviewInputPresetRemoval(state, review.ids).ok;
}

/** Explicit, bounded session memory only. No localStorage, file reads,
 * network calls, compiler commands, automatic apply or execution. */
export function createProgramInputPresetStore() {
  let nextId = 1;
  let state: ProgramInputPresetState = Object.freeze({ entries: Object.freeze([]), revision: 0, bytes: 0 });
  const listeners = new Set<() => void>();
  const getSnapshot = () => state;
  function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  function publish(entries: readonly ProgramInputPreset[]) {
    state = Object.freeze({ entries: Object.freeze([...entries]), revision: state.revision + 1, bytes: total(entries) });
    for (const listener of [...listeners]) listener();
  }
  function capture(review: InputPresetCaptureReview, current: ProgramInputSnapshot): Result<ProgramInputPreset> {
    if (!inputPresetCaptureIsCurrent(review, state, current)) return fail('Program Input or preset inventory changed. Review again.');
    // Allocate a fresh identity even for a replacement; stale selected IDs
    // cannot silently address the newly captured preset.
    const item = Object.freeze({ id: nextId++, label: review.label, text: current.text,
      interactive: current.interactive, bytes: review.bytes });
    publish(review.replaceId === null ? [...state.entries, item] :
      state.entries.map(entry => entry.id === review.replaceId ? item : entry));
    return { ok: true, value: item };
  }
  function remove(review: InputPresetRemovalReview): boolean {
    if (!inputPresetRemovalIsCurrent(review, state)) return false;
    const ids = new Set(review.ids);
    publish(state.entries.filter(item => !ids.has(item.id)));
    return true;
  }
  return { getSnapshot, subscribe, capture, remove };
}
export function inputPresetLineCount(text: string): number {
  if (!text.length) return 0;
  let count = 1;
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') count++;
  return text.endsWith('\n') ? count - 1 : count;
}
export function filterInputPresets(entries: readonly ProgramInputPreset[], query: string): ProgramInputPreset[] {
  const terms = query.slice(0, MAX_PRESET_LABEL_UNITS).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry => terms.every(term => entry.label.toLowerCase().includes(term)));
}
