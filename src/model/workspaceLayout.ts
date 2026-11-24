/** Local display dimensions only. Persist no source, path or program input. */
export interface WorkspaceLayout {
  explorerWidth: number;
  outputHeight: number;
}
export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = { explorerWidth: 245, outputHeight: 340 };
export const EXPLORER_MIN = 160;
export const EXPLORER_MAX = 480;
export const OUTPUT_MIN = 180;
export const OUTPUT_MAX = 680;
export const EDITOR_MIN_WIDTH = 320;
export const EDITOR_MIN_HEIGHT = 120;
export type LayoutDimension = keyof WorkspaceLayout;

export function clampLayoutSize(value: number, dimension: LayoutDimension, available = Infinity): number {
  const min = dimension === 'explorerWidth' ? EXPLORER_MIN : OUTPUT_MIN;
  const max = dimension === 'explorerWidth' ? EXPLORER_MAX : OUTPUT_MAX;
  const reserve = dimension === 'explorerWidth' ? EDITOR_MIN_WIDTH : EDITOR_MIN_HEIGHT;
  const upper = Math.max(min, Math.min(max, Number.isFinite(available) ? Math.floor(available - reserve - 8) : max));
  return Math.max(min, Math.min(upper, Math.round(Number.isFinite(value) ? value : DEFAULT_WORKSPACE_LAYOUT[dimension])));
}

export function parseWorkspaceLayout(raw: string | null): WorkspaceLayout {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_WORKSPACE_LAYOUT };
    const value = parsed as Record<string, unknown>;
    return {
      explorerWidth: clampLayoutSize(typeof value.explorerWidth === 'number' ? value.explorerWidth : NaN, 'explorerWidth'),
      outputHeight: clampLayoutSize(typeof value.outputHeight === 'number' ? value.outputHeight : NaN, 'outputHeight'),
    };
  } catch { return { ...DEFAULT_WORKSPACE_LAYOUT }; }
}

export function resizeLayoutByKey(dimension: LayoutDimension, value: number, key: string, available: number, coarse = false): number | null {
  const step = coarse ? 40 : 12;
  if (key === 'Home') return clampLayoutSize(0, dimension, available);
  if (key === 'End') return clampLayoutSize(Number.MAX_SAFE_INTEGER, dimension, available);
  if (dimension === 'explorerWidth') {
    if (key === 'ArrowLeft') return clampLayoutSize(value - step, dimension, available);
    if (key === 'ArrowRight') return clampLayoutSize(value + step, dimension, available);
  } else {
    if (key === 'ArrowDown') return clampLayoutSize(value - step, dimension, available);
    if (key === 'ArrowUp') return clampLayoutSize(value + step, dimension, available);
  }
  return null;
}

export function resizeLayoutByPointer(dimension: LayoutDimension, startSize: number, startCoordinate: number, coordinate: number, available: number): number {
  const delta = coordinate - startCoordinate;
  return clampLayoutSize(startSize + (dimension === 'explorerWidth' ? delta : -delta), dimension, available);
}
