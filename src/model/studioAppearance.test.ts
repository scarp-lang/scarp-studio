import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE as defaults, parseAppearance, parseAppearanceRecord, resolveAppearance,
  readSystemAppearance, subscribeSystemAppearance, reducedMotionEditorOptions } from './studioAppearance';
describe('appearance preferences and compatibility', () => {
  it('migrates explicit legacy themes and rejects invalid values independently', () => {
    expect(parseAppearance(null, 'light')).toEqual({ ...defaults, theme: 'light' });
    expect(parseAppearance('{"version":1,"theme":"system","contrast":"high","motion":"reduced"}', 'dark')).toEqual({ theme: 'system', contrast: 'high', motion: 'reduced' });
    expect(parseAppearance('{"version":2,"theme":"system"}', 'light')).toEqual({ ...defaults, theme: 'light' });
    expect(parseAppearanceRecord({ theme: 'invalid', contrast: 'high', motion: false })).toEqual({ ...defaults, contrast: 'high' });
    expect(parseAppearanceRecord(Object.create({ theme: 'light' }))).toEqual(defaults);
  });
  it('resolves independent system modes and Monaco high contrast themes', () => {
    const os = { dark: false, highContrast: true, reducedMotion: true };
    expect(resolveAppearance({ theme: 'system', contrast: 'system', motion: 'system' }, os)).toEqual({
      theme: 'light', highContrast: true, reducedMotion: true, monacoTheme: 'hc-light',
    });
    expect(resolveAppearance({ theme: 'dark', contrast: 'high', motion: 'normal' }, os).monacoTheme).toBe('hc-black');
    expect(resolveAppearance(defaults, os)).toEqual({ theme: 'dark', highContrast: false, reducedMotion: true, monacoTheme: 'vs-dark' });
    expect(reducedMotionEditorOptions(resolveAppearance(defaults, os))).toEqual({ smoothScrolling: false, cursorSmoothCaretAnimation: 'off', cursorBlinking: 'solid' });
    expect(reducedMotionEditorOptions(resolveAppearance({ ...defaults, motion: 'normal' }, os))).toEqual({});
  });
  it('subscribes to all supported media changes and removes listeners', () => {
    const lists = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
    const match = (query: string) => {
      if (!lists.has(query)) lists.set(query, { matches: false, listeners: new Set() });
      const entry = lists.get(query)!;
      return { get matches() { return entry.matches; }, addEventListener: (_: string, listener: () => void) => entry.listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => entry.listeners.delete(listener) } as unknown as MediaQueryList;
    };
    const values: ReturnType<typeof readSystemAppearance>[] = [];
    const off = subscribeSystemAppearance(value => values.push(value), match);
    expect(lists.size).toBe(4);
    const forced = lists.get('(forced-colors: active)')!;
    forced.matches = true; for (const callback of forced.listeners) callback();
    expect(values.at(-1)?.highContrast).toBe(true);
    off(); expect([...lists.values()].every(item => item.listeners.size === 0)).toBe(true);
    expect(readSystemAppearance(null)).toEqual({ dark: true, highContrast: false, reducedMotion: false });
  });
});
