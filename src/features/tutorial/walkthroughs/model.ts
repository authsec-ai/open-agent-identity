import { useSyncExternalStore } from "react";
import type { DemoDb } from "../demo/db";

export interface WalkTask {
  /** What the person should do, in one sentence. */
  hint: string;
  /** True once the demo data shows the task was done. */
  done: (db: DemoDb) => boolean;
  /** Performs the task on the demo data, for presenters or when someone is stuck. */
  doItForMe?: (db: DemoDb) => void;
  /** Shown once the task is done: what changed and why it matters. */
  outcome: string;
}

export interface WalkStep {
  id: string;
  title: string;
  body: string;
  /** The page this step happens on; the walkthrough opens it when the step starts. */
  route?: string;
  /** The element to highlight, found again on every frame because pages re-render. */
  target?: () => Element | null;
  task?: WalkTask;
}

export interface Walkthrough {
  id: string;
  title: string;
  summary: string;
  level: "Beginner" | "Intermediate";
  minutes: number;
  steps: WalkStep[];
  /** The closing message: the business value of what the person just saw. */
  value: string;
}

interface WalkState {
  activeId: string | null;
  step: number;
  paused: boolean;
  finished: boolean;
  completed: string[];
  /** The step whose page has already been opened, so leaving it doesn't pull the person back. */
  routedFor: string | null;
}

const initial: WalkState = { activeId: null, step: 0, paused: false, finished: false, completed: [], routedFor: null };
let state: WalkState = initial;
const listeners = new Set<() => void>();

function set(next: Partial<WalkState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export function useWalkState(): WalkState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const walk = {
  start(id: string) {
    set({ activeId: id, step: 0, paused: false, finished: false, routedFor: null });
  },
  goTo(step: number) {
    set({ step, routedFor: null });
  },
  finish() {
    if (!state.activeId) return;
    set({ finished: true, completed: Array.from(new Set([...state.completed, state.activeId])) });
  },
  pause() {
    set({ paused: true });
  },
  resume() {
    set({ paused: false });
  },
  exit() {
    set({ activeId: null, step: 0, paused: false, finished: false, routedFor: null });
  },
  markRouted(key: string) {
    set({ routedFor: key });
  },
  /** A fresh tutorial session starts with no walkthrough running or completed. */
  reset() {
    state = initial;
    for (const l of listeners) l();
  },
};

// ── Target helpers ──────────────────────────────────────────────────────
export const css = (selector: string) => () => document.querySelector(selector);

/**
 * The first element matching `selector` whose text matches `pattern`, taking
 * the innermost one so a log line is framed rather than the whole log.
 */
export const withText = (selector: string, pattern: RegExp) => () => {
  const matches = Array.from(document.querySelectorAll(selector)).filter((el) => pattern.test(el.textContent?.trim() ?? ""));
  return matches.find((el) => !matches.some((other) => other !== el && el.contains(other))) ?? null;
};

/** The card or section around a heading, so the highlight frames the whole block. */
export const blockTitled = (pattern: RegExp) => () => {
  const heading = Array.from(document.querySelectorAll("[data-main-content-area] h1, [data-main-content-area] h2, [data-main-content-area] h3, [data-main-content-area] p, [data-main-content-area] span"))
    .find((el) => el.childElementCount === 0 && pattern.test(el.textContent?.trim() ?? ""));
  return heading?.closest("section, [data-slot=card], .rounded-lg, .rounded-xl, .rounded-md") ?? heading ?? null;
};
