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
