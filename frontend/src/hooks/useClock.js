import { useSyncExternalStore } from "react";

const TICK_MS = 1000;
const listeners = new Set();
let now = Date.now();
let timeoutId;

function scheduleTick() {
  timeoutId = window.setTimeout(() => {
    now = Date.now();
    for (const listener of listeners) listener();
    if (listeners.size > 0) scheduleTick();
  }, TICK_MS - (Date.now() % TICK_MS));
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    scheduleTick();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };
}

const getSnapshot = () => now;

export function useClock() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
