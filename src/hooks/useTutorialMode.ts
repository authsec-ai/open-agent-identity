import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setTutorialLevel, setTutorialMode } from "@/app/slices/uiSlice";
import { storeTutorialLevel, storeTutorialMode, type TutorialLevel } from "@/utils/tutorialModeStorage";

export function useTutorialLevel(): [TutorialLevel, (level: TutorialLevel) => void] {
  const dispatch = useAppDispatch();
  const level = useAppSelector((state) => state.ui.tutorialLevel);
  const set = useCallback(
    (next: TutorialLevel) => {
      dispatch(setTutorialLevel(next));
      storeTutorialLevel(next);
    },
    [dispatch],
  );
  return [level, set];
}

export function useTutorialMode(): boolean {
  return useAppSelector((state) => state.ui.tutorialMode);
}

/** Turns Tutorial mode on or off and remembers the choice for this person. */
export function useSetTutorialMode(): (next: boolean) => void {
  const dispatch = useAppDispatch();
  return useCallback(
    (next: boolean) => {
      dispatch(setTutorialMode(next));
      storeTutorialMode(next);
    },
    [dispatch],
  );
}
