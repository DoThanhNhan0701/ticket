// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDragScroll } from "@/hooks/use-drag-scroll";

afterEach(cleanup);
function DragStrip({ onSelect }: Readonly<{ onSelect: () => void }>) {
  const { ref, handlers, isDragging } = useDragScroll();
  return (
    <div ref={ref} {...handlers} data-testid="strip" data-dragging={isDragging}>
      <button onClick={onSelect}>Tab</button>
    </div>
  );
}
function setup(overflow = true) {
  const onSelect = vi.fn();
  render(<DragStrip onSelect={onSelect} />);
  const strip = screen.getByTestId("strip");
  const capture = vi.fn();
  const release = vi.fn();
  Object.defineProperties(strip, {
    scrollWidth: { value: overflow ? 2000 : 600 },
    clientWidth: { value: 600 },
    setPointerCapture: { value: capture },
    hasPointerCapture: { value: () => true },
    releasePointerCapture: { value: release },
  });
  strip.scrollLeft = 100;
  return {
    strip,
    button: screen.getByRole("button"),
    onSelect,
    capture,
    release,
  };
}
function pointer(
  target: Element,
  type: string,
  clientX: number,
  pointerType = "mouse",
  button = 0,
) {
  const event = new MouseEvent(type, {
    clientX,
    button,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
  });
  fireEvent(target, event);
  return event;
}

it("drags an overflowing strip and suppresses the click after dragging across a tab", () => {
  const { strip, button, onSelect, capture, release } = setup();
  pointer(button, "pointerdown", 200);
  pointer(strip, "pointermove", 100);
  expect(strip.scrollLeft).toBe(200);
  expect(strip.dataset.dragging).toBe("true");
  expect(capture).toHaveBeenCalledWith(1);
  pointer(strip, "pointerup", 100);
  expect(strip.dataset.dragging).toBe("false");
  expect(release).toHaveBeenCalledWith(1);
  fireEvent.click(button, { detail: 1 });
  expect(onSelect).not.toHaveBeenCalled();
  pointer(button, "pointerdown", 100);
  pointer(button, "pointerup", 100);
  fireEvent.click(button, { detail: 1 });
  expect(onSelect).toHaveBeenCalledOnce();
});

it("allows clicks when the mouse only moves a few pixels", () => {
  const { strip, button, onSelect, capture } = setup();
  pointer(button, "pointerdown", 200);
  pointer(strip, "pointermove", 197);
  pointer(button, "pointerup", 197);
  fireEvent.click(button, { detail: 1 });
  expect(strip.scrollLeft).toBe(100);
  expect(capture).not.toHaveBeenCalled();
  expect(onSelect).toHaveBeenCalledOnce();
});

it.each(["touch", "pen"])("leaves native %s scrolling alone", (type) => {
  const { strip, button, capture } = setup();
  pointer(button, "pointerdown", 200, type);
  const event = pointer(strip, "pointermove", 100, type);
  expect(event.defaultPrevented).toBe(false);
  expect(strip.scrollLeft).toBe(100);
  expect(capture).not.toHaveBeenCalled();
});

it("ignores secondary mouse buttons and strips without overflow", () => {
  const { strip, button, capture } = setup(false);
  pointer(button, "pointerdown", 200);
  pointer(strip, "pointermove", 100);
  pointer(button, "pointerdown", 200, "mouse", 2);
  pointer(strip, "pointermove", 100, "mouse", 2);
  expect(strip.scrollLeft).toBe(100);
  expect(capture).not.toHaveBeenCalled();
});

it("ends a cancelled drag and keeps keyboard activation available", () => {
  const { strip, button, onSelect } = setup();
  pointer(button, "pointerdown", 200);
  pointer(strip, "pointermove", 100);
  pointer(strip, "pointercancel", 100);
  expect(strip.dataset.dragging).toBe("false");
  pointer(strip, "pointermove", 50);
  expect(strip.scrollLeft).toBe(200);
  pointer(button, "pointerdown", 200);
  pointer(strip, "pointermove", 100);
  pointer(strip, "pointerup", 100);
  fireEvent.click(button, { detail: 0 });
  expect(onSelect).toHaveBeenCalledOnce();
});
