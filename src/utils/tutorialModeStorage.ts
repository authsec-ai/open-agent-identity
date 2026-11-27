import { scopedStorageKey } from "@/utils/scopedStorageKey";

const STORAGE_BASE = "authsec_tutorial_mode";

/** Whether the signed-in person last left Tutorial mode on in this browser. */
export function readStoredTutorialMode(): boolean {
  try {
    return localStorage.getItem(scopedStorageKey(STORAGE_BASE)) === "on";
  } catch {
    return false;
  }
}

export function storeTutorialMode(on: boolean): void {
  try {
    localStorage.setItem(scopedStorageKey(STORAGE_BASE), on ? "on" : "off");
  } catch {
    // storage unavailable: the choice lasts until reload
  }
}

export type TutorialLevel = "beginner" | "intermediate" | "advanced";
const LEVEL_BASE = "authsec_tutorial_level";

/** How much depth the person wants in explanations; beginner until they choose. */
export function readStoredTutorialLevel(): TutorialLevel {
  try {
    const v = localStorage.getItem(scopedStorageKey(LEVEL_BASE));
    return v === "intermediate" || v === "advanced" ? v : "beginner";
  } catch {
    return "beginner";
  }
}

export function storeTutorialLevel(level: TutorialLevel): void {
  try {
    localStorage.setItem(scopedStorageKey(LEVEL_BASE), level);
  } catch {
    // storage unavailable: the choice lasts until reload
  }
}
