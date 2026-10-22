import { useRef, useState, type MouseEvent, type PointerEvent } from "react";

interface DragState {
  pointerId: number;
  startX: number;
  scrollLeft: number;
  moved: boolean;
}

export function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    ref,
    isDragging,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "mouse" || event.button !== 0) return;
        suppressClick.current = false;
        if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth)
          return;
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          scrollLeft: event.currentTarget.scrollLeft,
          moved: false,
        };
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const delta = event.clientX - current.startX;
        if (!current.moved && Math.abs(delta) < 6) return;
        if (!current.moved) {
          current.moved = true;
          suppressClick.current = true;
          setIsDragging(true);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }
        event.preventDefault();
        event.currentTarget.scrollLeft = current.scrollLeft - delta;
      },
      onPointerUp: finishDrag,
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => {
        finishDrag(event);
        suppressClick.current = false;
      },
      onPointerLeave: (event: PointerEvent<HTMLDivElement>) => {
        if (!drag.current?.moved) finishDrag(event);
      },
      onLostPointerCapture: () => {
        drag.current = null;
        setIsDragging(false);
      },
      onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
        if (suppressClick.current && event.detail > 0) {
          event.preventDefault();
          event.stopPropagation();
        }
        suppressClick.current = false;
      },
    },
  };
}
