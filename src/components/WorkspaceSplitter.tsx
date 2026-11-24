import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { clampLayoutSize, resizeLayoutByKey, resizeLayoutByPointer, type LayoutDimension } from '../model/workspaceLayout';

interface Props {
  dimension: LayoutDimension;
  value: number;
  available: number;
  controls: string;
  onChange: (value: number) => void;
  onReset: () => void;
}

/** Pointer capture keeps dragging reliable outside the narrow hit target.
 * A cancelled/lost pointer restores normal cursor behavior; no global
 * listeners or persistence of pointer state. */
export function WorkspaceSplitter({ dimension, value, available, controls, onChange, onReset }: Props) {
  const drag = useRef<{ id: number; coordinate: number; size: number } | null>(null);
  const vertical = dimension === 'explorerWidth';
  const coordinate = (event: PointerEvent<HTMLDivElement>) => vertical ? event.clientX : event.clientY;
  const effective = clampLayoutSize(value, dimension, available);
  const min = clampLayoutSize(0, dimension, available);
  const max = clampLayoutSize(Number.MAX_SAFE_INTEGER, dimension, available);

  function finish(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.removeAttribute('data-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const next = resizeLayoutByKey(dimension, effective, event.key, available, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    onChange(next);
  }

  return <div
    className={'workspace-splitter splitter-' + (vertical ? 'vertical' : 'horizontal')}
    role="separator" tabIndex={0} aria-orientation={vertical ? 'vertical' : 'horizontal'}
    aria-label={vertical ? 'Resize Explorer' : 'Resize compiler output'}
    aria-controls={controls}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={effective}
    aria-valuetext={effective + ' pixels'}
    title="Drag or use arrow keys; Shift for larger steps; Home/End for limits; double-click to reset"
    onKeyDown={keyDown}
    onDoubleClick={onReset}
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0 || drag.current) return;
      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, coordinate: coordinate(event), size: effective };
      event.currentTarget.setAttribute('data-dragging', 'true');
    }}
    onPointerMove={event => {
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      onChange(resizeLayoutByPointer(dimension, current.size, current.coordinate, coordinate(event), available));
    }}
    onPointerUp={finish}
    onPointerCancel={finish}
    onLostPointerCapture={finish}
  />;
}
