import { describe, expect, it } from 'vitest';
import { clampLayoutSize, DEFAULT_WORKSPACE_LAYOUT, parseWorkspaceLayout, resizeLayoutByKey, resizeLayoutByPointer } from './workspaceLayout';

describe('workspace layout preferences', () => {
  it('restores independent defaults for missing and malformed storage', () => {
    for (const raw of [null, '{', 'null', '[]', '42']) expect(parseWorkspaceLayout(raw)).toEqual(DEFAULT_WORKSPACE_LAYOUT);
    expect(parseWorkspaceLayout('{"explorerWidth":"400","outputHeight":null}')).toEqual(DEFAULT_WORKSPACE_LAYOUT);
    expect(parseWorkspaceLayout(null)).not.toBe(DEFAULT_WORKSPACE_LAYOUT);
  });
  it('clamps persisted dimensions and ignores unrelated fields', () => {
    expect(parseWorkspaceLayout('{"explorerWidth":9999,"outputHeight":-100,"source":"private"}')).toEqual({ explorerWidth: 480, outputHeight: 180 });
    expect(parseWorkspaceLayout('{"explorerWidth":260.4,"outputHeight":410.7}')).toEqual({ explorerWidth: 260, outputHeight: 411 });
  });
  it('reserves editor space where feasible and handles narrow viewports', () => {
    expect(clampLayoutSize(480, 'explorerWidth', 760)).toBe(432);
    expect(clampLayoutSize(680, 'outputHeight', 520)).toBe(392);
    expect(clampLayoutSize(680, 'outputHeight', 100)).toBe(180);
    expect(clampLayoutSize(680, 'outputHeight', 380)).toBe(252);
    expect(clampLayoutSize(680, 'outputHeight', 700)).toBe(572);
    expect(clampLayoutSize(NaN, 'explorerWidth')).toBe(245);
  });
  it('uses intuitive keyboard direction and bounded Home/End', () => {
    expect(resizeLayoutByKey('explorerWidth', 245, 'ArrowRight', 1200)).toBe(257);
    expect(resizeLayoutByKey('explorerWidth', 245, 'ArrowLeft', 1200, true)).toBe(205);
    expect(resizeLayoutByKey('outputHeight', 340, 'ArrowUp', 800)).toBe(352);
    expect(resizeLayoutByKey('outputHeight', 340, 'ArrowDown', 800)).toBe(328);
    expect(resizeLayoutByKey('outputHeight', 340, 'Home', 800)).toBe(180);
    expect(resizeLayoutByKey('outputHeight', 340, 'End', 520)).toBe(392);
    expect(resizeLayoutByKey('explorerWidth', 245, 'Tab', 1200)).toBeNull();
  });
  it('uses original pointer origin without compounding repeated movement', () => {
    expect(resizeLayoutByPointer('explorerWidth', 245, 300, 350, 1200)).toBe(295);
    expect(resizeLayoutByPointer('outputHeight', 340, 600, 550, 800)).toBe(390);
    expect(resizeLayoutByPointer('explorerWidth', 245, 300, 900, 760)).toBe(432);
    expect(resizeLayoutByPointer('outputHeight', 340, 600, 900, 800)).toBe(180);
  });
});
