import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { useAppDispatch } from "@/app/hooks";
import { cn } from "@/lib/utils";
import { useTutorialMode } from "@/hooks/useTutorialMode";
import { demoVersion, getDemoDb, notifyDemoChange, subscribeDemo } from "../demo/state";
import { refreshDemoQueries } from "../refresh";
import { useWalkState, walk } from "./model";
import { WALKTHROUGHS } from "./scenarios";

/** Follows the step's target element around the page and draws a ring over it. */
function Highlight({ find, stepKey, onRect }: { find: () => Element | null; stepKey: string; onRect: (r: DOMRect | null) => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => onRect(rect), [rect, onRect]);
  useEffect(() => {
    let scrolled = false;
    let frame = 0;
    const tick = () => {
      const el = find();
      if (el) {
        if (!scrolled) {
          // Near the top, below the header, so the coach card in a lower corner stays clear of it.
          (el as HTMLElement).style.scrollMarginTop = "140px";
          el.scrollIntoView({ block: "start", behavior: "smooth" });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height ? prev : r,
        );
      } else {
        setRect(null);
      }
      frame = window.setTimeout(tick, 250);
    };
    tick();
    return () => window.clearTimeout(frame);
  }, [find, stepKey]);

  if (!rect || rect.width === 0) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[35] rounded-lg ring-2 ring-(--color-primary) ring-offset-2 ring-offset-transparent transition-all duration-300 ease-out"
      style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8, boxShadow: "0 0 0 6px color-mix(in srgb, var(--color-primary) 18%, transparent)" }}
    />
  );
}

const CARD_W = 400;
type Corner = "bottom-right" | "top-right" | "bottom-left";
const CORNER_CLASS: Record<Corner, string> = {
  "bottom-right": "right-6 bottom-6",
  "top-right": "right-6 top-28",
  "bottom-left": "left-6 bottom-6 md:left-[calc(var(--sidebar-width,16rem)+1.5rem)]",
};

/** The first corner whose card area doesn't cover the highlighted element. */
function pickCorner(target: DOMRect | null, cardHeight: number): Corner {
  if (!target) return "bottom-right";
  const CARD_H = cardHeight || 320;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const areas: Record<Corner, { left: number; top: number; right: number; bottom: number }> = {
    "bottom-right": { left: w - CARD_W - 24, top: h - CARD_H - 24, right: w, bottom: h },
    "top-right": { left: w - CARD_W - 24, top: 112, right: w, bottom: 112 + CARD_H },
    "bottom-left": { left: 0, top: h - CARD_H - 24, right: CARD_W + 300, bottom: h },
  };
  const overlaps = (a: (typeof areas)[Corner]) =>
    target.left < a.right && target.right > a.left && target.top < a.bottom && target.bottom > a.top;
  return (Object.keys(areas) as Corner[]).find((c) => !overlaps(areas[c])) ?? "bottom-right";
}

export function WalkthroughCoach() {
  const tutorial = useTutorialMode();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const s = useWalkState();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dispatch = useAppDispatch();
  useSyncExternalStore(subscribeDemo, demoVersion);

  const wt = WALKTHROUGHS.find((w) => w.id === s.activeId);
  const step = wt && !s.finished ? wt.steps[s.step] : undefined;
  const stepKey = wt && step ? `${wt.id}:${step.id}` : "";

  useEffect(() => {
    if (!tutorial || !step || s.paused || s.routedFor === stepKey) return;
    walk.markRouted(stepKey);
    if (step.route && pathname !== step.route) navigate(step.route);
  }, [tutorial, step, stepKey, s.paused, s.routedFor, pathname, navigate]);

  if (!tutorial || !wt) return null;

  if (s.paused) {
    return (
      <div className="fixed right-6 bottom-6 z-[45] flex items-center gap-2 rounded-full border border-(--color-border-subtle) bg-(color:--color-surface-raised) py-1.5 pr-1.5 pl-4 text-[13px] text-(color:--color-text) shadow-(--shadow-md)">
        <span className="font-medium">{wt.title}</span>
        <span className="text-(--color-text-muted)">paused at step {s.step + 1}</span>
        <button type="button" onClick={walk.resume} className="flex items-center gap-1 rounded-full bg-(--color-primary) px-3 py-1 font-medium text-white transition-colors hover:bg-(--color-primary-strong)">
          <Play className="size-3.5" /> Resume
        </button>
        <button type="button" onClick={walk.exit} aria-label="End walkthrough" className="grid size-7 place-items-center rounded-full text-(--color-text-muted) hover:bg-(--color-hover)">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  const card = "fixed z-[45] w-[min(92vw,380px)] transition-[top,bottom,left,right] duration-300 rounded-xl border border-(--color-border-subtle) bg-(color:--color-surface-raised) p-4 text-(color:--color-text) shadow-(--shadow-lg)";

  if (s.finished) {
    return (
      <div role="dialog" aria-label={`${wt.title} complete`} className={cn(card, CORNER_CLASS["bottom-right"])}>
        <div className="flex items-center gap-2 text-(--color-success)">
          <Sparkles className="size-4" />
          <span className="text-[12px] font-semibold uppercase tracking-wide">Walkthrough complete</span>
        </div>
        <h3 className="mt-2 text-[15px] font-semibold">{wt.title}</h3>
        <p className="mt-1.5 text-[13px] leading-5 text-(--color-text-muted)">{wt.value}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => walk.start(wt.id)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium hover:bg-(--color-hover)">
            <RotateCcw className="size-3.5" /> Restart
          </button>
          <button type="button" onClick={walk.exit} className="rounded-md bg-(--color-primary) px-3 py-1.5 text-[13px] font-medium text-white hover:bg-(--color-primary-strong)">
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!step) return null;
  const db = getDemoDb();
  const taskDone = step.task ? step.task.done(db) : true;
  const last = s.step === wt.steps.length - 1;
  const onWrongPage = step.route && pathname !== step.route;

  const doItForMe = () => {
    step.task?.doItForMe?.(db);
    notifyDemoChange();
    refreshDemoQueries(dispatch);
  };

  return (
    <>
      {step.target ? <Highlight find={step.target} stepKey={stepKey} onRect={setTargetRect} /> : null}
      <div
        role="dialog"
        aria-label={`${wt.title}, step ${s.step + 1} of ${wt.steps.length}`}
        ref={(el) => {
          const h = el?.offsetHeight ?? 0;
          if (h && h !== cardHeight) setCardHeight(h);
        }}
        className={cn(card, CORNER_CLASS[pickCorner(step.target ? targetRect : null, cardHeight)])}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-(--color-primary)">{wt.title}</span>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={walk.pause} aria-label="Pause walkthrough" title="Pause" className="grid size-7 place-items-center rounded-md text-(--color-text-muted) hover:bg-(--color-hover)">
              <Pause className="size-3.5" />
            </button>
            <button type="button" onClick={() => walk.start(wt.id)} aria-label="Restart walkthrough" title="Restart" className="grid size-7 place-items-center rounded-md text-(--color-text-muted) hover:bg-(--color-hover)">
              <RotateCcw className="size-3.5" />
            </button>
            <button type="button" onClick={walk.exit} aria-label="End walkthrough" title="End" className="grid size-7 place-items-center rounded-md text-(--color-text-muted) hover:bg-(--color-hover)">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-2 flex gap-1" aria-hidden>
          {wt.steps.map((st, i) => (
            <span key={st.id} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i <= s.step ? "bg-(--color-primary)" : "bg-(--color-border-subtle)")} />
          ))}
        </div>

        <h3 className="mt-3 text-[15px] font-semibold">{step.title}</h3>
        <p className="mt-1.5 text-[13px] leading-5 text-(--color-text-muted)">{step.body}</p>

        {step.task ? (
          <div className={cn("mt-3 rounded-lg border p-3 text-[13px] leading-5 transition-colors duration-300", taskDone ? "border-(--color-success)/40 bg-(--color-success)/10" : "border-(--color-primary-soft-strong) bg-(--color-primary-soft)")}>
            {taskDone ? (
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-(--color-success)" />
                <p>{step.task.outcome}</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-(--color-primary)" />
                  <p>
                    <span className="font-semibold">Your turn: </span>
                    {step.task.hint}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 pl-6">
                  {onWrongPage ? (
                    <button type="button" onClick={() => navigate(step.route!)} className="text-[12px] font-medium text-(--color-primary) hover:underline">
                      Take me there
                    </button>
                  ) : null}
                  {step.task.doItForMe ? (
                    <button type="button" onClick={doItForMe} className="text-[12px] font-medium text-(--color-primary) hover:underline">
                      Do it for me
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : onWrongPage ? (
          <button type="button" onClick={() => navigate(step.route!)} className="mt-2 text-[12px] font-medium text-(--color-primary) hover:underline">
            Take me back to this step's page
          </button>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[12px] text-(--color-text-subtle)">
            Step {s.step + 1} of {wt.steps.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={s.step === 0}
              onClick={() => walk.goTo(s.step - 1)}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-(--color-hover) disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={() => (last ? walk.finish() : walk.goTo(s.step + 1))}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                taskDone ? "bg-(--color-primary) text-white hover:bg-(--color-primary-strong)" : "text-(--color-text-muted) hover:bg-(--color-hover)",
              )}
            >
              {taskDone ? (last ? "Finish" : "Next") : "Skip step"}
              {!last ? <ChevronRight className="size-3.5" /> : null}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
