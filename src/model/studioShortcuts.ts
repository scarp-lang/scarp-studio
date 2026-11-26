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
export function parseShortcuts(raw: string | null): ShortcutBindings {
  if (raw === null || raw.length > MAX_SHORTCUT_STORAGE_UNITS) return DEFAULT_SHORTCUTS;
  try {
    const root = recordOf(JSON.parse(raw));
    if (!root || !hasUniqueJsonKeys(raw) || !exactKeys(root, ['version', 'bindings']) || root.version !== 1) return DEFAULT_SHORTCUTS;
    const bindings = recordOf(root.bindings);
    if (!bindings || !exactKeys(bindings, SHORTCUT_COMMANDS.map(item => item.id))) return DEFAULT_SHORTCUTS;
    const used = new Set<string>();
    const next: Partial<Record<ShortcutCommand, ShortcutBinding>> = {};
    for (const item of SHORTCUT_COMMANDS) {
      const binding = bindings[item.id];
      if (binding !== null && typeof binding !== 'string') return DEFAULT_SHORTCUTS;
      if (!availableShortcutBindings(item.id).includes(binding) || binding !== null && used.has(binding)) return DEFAULT_SHORTCUTS;
      if (binding !== null) used.add(binding);
      next[item.id] = binding;
    }
    return Object.freeze(next as Record<ShortcutCommand, ShortcutBinding>);
  } catch { return DEFAULT_SHORTCUTS; }
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
export interface ShortcutSnapshot { readonly bindings: ShortcutBindings; readonly persistence: 'available' | 'session-only' }
export function createStudioShortcutStore(storage: IntelliSenseStorage | null) {
  let bindings = DEFAULT_SHORTCUTS;
  let persistence: ShortcutSnapshot['persistence'] = storage ? 'available' : 'session-only';
  try { if (storage) bindings = parseShortcuts(storage.getItem(SHORTCUT_STORAGE_KEY)); }
  catch { persistence = 'session-only'; }
  let snapshot: ShortcutSnapshot = Object.freeze({ bindings, persistence });
  const listeners = new Set<() => void>();
  const getSnapshot = () => snapshot;
  function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  function save(next: ShortcutBindings) {
    let status: ShortcutSnapshot['persistence'] = 'session-only';
    try { if (storage) { storage.setItem(SHORTCUT_STORAGE_KEY, serializeShortcuts(next)); status = 'available'; } }
    catch { /* session-only fallback */ }
    snapshot = Object.freeze({ bindings: next, persistence: status });
    for (const listener of [...listeners]) listener();
  }
  function setBinding(id: ShortcutCommand, binding: ShortcutBinding): ShortcutChangeResult {
    const result = changeShortcut(snapshot.bindings, id, binding);
    if (result.ok) save(result.bindings);
    return result;
  }
  function reset() { save(DEFAULT_SHORTCUTS); }
  return { getSnapshot, subscribe, setBinding, reset };
}
function storageOrNull(): IntelliSenseStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export const studioShortcutStore = createStudioShortcutStore(storageOrNull());
