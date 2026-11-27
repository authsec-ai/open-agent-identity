import type { ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import { useTutorialMode } from "@/hooks/useTutorialMode";
import { TERMS, type TermKey } from "./terms";

interface TermTooltipProps {
  /** Without a term (a value AuthSec doesn't define), the children render as-is. */
  term: TermKey | undefined;
  children: ReactNode;
  /** Dotted underline for plain-text terms such as column headers; badges carry their own styling. */
  underline?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

/**
 * Explains a piece of console vocabulary on hover or keyboard focus. Only
 * active in Tutorial mode; otherwise it renders its children untouched.
 */
export function TermTooltip({ term, children, underline = false, side = "top", className }: TermTooltipProps) {
  const enabled = useTutorialMode();
  if (!enabled || !term) return <>{children}</>;
  const def = TERMS[term];
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={400}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span
            tabIndex={0}
            className={cn(
              "inline-flex max-w-full cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:ring-offset-1",
              underline && "underline decoration-(--color-text-subtle) decoration-dotted underline-offset-4",
              className,
            )}
          >
            {children}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className={cn(
              "z-[110] w-max max-w-[300px] rounded-lg border border-(--color-border-subtle) bg-(color:--color-surface-raised) px-3 py-2.5 text-left shadow-(--shadow-md)",
              "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-150",
            )}
          >
            <p className="text-[13px] leading-5 font-semibold text-(color:--color-text)">{def.title}</p>
            <p className="mt-0.5 text-[12px] leading-[18px] font-normal text-(--color-text-muted)">{def.description}</p>
            {"why" in def && def.why ? (
              <p className="mt-1.5 border-t border-(--color-border-subtle) pt-1.5 text-[12px] leading-[18px] font-normal text-(color:--color-text)">
                <span className="font-medium">Why it matters: </span>
                {def.why}
              </p>
            ) : null}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
