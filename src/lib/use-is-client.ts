import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False during server render and hydration, true afterwards. Lets components read
// browser-only state (localStorage) without causing a hydration mismatch.
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
