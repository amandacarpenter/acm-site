import { useSyncExternalStore } from "react";

// The embedded review viewer owns its URL. Do not read or mutate its history.
// This hook is used ONLY by the isolated preview build.
let currentPath = "/pricing";
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function navigate(to: string) {
  currentPath = to.replace(/^#/, "") || "/pricing";
  listeners.forEach(listener => listener());
}
export function usePreviewLocation(): [string, typeof navigate] {
  return [useSyncExternalStore(subscribe, () => currentPath.split("?")[0], () => "/pricing"), navigate];
}
export function usePreviewSearch() {
  return useSyncExternalStore(subscribe, () => currentPath.split("?")[1] || "", () => "");
}
usePreviewLocation.hrefs = (href: string) => "#" + href;
