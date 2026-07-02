import type { RuntimeState } from "../shared/types";

/**
 * Live runtime state (never persisted). First launch starts ready so the app
 * can surface the most recent real or seeded report immediately.
 */

type Listener = (state: RuntimeState) => void;

let state: RuntimeState = {
  phase: "ready",
  progress: 0,
  stage: null,
  paused: false,
  lastReviewAt: Date.now(),
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
