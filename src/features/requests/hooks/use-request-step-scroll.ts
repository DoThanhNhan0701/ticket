import { useEffect, useRef } from "react";

export function useRequestStepScroll(
  step: number,
  enabled: boolean,
  layoutReady = true,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const previousStep = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      previousStep.current = null;
      return;
    }
    if (!layoutReady) return;
    const previous = previousStep.current;
    if (previous === null || step <= previous) {
      previousStep.current = step;
      return;
    }

    // Let the entrance animation and select popup finish before scrolling.
    const timeout = window.setTimeout(() => {
      previousStep.current = step;
      const container = formRef.current?.closest("main");
      if (!container) return;
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      container?.scrollTo?.({
        behavior: reducedMotion ? "instant" : "smooth",
        top: container.scrollHeight,
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [step, enabled, layoutReady]);

  return formRef;
}
