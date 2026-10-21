import { useSyncExternalStore } from "react";

const query = "(max-width: 639px)";
const snapshot = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(query).matches;
const subscribe = (notify: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

export function useIsMobile() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
