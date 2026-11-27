import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setTutorialMode } from "@/app/slices/uiSlice";
import { storeTutorialMode } from "@/utils/tutorialModeStorage";

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
