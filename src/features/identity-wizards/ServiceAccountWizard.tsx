import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ExternalLink, FileKey2, KeyRound, Loader2, Server, XCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import config from "@/config";
import { useListApplicationsQuery } from "@/app/api/applicationsApi";
import { useListRSRolesQuery } from "@/app/api/setupWizardApi";
import { useListWorkloadProvidersQuery } from "@/app/api/workloadProvidersApi";
import { useCreateFederatedWorkloadMutation } from "@/app/api/appWorkloadsApi";
import {
  useCreateWorkspaceServiceAccountMutation,
  useGrantWorkloadAccessMutation,
  useProvisionWorkloadCredentialMutation,
  useSimulateTokenMutation,
  type SimulateTokenResponse,
  type WorkspaceServiceAccount,
} from "@/app/api/agentIdentityApi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WizardShell } from "./components/WizardShell";
import { CodeTabs } from "./components/CodeTabs";
import { AccessPicker, type AccessChoice } from "./components/AccessPicker";
import { CredentialField } from "./components/CredentialField";
import { IDENTITY_DOCS, type IdentityKind } from "./docs";
import { KEY_GEN, snippetsFor } from "./snippets";

type MachineKind = Exclude<IdentityKind, "agent">;

const STEPS = [
  { id: "type", label: "Type" },
  { id: "details", label: "Details" },
  { id: "access", label: "Access" },
  { id: "connect", label: "Connect" },
];

const KIND_CARDS: Array<{ kind: MachineKind; title: string; icon: typeof KeyRound; bestFor: string; tradeoff: string }> = [
  {
    kind: "client_secret",
    title: "Client secret",
    icon: KeyRound,
    bestFor: "Any server, job or script. The quickest way to get a machine calling an application.",
    tradeoff: "The secret is a long-lived password: store it in a secrets manager and rotate it.",
  },
  {
    kind: "private_key_jwt",
    title: "Private-key JWT",
    icon: FileKey2,
    bestFor: "Services that can hold a private key. Each token request is signed and expires in minutes.",
    tradeoff: "You host a public JWKS and manage the key pair; nothing reusable ever crosses the wire.",
  },
  {
    kind: "kubernetes",
    title: "Kubernetes (SPIFFE)",
    icon: Server,
    bestFor: "Pods in a cluster running SPIRE. The pod's identity is attested at runtime.",
    tradeoff: "No stored credential at all, but it needs SPIRE in the cluster and is granted per application.",
  },
];

const TITLES: Record<MachineKind, string> = {
  client_secret: "client secret",
  private_key_jwt: "private-key JWT",
  kubernetes: "Kubernetes workload",
};

interface Created {
  sa: WorkspaceServiceAccount;
  clientId?: string;
  clientSecret?: string;
  grantedRoleId?: string;
}

const isHttpsUrl = (v: string) => /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v.trim());
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isDnsLabel = (v: string) => /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(v.trim());

export function ServiceAccountWizard({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated?: (sa: WorkspaceServiceAccount) => void }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<MachineKind>("client_secret");
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerTeam, setOwnerTeam] = useState("");
  const [description, setDescription] = useState("");
  const [jwksUri, setJwksUri] = useState("");
  const [kid, setKid] = useState("key-1");
  const [providerId, setProviderId] = useState("");
  const [namespace, setNamespace] = useState("default");
  const [k8sAccount, setK8sAccount] = useState("");
  const [access, setAccess] = useState<AccessChoice>({ applicationId: "", roleId: "" });
  const [created, setCreated] = useState<Created | null>(null);
  const [savedSecret, setSavedSecret] = useState(false);
  const [test, setTest] = useState<SimulateTokenResponse | null>(null);

  const { data: providersData } = useListWorkloadProvidersQuery(undefined, { skip: !open });
  const spiffeProviders = (providersData?.items ?? []).filter((p) => p.kind === "spiffe" && p.status === "active");
  const provider = spiffeProviders.find((p) => p.id === providerId);
  const { data: applications = [] } = useListApplicationsQuery(undefined, { skip: !open });
  const { data: rolesData } = useListRSRolesQuery(access.applicationId, { skip: !access.applicationId });

  const [createSA, createState] = useCreateWorkspaceServiceAccountMutation();
  const [provision, provisionState] = useProvisionWorkloadCredentialMutation();
  const [grant, grantState] = useGrantWorkloadAccessMutation();
  const [federate, federateState] = useCreateFederatedWorkloadMutation();
  const [simulate, simulateState] = useSimulateTokenMutation();
  const creating = createState.isLoading || provisionState.isLoading || grantState.isLoading || federateState.isLoading;

  const trustDomain = provider?.trust_domain || "your-trust-domain";
  const spiffeId = `spiffe://${trustDomain}/ns/${namespace.trim() || "default"}/sa/${k8sAccount.trim() || "your-service-account"}`;
  const app = applications.find((a) => a.id === access.applicationId);
  const grantedRole = rolesData?.roles.find((r) => r.id === (created?.grantedRoleId ?? access.roleId));
  const accessRequired = kind === "kubernetes";

  const detailsError = useMemo(() => {
    if (!name.trim()) return "Give the service account a name.";
    if (!isEmail(ownerEmail)) return "Enter the accountable owner's email.";
    if (kind === "private_key_jwt" && !isHttpsUrl(jwksUri)) return "Enter an https:// URL for your JWKS.";
    if (kind === "kubernetes") {
      if (!provider) return "Choose a workload identity provider.";
      if (!isDnsLabel(namespace)) return "Enter the pod's Kubernetes namespace.";
      if (!isDnsLabel(k8sAccount)) return "Enter the pod's Kubernetes service account.";
    }
    return null;
  }, [name, ownerEmail, kind, jwksUri, provider, namespace, k8sAccount]);

  const accessError = accessRequired && (!access.applicationId || !access.roleId) ? "Kubernetes workloads are granted per application: choose one and a role." : access.applicationId && !access.roleId ? "Choose a role, or clear the application to skip." : null;

  const reset = () => {
    setStep(0);
    setKind("client_secret");
    setName("");
    setOwnerEmail("");
    setOwnerTeam("");
    setDescription("");
    setJwksUri("");
    setKid("key-1");
    setProviderId("");
    setNamespace("default");
    setK8sAccount("");
    setAccess({ applicationId: "", roleId: "" });
    setCreated(null);
    setSavedSecret(false);
    setTest(null);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (created?.clientSecret && !savedSecret) {
      toast.error("Copy the client secret and confirm you saved it — it won't be shown again.");
      return;
    }
    close();
  };

  const create = async () => {
    try {
      const sa = await createSA({
        name: name.trim(),
        owner_email: ownerEmail.trim(),
        ...(ownerTeam.trim() ? { owner_team: ownerTeam.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      }).unwrap();

      const result: Created = { sa };
      if (kind === "kubernetes") {
        const wl = await federate({
          rsId: access.applicationId,
          provider_id: providerId,
          external_spiffe_id: spiffeId,
          role_id: access.roleId,
          service_account_id: sa.id,
        }).unwrap();
        result.clientId = wl.client_id;
        result.grantedRoleId = access.roleId;
      } else {
        const cred = await provision(
          kind === "client_secret" ? { saId: sa.id, use_client_secret: true } : { saId: sa.id, jwks_uri: jwksUri.trim() },
        ).unwrap();
        result.clientId = cred.client_id;
        result.clientSecret = cred.client_secret;
        if (access.applicationId && access.roleId) {
          await grant({ rsId: access.applicationId, service_account_id: sa.id, role_id: access.roleId }).unwrap();
          result.grantedRoleId = access.roleId;
        }
      }
      setCreated(result);
      setStep(3);
      onCreated?.(sa);
      toast.success(`${sa.name} created.`);
    } catch (err) {
      const apiErr = err as { data?: { error?: string } };
      toast.error(apiErr?.data?.error ?? "Couldn't create the service account.");
    }
  };

  const runTest = async () => {
    if (!created?.grantedRoleId) return;
    try {
      setTest(await simulate({ rsId: access.applicationId, service_account_id: created.sa.id, role_id: created.grantedRoleId }).unwrap());
    } catch {
      toast.error("Couldn't run the token check.");
    }
  };

  const docs = IDENTITY_DOCS[kind];
  const snippets = snippetsFor(kind, {
    issuer: config.VITE_OAUTH_BASE_URL,
    clientId: created?.clientId,
    clientSecret: created?.clientSecret,
    mcpUrl: app?.resource_uri,
    scopes: grantedRole?.scopes ?? [],
    kid,
    spiffeId: kind === "kubernetes" ? spiffeId : undefined,
  });

  const footer = (() => {
    if (step === 3) {
      return (
        <Button className="text-[length:var(--text-sm)] text-white" disabled={Boolean(created?.clientSecret) && !savedSecret} onClick={close}>
          Done
        </Button>
      );
    }
    const next = step === 0 ? () => setStep(1) : step === 1 ? () => setStep(2) : () => void create();
    const blocked = step === 1 ? detailsError : step === 2 ? accessError : null;
    return (
      <>
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={creating}>
            Back
          </Button>
        ) : (
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
        )}
        {step === 2 && !accessRequired && !access.applicationId ? (
          <Button className="text-[length:var(--text-sm)] text-white" onClick={() => void create()} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : null}
            Create without access
          </Button>
        ) : (
          <Button className="text-[length:var(--text-sm)] text-white" onClick={next} disabled={Boolean(blocked) || creating} title={blocked ?? undefined}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : null}
            {step === 2 ? "Create service account" : "Next"}
          </Button>
        )}
      </>
    );
  })();

  return (
    <WizardShell
      open={open}
      onOpenChange={handleOpenChange}
      title={step === 3 ? `${created?.sa.name ?? "Service account"} is ready` : "Create service account"}
      description={
        step === 3
          ? "Configure your service with these values. Each tab links to its SDK reference."
          : "A service account is an identity for software. It calls your applications on its own, with no person signed in."
      }
      steps={STEPS}
      current={step}
      docsHref={docs.guide}
      docsLabel={`${TITLES[kind][0].toUpperCase()}${TITLES[kind].slice(1)} guide`}
      footer={footer}
    >
      {step === 0 ? (
        <div className="space-y-3" role="radiogroup" aria-label="How the service account proves its identity">
          <p className="text-[13px] text-(--color-text-muted)">How will this service prove who it is?</p>
          {KIND_CARDS.map((card) => {
            const Icon = card.icon;
            const selected = card.kind === kind;
            return (
              <button
                key={card.kind}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setKind(card.kind)}
                className={cn(
                  "flex w-full gap-3 rounded-lg border p-4 text-left transition-colors duration-150",
                  selected ? "border-(--color-primary) bg-(--color-primary-soft)" : "border-(--color-border-subtle) hover:border-(--color-border-strong)",
                )}
              >
                <Icon className={cn("mt-0.5 size-5 shrink-0", selected ? "text-(--color-primary)" : "text-(--color-text-muted)")} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-(--color-text)">{card.title}</span>
                    <a
                      href={IDENTITY_DOCS[card.kind].guide}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-(--color-primary) hover:underline"
                    >
                      Guide <ExternalLink className="size-3" />
                    </a>
                  </span>
                  <span className="mt-1 block text-[13px] leading-5 text-(--color-text)">{card.bestFor}</span>
                  <span className="mt-0.5 block text-[12px] leading-[18px] text-(--color-text-muted)">{card.tradeoff}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sa-name">Name</Label>
              <Input id="sa-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="billing-sync-worker" autoComplete="off" autoFocus />
              <p className="text-[12px] text-(--color-text-muted)">Shown in logs and audit trails. Name it after what the service does.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-owner">Owner email</Label>
              <Input id="sa-owner" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="priya@acme.com" autoComplete="off" />
              <p className="text-[12px] text-(--color-text-muted)">The person accountable for everything this service does.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-team">Team <span className="font-normal text-(--color-text-subtle)">(optional)</span></Label>
              <Input id="sa-team" value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} placeholder="Platform" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-desc">Description <span className="font-normal text-(--color-text-subtle)">(optional)</span></Label>
              <Input id="sa-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Syncs settled invoices every 30 minutes" autoComplete="off" />
            </div>
          </div>

          {kind === "private_key_jwt" ? (
            <div className="space-y-4 rounded-lg border border-(--color-border-subtle) p-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <div className="space-y-1.5">
                  <Label htmlFor="sa-jwks">JWKS URL</Label>
                  <Input id="sa-jwks" value={jwksUri} onChange={(e) => setJwksUri(e.target.value)} placeholder="https://acme.com/.well-known/jwks.json" className="font-mono text-[12px]" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sa-kid">Key ID</Label>
                  <Input id="sa-kid" value={kid} onChange={(e) => setKid(e.target.value)} className="font-mono text-[12px]" autoComplete="off" />
                </div>
              </div>
              <p className="flex gap-1.5 text-[12px] leading-[18px] text-(--color-text-muted)">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-(--color-warning)" />
                The URL must return raw JSON. A web page (for example a GitHub gist view) fails with "invalid character '&lt;'".
              </p>
              <details className="group">
                <summary className="cursor-pointer text-[13px] font-medium text-(--color-primary)">Don't have a key pair yet?</summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-(--color-surface-subtle) p-3 font-mono text-[12px] leading-[18px] text-(--color-text)">{KEY_GEN}</pre>
              </details>
            </div>
          ) : null}

          {kind === "kubernetes" ? (
            <div className="space-y-4 rounded-lg border border-(--color-border-subtle) p-4">
              {spiffeProviders.length === 0 ? (
                <p className="text-[13px] leading-5 text-(--color-text)">
                  This workspace doesn't trust a SPIRE server yet. Add one under{" "}
                  <Link to="/settings/trusted-issuers" className="font-medium text-(--color-primary) hover:underline">
                    Trusted issuers → Workload identity providers
                  </Link>
                  , then come back.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="sa-provider">Workload identity provider</Label>
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger id="sa-provider">
                      <SelectValue placeholder="Choose the SPIRE server that attests this pod" />
                    </SelectTrigger>
                    <SelectContent>
                      {spiffeProviders.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.trust_domain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sa-ns">Namespace</Label>
                  <Input id="sa-ns" value={namespace} onChange={(e) => setNamespace(e.target.value)} className="font-mono text-[12px]" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sa-k8s">Kubernetes service account</Label>
                  <Input id="sa-k8s" value={k8sAccount} onChange={(e) => setK8sAccount(e.target.value)} placeholder="billing-sync" className="font-mono text-[12px]" autoComplete="off" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[12px] text-(--color-text-muted)">The pod will present this SPIFFE ID:</p>
                <code className="block rounded-md bg-(--color-surface-subtle) px-3 py-2 font-mono text-[12px] break-all text-(--color-text)">{spiffeId}</code>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <AccessPicker
          value={access}
          onChange={setAccess}
          hint={
            accessRequired
              ? "Kubernetes workloads are trusted per application. Choose the application this pod calls and the role it acts with."
              : "Grant access now so the code on the next step works straight away, or create the account without access and grant it later from the application's Access tab."
          }
        />
      ) : null}

      {step === 3 && created ? (
        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold text-(--color-text)">Credentials</h3>
            {created.clientId ? <CredentialField label="Client ID" value={created.clientId} /> : null}
            {created.clientSecret ? (
              <>
                <CredentialField label="Client secret" value={created.clientSecret} secret />
                <label className="flex items-center gap-2 text-[13px] text-(--color-text)">
                  <Checkbox checked={savedSecret} onCheckedChange={(v) => setSavedSecret(v === true)} />
                  I've stored the secret somewhere safe. It won't be shown again.
                </label>
              </>
            ) : null}
            {kind === "private_key_jwt" ? (
              <p className="text-[12px] text-(--color-text-muted)">No secret: your service signs each token request with the private key behind <span className="font-mono">{jwksUri}</span>.</p>
            ) : null}
            {kind === "kubernetes" ? (
              <p className="text-[12px] text-(--color-text-muted)">No stored credential: SPIRE issues the pod a short-lived JWT-SVID for <span className="font-mono">{spiffeId}</span>.</p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-semibold text-(--color-text)">Access</h3>
            {created.grantedRoleId && app ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--color-border-subtle) px-4 py-3">
                <p className="text-[13px] text-(--color-text)">
                  Can call <span className="font-semibold">{app.name}</span> as <span className="font-semibold">{grantedRole?.name}</span>
                </p>
                <Button variant="outline" size="sm" onClick={() => void runTest()} disabled={simulateState.isLoading}>
                  {simulateState.isLoading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Check a token would be issued
                </Button>
              </div>
            ) : (
              <p className="text-[13px] text-(--color-text-muted)">No access yet. Grant a role from an application's Access tab before the service can get a token.</p>
            )}
            {test ? (
              <ul className="space-y-1 rounded-lg bg-(--color-surface-subtle) px-4 py-3">
                {test.checks.map((c) => (
                  <li key={c.name} className="flex items-start gap-2 text-[12px]">
                    {c.status === "pass" ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-(--color-success)" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-(--color-danger)" />}
                    <span className="text-(--color-text)">
                      {c.name}
                      {c.reason ? <span className="text-(--color-text-muted)"> — {c.reason}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-semibold text-(--color-text)">Configure your service</h3>
            <CodeTabs snippets={snippets} sdkDocs={docs.sdk} initial={kind === "kubernetes" ? "spire" : "env"} />
          </section>
        </div>
      ) : null}
    </WizardShell>
  );
}
