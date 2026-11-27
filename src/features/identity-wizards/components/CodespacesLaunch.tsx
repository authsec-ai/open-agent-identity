import { ExternalLink, Github } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

import { codespacesUrl, starterEnv, starterRepo, starterRepoUrl, type StarterEnvContext } from "../codespaces";
import type { IdentityKind } from "../docs";

/**
 * Runs the new service account for real in GitHub Codespaces: a browser VS Code
 * with the AuthSec starter, where Python, TypeScript and Go samples get a token
 * and list the MCP server's tools with it.
 */
export function CodespacesLaunch({
  kind,
  context,
  disabledReason,
}: {
  kind: IdentityKind;
  context: StarterEnvContext;
  /** Set when launching makes no sense here (Tutorial mode's demo servers). */
  disabledReason?: string;
}) {
  const env = starterEnv(kind, context);
  const secretStep =
    kind === "private_key_jwt"
      ? "Upload private_key.pem to the codespace (drag it into the Explorer)."
      : "Replace the client secret placeholder with the secret shown above.";

  return (
    <div className="space-y-3 rounded-lg border border-(--color-border-subtle) px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-(--color-text)">
            <Github className="size-3.5" aria-hidden />
            Run it in GitHub Codespaces
          </p>
          <p className="mt-0.5 text-[12px] text-(--color-text-muted)">
            Opens VS Code in a new browser tab with a ready-to-run starter. Each sample gets a token
            for this service account and lists the MCP server's tools with it. Nothing to install.
          </p>
        </div>
        {disabledReason ? (
          <Button size="sm" disabled>
            <ExternalLink className="size-3.5" />
            Open in Codespaces
          </Button>
        ) : (
          <Button size="sm" asChild className="text-white">
            <a href={codespacesUrl()} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              Open in Codespaces
            </a>
          </Button>
        )}
      </div>

      {disabledReason ? (
        <p className="text-[12px] text-(--color-text-muted)">{disabledReason}</p>
      ) : (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-[12px] text-(--color-text-muted)">
            <li>
              Click <span className="font-medium text-(--color-text)">Create codespace</span>. It takes about a minute
              the first time.
            </li>
            <li>
              Create a file named <span className="font-mono">.env</span> in the codespace and paste the block below.{" "}
              {secretStep}
            </li>
            <li>
              In the terminal, run <span className="font-mono">bash scripts/run.sh python</span> (or{" "}
              <span className="font-mono">typescript</span>, <span className="font-mono">go</span>).
            </li>
          </ol>

          <div className="relative">
            <pre className="overflow-x-auto rounded-md border border-(--color-border-subtle) bg-(--color-surface-subtle) px-3 py-2 pr-10 font-mono text-[12px] text-(--color-text)">
              {env}
            </pre>
            <div className="absolute right-1.5 top-1.5">
              <CopyButton text={env} variant="outline" label="Copy the starter .env" />
            </div>
          </div>

          <p className="text-[11px] text-(--color-text-muted)">
            Prefer secrets? Choose <span className="font-medium">New with options</span> on the create page to enter
            them as Codespaces secrets instead. Starter source:{" "}
            <a href={starterRepoUrl()} target="_blank" rel="noreferrer" className="font-mono hover:underline">
              {starterRepo()}
            </a>
          </p>
        </>
      )}
    </div>
  );
}
