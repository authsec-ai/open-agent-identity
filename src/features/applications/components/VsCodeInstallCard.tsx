import { useState } from "react";
import { Check, Code2, Copy, ExternalLink, ShieldAlert } from "lucide-react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  isInstallableResourceUri,
  mcpServerName,
  vscodeInstallUrl,
  vscodeMcpJson,
} from "../lib/vscodeInstall";
import { Surface } from "./ApplicationConsole";

const STEPS = [
  "Click Install in VS Code. A new tab opens and hands the server to VS Code, which asks you to confirm.",
  "Open Copilot Chat in Agent mode and ask for something this server's tools can do.",
  "On the first call VS Code opens the AuthSec sign-in and consent page. Sign in as an end user.",
  "Tool calls now carry an AuthSec token. They appear on the Activity tab, and denied tools stay denied.",
];

/**
 * Lets a developer try the protected MCP server from a real AI client: VS Code
 * with Copilot. VS Code discovers AuthSec from the server's 401 challenge and
 * signs in through it, so this card only needs the server URL.
 */
export function VsCodeInstallCard({
  applicationName,
  resourceUri,
  ready,
  tutorialMode,
}: {
  applicationName: string;
  resourceUri: string | undefined;
  /** Live metadata and challenge checks passed, so VS Code can discover AuthSec. */
  ready: boolean;
  tutorialMode: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const installable = isInstallableResourceUri(resourceUri);
  const name = mcpServerName(applicationName);

  const copyJson = async () => {
    if (!installable) return;
    try {
      await navigator.clipboard.writeText(vscodeMcpJson(name, resourceUri));
      setCopied(true);
      toast.success("Copied .vscode/mcp.json");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  };

  const blockedReason = tutorialMode
    ? "Demo servers aren't reachable, so installing one in VS Code would fail. Turn off Tutorial mode to install a real server."
    : !installable
      ? "VS Code needs an https URL for this server (http is allowed only for localhost). Fix the server URL in Setup."
      : null;

  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Code2 className="size-4 text-slate-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-950">Try it in VS Code</h3>
            <HelpTooltip content="VS Code with GitHub Copilot is a real MCP client. It finds AuthSec from this server's 401 response, registers itself as a client, and signs you in. The link carries only the server name and URL, never a credential." />
          </div>
          <p className="mt-1 max-w-prose text-xs text-slate-500">
            Add this server to VS Code and call its tools from Copilot Chat, signed in
            through AuthSec. It's the same flow your users' AI clients go through.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {blockedReason ? (
            <Button disabled>
              <ExternalLink className="mr-2 size-4" />
              Install in VS Code
            </Button>
          ) : (
            <>
              <Button asChild>
                <a
                  href={vscodeInstallUrl(name, resourceUri as string)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="mr-2 size-4" />
                  Install in VS Code
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={vscodeInstallUrl(name, resourceUri as string, "insiders")}
                  target="_blank"
                  rel="noreferrer"
                >
                  Insiders
                </a>
              </Button>
            </>
          )}
        </div>
      </div>

      {blockedReason ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-slate-500" aria-hidden />
          {blockedReason}
        </p>
      ) : !ready ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Some readiness checks are failing. VS Code can still install the server, but sign-in or
          tool calls may fail until they pass. Servers on localhost can't be checked from here, so
          their checks show as failed even when they work.
        </p>
      ) : null}

      <ol className="mt-4 space-y-2">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-xs leading-5 text-slate-600">
            <span
              className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                "border-slate-300 bg-white text-slate-700",
              )}
            >
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      {installable && !tutorialMode && (
        <details className="mt-4 rounded-md border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-700">
            Add it by hand instead (.vscode/mcp.json)
          </summary>
          <div className="relative border-t border-slate-200">
            <pre className="overflow-x-auto p-3 font-mono text-xs text-slate-800">
              {vscodeMcpJson(name, resourceUri)}
            </pre>
            <Button
              variant="outline"
              size="sm"
              onClick={copyJson}
              className="absolute right-2 top-2"
              aria-label="Copy .vscode/mcp.json"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </details>
      )}
    </Surface>
  );
}
