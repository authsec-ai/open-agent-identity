import { CheckCircle2, Map, Play, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWalkState, walk } from "./model";
import { WALKTHROUGHS } from "./scenarios";

export function WalkthroughMenu({ className }: { className?: string }) {
  const s = useWalkState();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={className}>
          <Map className="size-3.5" />
          Walkthroughs
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[min(92vw,400px)] rounded-lg border-(--color-border-subtle) bg-(color:--color-surface-raised) p-2 text-(color:--color-text) shadow-(--shadow-md)"
      >
        <p className="px-2 pt-1 pb-2 text-[12px] text-(--color-text-muted)">
          Guided stories through the demo workspace. You do each step yourself; pause or leave any time.
        </p>
        <ul className="space-y-1">
          {WALKTHROUGHS.map((w) => {
            const running = s.activeId === w.id && !s.finished;
            const done = s.completed.includes(w.id);
            return (
              <li key={w.id} className="rounded-md p-2 transition-colors hover:bg-(--color-hover)">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold">{w.title}</span>
                      {done ? <CheckCircle2 className="size-3.5 text-(--color-success)" aria-label="Completed" /> : null}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-[18px] text-(--color-text-muted)">{w.summary}</p>
                    <p className="mt-1 text-[11px] text-(--color-text-subtle)">
                      {w.level} · {w.minutes} min · {w.steps.length} steps
                      {running ? ` · on step ${s.step + 1}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => (running ? walk.resume() : walk.start(w.id))}
                    className="flex shrink-0 items-center gap-1 rounded-md bg-(--color-primary) px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-(--color-primary-strong)"
                  >
                    {running ? <Play className="size-3" /> : done ? <RotateCcw className="size-3" /> : <Play className="size-3" />}
                    {running ? (s.paused ? "Resume" : "Continue") : done ? "Replay" : "Start"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
