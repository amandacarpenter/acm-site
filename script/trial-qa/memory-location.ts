import { useSyncExternalStore } from "react";

// The embedded review viewer owns its URL. Do not read or mutate its history.
// This hook is used ONLY by the isolated preview build.
let currentPath = "/free-trial";
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function navigate(to: string) {
  currentPath = to.split("?")[0].replace(/^#/, "") || "/free-trial";
  listeners.forEach(listener => listener());
}
export function usePreviewLocation(): [string, typeof navigate] {
  return [useSyncExternalStore(subscribe, () => currentPath, () => "/free-trial"), navigate];
}
usePreviewLocation.hrefs = (href: string) => "#" + href;
