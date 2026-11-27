import { GraduationCap, RotateCcw, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAppDispatch } from "@/app/hooks";
import { baseApi } from "@/app/api/baseApi";
import { useSetTutorialMode, useTutorialMode } from "@/hooks/useTutorialMode";
import { resetDemoDb } from "./demo/state";
import { useTutorialLiveFeed } from "./liveFeed";
import { walk } from "./walkthroughs/model";
import { WalkthroughCoach } from "./walkthroughs/WalkthroughCoach";
import { WalkthroughMenu } from "./walkthroughs/WalkthroughMenu";

const bannerButton =
  "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors duration-150 hover:bg-(--color-primary-soft-strong)";

/** The tutorial's persistent indicator, its controls, and the walkthrough coach. */
export function TutorialBanner() {
  const enabled = useTutorialMode();
  const setTutorialMode = useSetTutorialMode();
  const dispatch = useAppDispatch();
  useTutorialLiveFeed();

  if (!enabled) return null;

  const resetDemo = () => {
    resetDemoDb();
    walk.reset();
    dispatch(baseApi.util.resetApiState());
    toast.success("Demo data restored to its starting point");
  };

  return (
    <>
      <div
        role="status"
        className="flex items-center gap-3 border-b border-(--color-primary-soft-strong) bg-(--color-primary-soft) px-4 py-2 text-[13px] text-(--color-primary-text) lg:px-6"
      >
        <GraduationCap className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 truncate text-[13px] text-(--color-primary-text)">
          <span className="font-semibold">Tutorial mode</span>
          <span className="hidden sm:inline">
            {" "}
            · You're exploring Northwind AI, a demo workspace with sample data. Underlined terms explain themselves
            on hover; nothing you do changes your real workspace.
          </span>
        </p>
        <WalkthroughMenu className={bannerButton} />
        <button type="button" onClick={resetDemo} className={bannerButton}>
          <RotateCcw className="size-3.5" />
          Reset demo
        </button>
        <button type="button" onClick={() => setTutorialMode(false)} className={bannerButton}>
          <X className="size-3.5" />
          Exit
        </button>
      </div>
      <WalkthroughCoach />
    </>
  );
}
