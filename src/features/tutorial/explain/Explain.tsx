import { Info } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTutorialLevel, useTutorialMode } from "@/hooks/useTutorialMode";
import type { TutorialLevel } from "@/utils/tutorialModeStorage";
import { EXPLAIN, type ExplainEntry } from "./content";
import { explainIdForPath } from "./routes";

const LEVELS: Array<{ value: TutorialLevel; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-subtle)">{heading}</h4>
      <div className="text-[13px] leading-5 text-(--color-text)">{children}</div>
    </section>
  );
}

function ExplainCard({ entry }: { entry: ExplainEntry }) {
  const [level, setLevel] = useTutorialLevel();
  const deeper = level !== "beginner";
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-(--color-text)">{entry.title}</h3>
      </div>
      <div role="radiogroup" aria-label="Explanation depth" className="grid grid-cols-3 gap-1 rounded-md bg-(--color-surface-subtle) p-0.5">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={level === l.value}
            onClick={() => setLevel(l.value)}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium transition-colors duration-150",
              level === l.value
                ? "bg-(--color-surface-raised) text-(--color-text) shadow-(--shadow-xs)"
                : "text-(--color-text-muted) hover:text-(--color-text)",
            )}
          >
            {l.label}
          </button>
        ))}
      </div>
      <Section heading="What is this?">{entry.what}</Section>
      <Section heading="Why it matters">{entry.why}</Section>
      {deeper && entry.how ? <Section heading="How it works">{entry.how}</Section> : null}
      {deeper && entry.reading ? <Section heading="Reading the data">{entry.reading}</Section> : null}
      {level === "advanced" && entry.technical ? <Section heading="Under the hood">{entry.technical}</Section> : null}
      {entry.actions.length ? (
        <Section heading="What you can do">
          <ul className="list-disc space-y-0.5 pl-4">
            {entry.actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {entry.demo ? (
        <p className="rounded-md bg-(--color-primary-soft) px-2.5 py-2 text-[12px] leading-5 text-(--color-primary-text)">
          <span className="font-semibold">In this demo: </span>
          {entry.demo}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A small info button that explains a page, metric or concept. It only exists
 * in Tutorial mode; ids resolve against the central content registry.
 */
export function Explain({ id, className, side = "bottom", align = "start" }: { id: string; className?: string; side?: "top" | "right" | "bottom" | "left"; align?: "start" | "center" | "end" }) {
  const enabled = useTutorialMode();
  const entry = EXPLAIN[id];
  if (!enabled || !entry) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Explain: ${entry.title}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-grid size-5 shrink-0 place-items-center rounded-full align-middle text-(--color-primary) transition-colors duration-150 hover:bg-(--color-primary-soft) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus-ring)",
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        collisionPadding={16}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[min(70vh,520px)] w-[min(92vw,380px)] overflow-y-auto rounded-lg border-(--color-border-subtle) bg-(color:--color-surface-raised) p-4 text-(color:--color-text) shadow-(--shadow-md) duration-150"
      >
        <ExplainCard entry={entry} />
      </PopoverContent>
    </Popover>
  );
}

/** The explanation for whichever page is open, placed next to its title. */
export function PageExplain({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const id = explainIdForPath(pathname);
  return id ? <Explain id={id} className={className} /> : null;
}
