import type { ReactNode } from "react";
import { Check, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface WizardStepDef {
  id: string;
  label: string;
}

interface WizardShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  steps: WizardStepDef[];
  current: number;
  /** The docs page for what is being created, linked from every step. */
  docsHref: string;
  docsLabel?: string;
  children: ReactNode;
  footer: ReactNode;
}

/** A dialog with a numbered step bar, a body and a footer that keeps the docs link in reach. */
export function WizardShell({ open, onOpenChange, title, description, steps, current, docsHref, docsLabel = "Read the guide", children, footer }: WizardShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1 border-b border-(--color-border-subtle) px-7 pt-6 pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 pt-3" aria-label="Progress">
            {steps.map((step, i) => {
              const done = i < current;
              const active = i === current;
              return (
                <li key={step.id} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors duration-200",
                      done && "border-(--color-primary) bg-(--color-primary) text-white",
                      active && "border-(--color-primary) text-(--color-primary)",
                      !done && !active && "border-(--color-border-subtle) text-(--color-text-subtle)",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn("text-[13px]", active ? "font-medium text-(--color-text)" : "text-(--color-text-muted)")}>{step.label}</span>
                  {i < steps.length - 1 ? <span aria-hidden className="mx-1 h-px w-6 bg-(--color-border-subtle)" /> : null}
                </li>
              );
            })}
          </ol>
        </DialogHeader>

        <div className="max-h-[min(60vh,560px)] overflow-y-auto px-7 py-5">{children}</div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border-subtle) px-7 py-4">
          <a
            href={docsHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-(--color-primary) hover:underline"
          >
            {docsLabel}
            <ExternalLink className="size-3.5" />
          </a>
          <div className="flex items-center gap-2">{footer}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
