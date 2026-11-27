import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import type { SnippetLanguage } from "../docs";
import type { Snippet } from "../snippets";

interface CodeTabsProps {
  snippets: Snippet[];
  /** SDK reference per language, linked under that language's code. */
  sdkDocs: Partial<Record<SnippetLanguage, string>>;
  initial?: Snippet["id"];
}

const SDK_NAMES: Record<SnippetLanguage, string> = { python: "Python SDK", typescript: "TypeScript SDK", go: "Go SDK" };

/** Copy-ready code, one tab per language, each pointing at its own SDK reference. */
export function CodeTabs({ snippets, sdkDocs, initial }: CodeTabsProps) {
  const [active, setActive] = useState<Snippet["id"]>(initial ?? snippets[0]?.id);
  const current = snippets.find((s) => s.id === active) ?? snippets[0];
  const docsHref = current && current.id in SDK_NAMES ? sdkDocs[current.id as SnippetLanguage] : undefined;

  return (
    <div className="overflow-hidden rounded-lg border border-(--color-border-subtle)">
      <div role="tablist" aria-label="Code samples" className="flex overflow-x-auto border-b border-(--color-border-subtle) bg-(--color-surface-subtle)">
        {snippets.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === current?.id}
            onClick={() => setActive(s.id)}
            className={cn(
              "shrink-0 border-b-2 px-3.5 py-2 text-[12px] font-medium transition-colors duration-150",
              s.id === current?.id
                ? "border-(--color-primary) text-(--color-text)"
                : "border-transparent text-(--color-text-muted) hover:text-(--color-text)",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {current ? (
        <div role="tabpanel">
          {current.unsupported ? (
            <p className="px-4 py-5 text-[13px] text-(--color-text-muted)">{current.unsupported}</p>
          ) : (
            <div className="relative">
              <pre className="max-h-[320px] overflow-auto bg-(--color-surface-raised) p-4 font-mono text-[12px] leading-[18px] text-(--color-text)">
                <code>{current.code}</code>
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={current.code} variant="outline" label={`Copy ${current.label}`} />
              </div>
            </div>
          )}
          {docsHref ? (
            <div className="flex items-center justify-end border-t border-(--color-border-subtle) px-3 py-2">
              <a href={docsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-(--color-primary) hover:underline">
                {SDK_NAMES[current.id as SnippetLanguage]} reference
                <ExternalLink className="size-3" />
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
