import { profileError, type ProfileResult } from './intelliSenseProfileTransfer';
import type { IntelliSenseStorage } from './intelliSensePreferences';
import { hasUniqueJsonKeys, exactKeys, recordOf } from './intelliSenseProfileTransfer';

export const SHORTCUT_STORAGE_KEY = 'studio.shortcuts.v1';
export const MAX_SHORTCUT_STORAGE_UNITS = 8192;
export const MAX_SHORTCUT_QUERY_UNITS = 120;
export const SHORTCUT_COMMANDS = [
  { id: 'new', label: 'New Scarp file', group: 'Files', default: 'Ctrl+N' },
  { id: 'open', label: 'Open source', group: 'Files', default: 'Ctrl+O' },
  { id: 'save', label: 'Save current file', group: 'Files', default: 'Ctrl+S' },
  { id: 'save-as', label: 'Save As', group: 'Files', default: 'Ctrl+Shift+S' },
  { id: 'save-all', label: 'Save all', group: 'Files', default: 'Ctrl+Alt+S' },
  { id: 'close', label: 'Close tab', group: 'Files', default: 'Ctrl+W' },
  { id: 'reopen-closed', label: 'Reopen last closed source', group: 'Files', default: 'Ctrl+Shift+T' },
  { id: 'quick-open', label: 'Quick Open', group: 'Navigation', default: 'Ctrl+P' },
  { id: 'commands', label: 'Command palette', group: 'Navigation', default: 'Ctrl+Shift+P' },
  { id: 'go-to-line', label: 'Go to Line', group: 'Navigation', default: 'Ctrl+G' },
  { id: 'go-to-symbol', label: 'Go to Declaration', group: 'Navigation', default: 'Ctrl+Shift+O' },
  { id: 'next-tab', label: 'Next tab', group: 'Navigation', default: 'Ctrl+Tab' },
  { id: 'previous-tab', label: 'Previous tab', group: 'Navigation', default: 'Ctrl+Shift+Tab' },
  { id: 'find-open-files', label: 'Find in open files', group: 'Navigation', default: 'Ctrl+Shift+F' },
  { id: 'next-diagnostic', label: 'Reveal compiler diagnostic', group: 'Compiler', default: 'F8' },
  { id: 'run-scarp', label: 'Run Scarp', group: 'Compiler', default: 'F5' },
  { id: 'verify-scarp', label: 'Verify Scarp', group: 'Compiler', default: 'Ctrl+F5' },
  { id: 'stop-scarp', label: 'Stop Scarp', group: 'Compiler', default: 'Shift+F5', fixed: true },
  { id: 'show-problems', label: 'Show Problems', group: 'Workspace', default: 'Ctrl+Shift+M' },
  { id: 'toggle-output', label: 'Toggle output', group: 'Workspace', default: 'Ctrl+J' },
  { id: 'toggle-focus', label: 'Toggle focus mode', group: 'Workspace', default: 'Ctrl+Alt+Z' },
  { id: 'explorer', label: 'Toggle Explorer', group: 'Workspace', default: 'Ctrl+B' },
  { id: 'settings', label: 'Open Settings', group: 'Workspace', default: 'Ctrl+,', fixed: true },
] as const;
export type ShortcutCommand = (typeof SHORTCUT_COMMANDS)[number]['id'];
export type ShortcutBinding = string | null;
export type ShortcutBindings = Readonly<Record<ShortcutCommand, ShortcutBinding>>;
const commandMap = new Map(SHORTCUT_COMMANDS.map(item => [item.id, item]));
export const DEFAULT_SHORTCUTS: ShortcutBindings = Object.freeze(Object.fromEntries(
  SHORTCUT_COMMANDS.map(item => [item.id, item.default])) as Record<ShortcutCommand, string>);

/** Deliberately avoid arbitrary unmodified keys and standard editor shortcuts.
 * Alternatives use a dedicated modifier family. OS shortcuts may still take
 * precedence; no claim is made that every platform delivers every chord. */
const alternatives = Object.freeze(Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ', key => 'Ctrl+Alt+Shift+' + key));
export function isFixedShortcut(id: ShortcutCommand): boolean {
  const entry = commandMap.get(id);
  return !!entry && 'fixed' in entry && entry.fixed === true;
}
export function availableShortcutBindings(id: ShortcutCommand): readonly ShortcutBinding[] {
  return isFixedShortcut(id) ? [DEFAULT_SHORTCUTS[id]] : [DEFAULT_SHORTCUTS[id], ...alternatives, null];
}
export function shortcutLabel(binding: ShortcutBinding): string { return binding ?? 'Unassigned'; }
export function shortcutConflict(bindings: ShortcutBindings, id: ShortcutCommand, binding: ShortcutBinding): ShortcutCommand | null {
  if (!binding) return null;
  return SHORTCUT_COMMANDS.find(entry => entry.id !== id && bindings[entry.id] === binding)?.id ?? null;
}
export type ShortcutChangeResult = { ok: true; bindings: ShortcutBindings } | { ok: false; error: string };
export function changeShortcut(bindings: ShortcutBindings, id: ShortcutCommand, binding: ShortcutBinding): ShortcutChangeResult {
  if (!commandMap.has(id) || !availableShortcutBindings(id).includes(binding)) return { ok: false, error: 'Unsupported or fixed shortcut.' };
  const conflict = shortcutConflict(bindings, id, binding);
  if (conflict) return { ok: false, error: 'Already assigned to ' + commandMap.get(conflict)!.label + '.' };
  return { ok: true, bindings: Object.freeze({ ...bindings, [id]: binding }) };
}

export function serializeShortcuts(bindings: ShortcutBindings): string {
  return JSON.stringify({ version: 1, bindings: Object.fromEntries(SHORTCUT_COMMANDS.map(item => [item.id, bindings[item.id]])) });
}
/** Unlike startup fallback, a transfer must report invalid data explicitly. */
export function validateShortcutBindings(value: unknown): ProfileResult<ShortcutBindings> {
  const bindings = recordOf(value);
  if (!bindings || !exactKeys(bindings, SHORTCUT_COMMANDS.map(item => item.id))) return profileError('Expected every Studio command exactly once.');
  const used = new Map<string, ShortcutCommand>();
  const next: Partial<Record<ShortcutCommand, ShortcutBinding>> = {};
  for (const item of SHORTCUT_COMMANDS) {
    const binding = bindings[item.id];
    if (binding !== null && typeof binding !== 'string') return profileError('Invalid binding for ' + item.label + '.');
    if (!availableShortcutBindings(item.id).includes(binding)) return profileError('Unsupported or fixed binding for ' + item.label + '.');
    if (binding !== null) {
      const previous = used.get(binding);
      if (previous) return profileError(binding + ' conflicts with ' + commandMap.get(previous)!.label + ' and ' + item.label + '.');
      used.set(binding, item.id);
    }
    next[item.id] = binding;
  }
  return { ok: true, value: Object.freeze(next as Record<ShortcutCommand, ShortcutBinding>) };
}
export function parseShortcuts(raw: string | null): ShortcutBindings {
  if (raw === null || raw.length > MAX_SHORTCUT_STORAGE_UNITS) return DEFAULT_SHORTCUTS;
  try {
    const root = recordOf(JSON.parse(raw));
    if (!root || !hasUniqueJsonKeys(raw) || !exactKeys(root, ['version', 'bindings']) || root.version !== 1) return DEFAULT_SHORTCUTS;
    const result = validateShortcutBindings(root.bindings);
    return result.ok ? result.value : DEFAULT_SHORTCUTS;
  } catch { return DEFAULT_SHORTCUTS; }
}
export const SHORTCUT_TRANSFER_FORMAT = 'scarp-studio.shortcuts';
export const SHORTCUT_GROUPS = ['Files', 'Navigation', 'Compiler', 'Workspace'] as const;
export type ShortcutGroup = typeof SHORTCUT_GROUPS[number];
export interface ShortcutDiff {
  readonly id: ShortcutCommand; readonly label: string; readonly group: ShortcutGroup;
  readonly before: ShortcutBinding; readonly after: ShortcutBinding;
}
export interface ShortcutTransferReview {
  readonly revision: number; readonly baseline: string; readonly target: ShortcutBindings;
  readonly changes: readonly ShortcutDiff[]; readonly groups: readonly ShortcutGroup[];
}
export function exportShortcutBindings(bindings: ShortcutBindings): string {
  return JSON.stringify({ format: SHORTCUT_TRANSFER_FORMAT, version: 1,
    bindings: Object.fromEntries(SHORTCUT_COMMANDS.map(item => [item.id, bindings[item.id]])) }, null, 2);
}
export function parseShortcutTransfer(raw: string): ProfileResult<ShortcutBindings> {
  if (!raw.trim() || raw.length > MAX_SHORTCUT_STORAGE_UNITS) return profileError('Shortcut backup is empty or too large.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return profileError('Shortcut backup is not valid JSON.'); }
  if (!hasUniqueJsonKeys(raw)) return profileError('Duplicate JSON keys are not supported.');
  const root = recordOf(value);
  if (!root || !exactKeys(root, ['format', 'version', 'bindings']) ||
      root.format !== SHORTCUT_TRANSFER_FORMAT || root.version !== 1) return profileError('Unsupported shortcut backup.');
  return validateShortcutBindings(root.bindings);
}
export function reviewShortcutTransfer(current: ShortcutBindings, incoming: ShortcutBindings,
  groups: readonly ShortcutGroup[], revision: number): ProfileResult<ShortcutTransferReview> {
  if (!groups.length || groups.some(group => !SHORTCUT_GROUPS.includes(group))) return profileError('Select at least one supported command group.');
  if (!Number.isSafeInteger(revision) || revision < 0) return profileError('Invalid shortcut revision.');
  const valid = validateShortcutBindings(incoming);
  if (!valid.ok) return valid;
  const selected = SHORTCUT_GROUPS.filter(group => groups.includes(group));
  const target = validateShortcutBindings(Object.fromEntries(SHORTCUT_COMMANDS.map(item => [
    item.id, selected.includes(item.group) ? valid.value[item.id] : current[item.id],
  ])));
  if (!target.ok) return target;
  const changes = SHORTCUT_COMMANDS.filter(item => target.value[item.id] !== current[item.id]).map(item =>
    Object.freeze({ id: item.id, label: item.label, group: item.group, before: current[item.id], after: target.value[item.id] }));
  return { ok: true, value: Object.freeze({ revision, baseline: serializeShortcuts(current),
    target: target.value, changes: Object.freeze(changes), groups: Object.freeze(selected) }) };
}
export interface ShortcutEvent {
  key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean;
  isComposing?: boolean; defaultPrevented?: boolean; getModifierState?: (key: string) => boolean;
}
export function normalizeShortcutEvent(event: ShortcutEvent): string | null {
  if (event.isComposing || event.defaultPrevented || event.getModifierState?.('AltGraph') ||
      event.ctrlKey && event.metaKey) return null;
  const key = event.key;
  if (key === 'Tab' && !event.ctrlKey) return null;
  const base = /^[A-Za-z]$/.test(key) ? key.toUpperCase() : key === ',' || key === 'Tab' || /^F(?:5|8)$/.test(key) ? key : null;
  if (!base) return null;
  return [event.ctrlKey || event.metaKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', base]
    .filter(Boolean).join('+');
}
export function matchStudioShortcut(event: ShortcutEvent, bindings: ShortcutBindings): ShortcutCommand | null {
  const chord = normalizeShortcutEvent(event);
  return chord ? SHORTCUT_COMMANDS.find(item => bindings[item.id] === chord)?.id ?? null : null;
}
export function studioCommandDetail(id: string, detail: string | undefined, bindings: ShortcutBindings): string | undefined {
  if (!commandMap.has(id as ShortcutCommand)) return detail;
  const binding = bindings[id as ShortcutCommand];
  const suffix = detail?.includes(' · ') ? detail.slice(detail.indexOf(' · ')) : '';
  return shortcutLabel(binding) + suffix;
}
export function searchStudioShortcuts(query: string, modifiedOnly: boolean, bindings: ShortcutBindings) {
  const terms = query.slice(0, MAX_SHORTCUT_QUERY_UNITS).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return SHORTCUT_COMMANDS.filter(item => {
    if (modifiedOnly && bindings[item.id] === DEFAULT_SHORTCUTS[item.id]) return false;
    const text = [item.label, item.group, item.id, item.default, shortcutLabel(bindings[item.id])].join(' ').toLowerCase();
    return terms.every(term => text.includes(term));
  });
}
export interface ShortcutSnapshot { readonly bindings: ShortcutBindings; readonly persistence: 'available' | 'session-only'; readonly revision: number }
export function createStudioShortcutStore(storage: IntelliSenseStorage | null) {
  let bindings = DEFAULT_SHORTCUTS;
  let persistence: ShortcutSnapshot['persistence'] = storage ? 'available' : 'session-only';
  try { if (storage) bindings = parseShortcuts(storage.getItem(SHORTCUT_STORAGE_KEY)); }
  catch { persistence = 'session-only'; }
  let snapshot: ShortcutSnapshot = Object.freeze({ bindings, persistence, revision: 0 });
  const listeners = new Set<() => void>();
  const getSnapshot = () => snapshot;
  function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  function save(next: ShortcutBindings) {
    let status: ShortcutSnapshot['persistence'] = 'session-only';
    try { if (storage) { storage.setItem(SHORTCUT_STORAGE_KEY, serializeShortcuts(next)); status = 'available'; } }
    catch { /* session-only fallback */ }
    snapshot = Object.freeze({ bindings: next, persistence: status, revision: snapshot.revision + 1 });
    for (const listener of [...listeners]) listener();
  }
  function setBinding(id: ShortcutCommand, binding: ShortcutBinding): ShortcutChangeResult {
    const result = changeShortcut(snapshot.bindings, id, binding);
    if (result.ok) save(result.bindings);
    return result;
  }
  function applyTransfer(review: ShortcutTransferReview): ProfileResult<true> {
    if (review.revision !== snapshot.revision || review.baseline !== serializeShortcuts(snapshot.bindings)) {
      return profileError('Shortcuts changed since the review. Review again.');
    }
    const checked = reviewShortcutTransfer(snapshot.bindings, review.target, review.groups, snapshot.revision);
    if (!checked.ok) return checked;
    if (serializeShortcuts(checked.value.target) !== serializeShortcuts(review.target)) return profileError('Review changes an unselected command group.');
    if (!checked.value.changes.length) return profileError('No shortcut changes to apply.');
    save(checked.value.target);
    return { ok: true, value: true };
  }
  function reset() { save(DEFAULT_SHORTCUTS); }
  return { getSnapshot, subscribe, setBinding, reset, applyTransfer };
}
function storageOrNull(): IntelliSenseStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export const studioShortcutStore = createStudioShortcutStore(storageOrNull());
