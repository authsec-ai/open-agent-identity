import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import config from "@/config";
import { useListApplicationsQuery } from "@/app/api/applicationsApi";
import { useListResourceServerScopesQuery } from "@/app/api/scopeMatrixApi";
import { useRegisterAgentMutation } from "@/app/api/agentIdentityApi";
import type { OAuthScope } from "@/app/api/types/scopeMatrix";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardShell } from "./components/WizardShell";
import { CodeTabs } from "./components/CodeTabs";
import { CredentialField } from "./components/CredentialField";
import { IDENTITY_DOCS } from "./docs";
import { snippetsFor } from "./snippets";

const STEPS = [
  { id: "details", label: "Details" },
  { id: "application", label: "Application" },
  { id: "connect", label: "Connect" },
];

/** The SDK's browser_login listens here by default, so local agents work without extra setup. */
const DEFAULT_REDIRECT = "http://localhost:8126/callback";

const NO_SCOPES: OAuthScope[] = [];

interface Registered {
  clientId: string;
  clientSecret: string;
  issuer: string;
}

const isRedirectUri = (v: string) => /^https?:\/\/[^\s]+$/i.test(v.trim());

export function AgentWizard({ open, onOpenChange, onRegistered }: { open: boolean; onOpenChange: (open: boolean) => void; onRegistered?: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [redirect, setRedirect] = useState(DEFAULT_REDIRECT);
  const [applicationId, setApplicationId] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [registered, setRegistered] = useState<Registered | null>(null);
  const [savedSecret, setSavedSecret] = useState(false);

  const { data: applications = [] } = useListApplicationsQuery(undefined, { skip: !open });
  const { data: appScopesData, isFetching: loadingScopes } = useListResourceServerScopesQuery(applicationId, { skip: !applicationId });
  const appScopes = appScopesData ?? NO_SCOPES;
  const [register, { isLoading }] = useRegisterAgentMutation();
  const app = applications.find((a) => a.id === applicationId);

  // Start from the low-risk scopes; anything riskier is a deliberate choice.
  useEffect(() => {
    setScopes(appScopes.filter((s) => s.risk_level === "low").map((s) => s.scope_string));
  }, [appScopes]);

  const detailsError = useMemo(() => {
    if (!name.trim()) return "Give the agent a name.";
    if (!isRedirectUri(redirect)) return "Enter the redirect URI the sign-in page returns to.";
    return null;
  }, [name, redirect]);

  const reset = () => {
    setStep(0);
    setName("");
    setRedirect(DEFAULT_REDIRECT);
    setApplicationId("");
    setScopes([]);
    setRegistered(null);
    setSavedSecret(false);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (registered && !savedSecret) {
      toast.error("Copy the client secret and confirm you saved it — it won't be shown again.");
      return;
    }
    close();
  };

  const create = async () => {
    try {
      const res = await register({ name: name.trim(), redirect_uris: [redirect.trim()] }).unwrap();
      setRegistered({ clientId: res.client_id, clientSecret: res.client_secret, issuer: res.issuer || config.VITE_OAUTH_BASE_URL });
      setStep(2);
      onRegistered?.();
      toast.success(`${name.trim()} registered.`);
    } catch (err) {
      const apiErr = err as { data?: { error?: string } };
      toast.error(apiErr?.data?.error ?? "Couldn't register the agent.");
    }
  };

  const toggleScope = (scope: string, on: boolean) => setScopes((prev) => (on ? [...prev, scope] : prev.filter((s) => s !== scope)));

  const footer =
    step === 2 ? (
      <Button className="text-[length:var(--text-sm)] text-white" disabled={!savedSecret} onClick={close}>
        Done
      </Button>
    ) : (
      <>
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={isLoading}>
            Back
          </Button>
        ) : (
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
        )}
        <Button
          className="text-[length:var(--text-sm)] text-white"
          onClick={() => (step === 0 ? setStep(1) : void create())}
          disabled={(step === 0 && Boolean(detailsError)) || isLoading}
          title={step === 0 ? detailsError ?? undefined : undefined}
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
          {step === 0 ? "Next" : "Register agent"}
        </Button>
      </>
    );

  return (
    <WizardShell
      open={open}
      onOpenChange={handleOpenChange}
      title={step === 2 ? `${name.trim() || "Agent"} is registered` : "Register an AI agent"}
      description={
        step === 2
          ? "Wire the agent up with these values. Each tab links to its SDK reference."
          : "An agent acts for a signed-in person. Its tokens carry both identities, so it can never do more than that person may."
      }
      steps={STEPS}
      current={step}
      docsHref={IDENTITY_DOCS.agent.guide}
      docsLabel="AI agents guide"
      footer={footer}
    >
      {step === 0 ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ag-name">Name</Label>
            <Input id="ag-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Support Copilot" autoComplete="off" autoFocus />
            <p className="text-[12px] text-(--color-text-muted)">People see this name when they consent and when an admin approves its first request.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-redirect">Redirect URI</Label>
            <Input id="ag-redirect" value={redirect} onChange={(e) => setRedirect(e.target.value)} className="font-mono text-[12px]" autoComplete="off" />
            <p className="text-[12px] text-(--color-text-muted)">
              Where the sign-in page sends the person back. Keep <span className="font-mono">{DEFAULT_REDIRECT}</span> for an agent running locally with the SDK's browser login; use your app's callback URL in production.
            </p>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-[13px] leading-5 text-(--color-text-muted)">
            Optional. Choose the application the agent will call so the code on the next step is ready to run. The agent never gets a role of its own: each token is limited to what the signed-in person can do.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="ag-app">Application</Label>
            <Select value={applicationId} onValueChange={setApplicationId}>
              <SelectTrigger id="ag-app">
                <SelectValue placeholder="Choose an application (optional)" />
              </SelectTrigger>
              <SelectContent>
                {applications.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {applicationId ? (
            <fieldset className="space-y-2">
              <legend className="text-[13px] font-medium text-(--color-text)">Scopes to request</legend>
              <p className="text-[12px] text-(--color-text-muted)">Ask only for what the agent needs. Low-risk scopes are selected to start with.</p>
              {loadingScopes ? (
                <p className="text-[12px] text-(--color-text-muted)">Loading scopes…</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {appScopes.map((s) => (
                    <label key={s.id} className="flex items-start gap-2 rounded-md border border-(--color-border-subtle) px-3 py-2">
                      <Checkbox checked={scopes.includes(s.scope_string)} onCheckedChange={(v) => toggleScope(s.scope_string, v === true)} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block font-mono text-[12px] text-(--color-text)">{s.scope_string}</span>
                        <span className="block text-[12px] text-(--color-text-muted)">
                          {s.display_name} · {s.risk_level} risk
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {step === 2 && registered ? (
        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold text-(--color-text)">Credentials</h3>
            <CredentialField label="Client ID" value={registered.clientId} />
            <CredentialField label="Client secret" value={registered.clientSecret} secret />
            <label className="flex items-center gap-2 text-[13px] text-(--color-text)">
              <Checkbox checked={savedSecret} onCheckedChange={(v) => setSavedSecret(v === true)} />
              I've stored the secret somewhere safe. It won't be shown again.
            </label>
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-semibold text-(--color-text)">What happens on first use</h3>
            <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-5 text-(--color-text)">
              <li>The person signs in, and the agent exchanges that sign-in for a token on {app?.name ?? "the application"}.</li>
              <li>
                The first request waits for an admin to approve the agent on the application's <span className="font-medium">Connections</span> tab. The SDK polls until it's approved.
              </li>
              <li>After that, each person consents once, and every call carries both the person and the agent.</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-semibold text-(--color-text)">Wire up the agent</h3>
            <CodeTabs
              snippets={snippetsFor("agent", { issuer: registered.issuer, clientId: registered.clientId, clientSecret: registered.clientSecret, mcpUrl: app?.resource_uri, scopes })}
              sdkDocs={IDENTITY_DOCS.agent.sdk}
              initial="env"
            />
          </section>
        </div>
      ) : null}
    </WizardShell>
  );
}
