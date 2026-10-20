import { useLayoutEffect, useRef, useState } from "react";

export function useElementWidth(initialWidth = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initialWidth);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = (next: number) => {
      if (next > 0) setWidth(Math.round(next));
    };
    update(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}
