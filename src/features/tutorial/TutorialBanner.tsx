import { GraduationCap, RotateCcw, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAppDispatch } from "@/app/hooks";
import { baseApi } from "@/app/api/baseApi";
import { useSetTutorialMode, useTutorialMode } from "@/hooks/useTutorialMode";
import { resetDemoDb } from "./demo/state";

export function TutorialBanner() {
  const enabled = useTutorialMode();
  const setTutorialMode = useSetTutorialMode();
  const dispatch = useAppDispatch();

  if (!enabled) return null;

  const resetDemo = () => {
    resetDemoDb();
    dispatch(baseApi.util.resetApiState());
    toast.success("Demo data restored to its starting point");
  };

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-(--color-primary-soft-strong) bg-(--color-primary-soft) px-4 py-2 text-[13px] text-(--color-primary-text) lg:px-6"
    >
      <GraduationCap className="size-4 shrink-0" />
      <p className="min-w-0 flex-1 truncate text-[13px] text-(--color-primary-text)">
        <span className="font-semibold">Tutorial mode</span>
        <span className="hidden sm:inline">
          {" "}
          · You're exploring Northwind AI, a demo workspace. Everything here is sample data, and nothing you do
          changes your real workspace.
        </span>
      </p>
      <button
        type="button"
        onClick={resetDemo}
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors duration-150 hover:bg-(--color-primary-soft-strong)"
      >
        <RotateCcw className="size-3.5" />
        Reset demo
      </button>
      <button
        type="button"
        onClick={() => setTutorialMode(false)}
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors duration-150 hover:bg-(--color-primary-soft-strong)"
      >
        <X className="size-3.5" />
        Exit
      </button>
    </div>
  );
}
