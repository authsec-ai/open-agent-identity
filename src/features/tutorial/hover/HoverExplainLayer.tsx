import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTutorialMode } from "@/hooks/useTutorialMode";
import { getDemoDb } from "../demo/state";
import type { HoverInfo } from "./glossary";
import { explainText } from "./resolve";

const SHOW_DELAY_MS = 300;
const MAX_CLIMB = 5;
const MARK = "data-tutorial-explained";
const SKIP = "[data-tutorial-ui], [data-radix-popper-content-wrapper], input, textarea, select, [contenteditable=true]";

interface Shown {
  info: HoverInfo;
  rect: DOMRect;
}

/** The nearest element (the target or a close ancestor) whose text has an explanation. */
function findExplained(target: Element): { el: Element; info: HoverInfo } | null {
  if (target.closest(SKIP)) return null;
  let el: Element | null = target;
  for (let i = 0; el && i < MAX_CLIMB; i++, el = el.parentElement) {
    if (el.matches("[data-main-content-area], body, main")) break;
    const text = el.textContent ?? "";
    if (text.length > 160) break;
    const info = explainText(getDemoDb(), text);
    if (info) return { el, info };
  }
  return null;
}

function Card({ shown }: { shown: Shown }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const card = ref.current;
    if (!card) return;
    const { rect } = shown;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const below = rect.bottom + 8 + h <= window.innerHeight - 8;
    const top = below ? rect.bottom + 8 : Math.max(8, rect.top - 8 - h);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 8);
    setPos({ top, left });
  }, [shown]);

  return (
    <div
      ref={ref}
      role="tooltip"
      data-tutorial-ui
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="pointer-events-none fixed z-[120] w-max max-w-[min(92vw,320px)] rounded-lg border border-(--color-border-subtle) bg-(color:--color-surface-raised) px-3 py-2.5 text-(color:--color-text) shadow-(--shadow-md) animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <p className="text-[13px] font-semibold leading-5">{shown.info.title}</p>
      <p className="mt-0.5 text-[12px] leading-[18px] text-(--color-text-muted)">{shown.info.body}</p>
      {shown.info.facts?.length ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-(--color-border-subtle) pt-2 text-[12px] leading-[18px]">
          {shown.info.facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-(--color-text-subtle)">{label}</dt>
              <dd className="break-words text-(--color-text)">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * In Tutorial mode, hovering any status, badge, column, scope, client, person,
 * tool or log line explains what it is. It reads what is on screen, so pages
 * need no changes to take part.
 */
export function HoverExplainLayer() {
  const enabled = useTutorialMode();
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    let anchor: Element | null = null;

    const clear = () => {
      window.clearTimeout(timer);
      anchor?.removeAttribute(MARK);
      anchor = null;
      setShown(null);
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || (anchor && anchor.contains(target))) return;
      const hit = findExplained(target);
      if (!hit) {
        clear();
        return;
      }
      clear();
      anchor = hit.el;
      anchor.setAttribute(MARK, "");
      timer = window.setTimeout(() => {
        if (anchor === hit.el && document.contains(hit.el)) setShown({ info: hit.info, rect: hit.el.getBoundingClientRect() });
      }, SHOW_DELAY_MS);
    };

    const onOut = (e: MouseEvent) => {
      if (anchor && !(e.relatedTarget instanceof Node && anchor.contains(e.relatedTarget))) clear();
    };

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("scroll", clear, true);
    document.addEventListener("mousedown", clear, true);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("scroll", clear, true);
      document.removeEventListener("mousedown", clear, true);
      clear();
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      <style>{`[${MARK}]{outline:1px dashed color-mix(in srgb,var(--color-primary) 55%,transparent);outline-offset:2px;border-radius:4px;cursor:help}`}</style>
      {shown ? createPortal(<Card shown={shown} />, document.body) : null}
    </>
  );
}
