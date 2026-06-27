import type { RuntimeState } from "../shared/types";

/**
 * Live runtime state (never persisted). The mock build starts with a fresh,
 * unreviewed dream waiting so the first launch lands on a populated report.
 */

type Listener = (state: RuntimeState) => void;

let state: RuntimeState = {
  phase: "ready",
  progress: 0,
  lastDreamAt: Date.now(),
  hasUnreviewed: true,
};

const listeners = new Set<Listener>();

export function getState(): RuntimeState {
  return state;
}

export function patchState(patch: Partial<RuntimeState>): RuntimeState {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
  return state;
}

export function onStateChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
