// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRequestStepScroll } from "@/features/requests/hooks/use-request-step-scroll";

const scroll = vi.fn();
function Harness({
  step,
  enabled = true,
  layoutReady = true,
}: {
  step: number;
  enabled?: boolean;
  layoutReady?: boolean;
}) {
  const ref = useRequestStepScroll(step, enabled, layoutReady);
  return (
    <main>
      <form ref={ref}>
        {[1, 2, 3, 4]
          .filter((value) => value <= step)
          .map((value) => (
            <section key={value} data-request-step={value} />
          ))}
      </form>
    </main>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  scroll.mockReset();
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1800);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scroll,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
});

it("scrolls the content container to its bottom once, preserving the position on edits and backward changes", () => {
  const view = render(<Harness step={1} />);
  act(() => vi.runAllTimers());
  expect(scroll).not.toHaveBeenCalled();
  view.rerender(<Harness step={2} />);
  act(() => vi.runAllTimers());
  expect(scroll).toHaveBeenCalledWith({
    behavior: "smooth",
    top: 1800,
  });
  expect(scroll.mock.instances[0]).toBe(view.container.querySelector("main"));
  view.rerender(<Harness step={2} />);
  view.rerender(<Harness step={1} />);
  act(() => vi.runAllTimers());
  expect(scroll).toHaveBeenCalledTimes(1);
});

it("cancels obsolete scrolls and scrolls only for the latest revealed step", () => {
  const view = render(<Harness step={1} />);
  view.rerender(<Harness step={2} />);
  view.rerender(<Harness step={3} />);
  act(() => vi.runAllTimers());
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(scroll.mock.instances[0]).toBe(view.container.querySelector("main"));
  view.rerender(<Harness step={4} />);
  view.unmount();
  act(() => vi.runAllTimers());
  expect(scroll).toHaveBeenCalledTimes(1);
});

it("does not jump when loading a draft or clone, and respects reduced motion afterwards", () => {
  const view = render(<Harness step={1} enabled={false} />);
  view.rerender(<Harness step={3} />);
  act(() => vi.runAllTimers());
  expect(scroll).not.toHaveBeenCalled();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  view.rerender(<Harness step={4} />);
  act(() => vi.runAllTimers());
  expect(scroll).toHaveBeenCalledWith({
    behavior: "instant",
    top: 1800,
  });
});

it("waits for the template layout before scrolling to the final bottom", () => {
  const view = render(<Harness step={1} />);
  view.rerender(<Harness step={3} layoutReady={false} />);
  act(() => vi.runAllTimers());
  expect(scroll).not.toHaveBeenCalled();
  view.rerender(<Harness step={3} />);
  act(() => vi.runAllTimers());
  expect(scroll).toHaveBeenCalledExactlyOnceWith({
    behavior: "smooth",
    top: 1800,
  });
});

it("resumes a pending scroll if the layout starts loading before the animation ends", () => {
  const view = render(<Harness step={1} />);
  view.rerender(<Harness step={2} />);
  view.rerender(<Harness step={2} layoutReady={false} />);
  act(() => vi.runAllTimers());
  expect(scroll).not.toHaveBeenCalled();
  view.rerender(<Harness step={2} />);
  act(() => vi.runAllTimers());
  expect(scroll).toHaveBeenCalledExactlyOnceWith({
    behavior: "smooth",
    top: 1800,
  });
});
