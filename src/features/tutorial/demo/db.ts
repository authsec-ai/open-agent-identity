import type { AdminUser } from "@/app/api/admin/usersApi";
import type { ResourceServer } from "@/app/api/resourceServersApi";
import type { WorkspaceClientItem } from "@/app/api/mcpClientsApi";
import type { WorkspaceServiceAccount } from "@/app/api/agentIdentityApi";
import type { IdentityProvider } from "@/app/api/authMethodApi";
import type { ScimConnection } from "@/app/api/scimConnectionsApi";
import type { SyncConfig } from "@/app/api/syncConfigsApi";
import type { RawExternalService } from "@/app/api/externalServiceApi";
import type { Permission } from "@/app/api/permissionsApi";
import type { TrustedIssuer } from "@/app/api/trustedIssuersApi";
import type { WorkloadIdentityProvider } from "@/app/api/workloadProvidersApi";
import type { CustomDomain } from "@/app/api/domainApi";
import type { DelegationPolicyRecord } from "@/app/api/trustDelegationApi";
import {
  APPS,
  END_USERS,
  ADMINS,
  CLIENTS,
  SERVICE_ACCOUNTS,
  USER_GRANTS,
  SA_GRANTS,
  DEMO_DOMAIN,
  TOOLS,
  type ToolDef,
} from "./seedData";
import { buildActivity } from "./activity";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface DemoTool {
  id: string;
  application_id: string;
  name: string;
  title: string;
  description: string;
  /** Admin-applied mappings: the ones the gate enforces. */
  scope_ids: string[];
  /** SDK suggestions not yet applied (scope strings). */
  suggested: string[];
  is_public: boolean;
  inventory_source: "sdk_manifest" | "mcp_scan" | "manual";
  created_at: string;
}

export interface DemoConsent {
  id: string;
  user_id: string;
  client_id: string;
  client_name: string;
  resource_server_id: string;
  resource_name: string;
  granted_scopes: string[];
  expires_at: string;
  revoked_at?: string;
  created_at: string;
}

export interface DemoDrift {
  id: string;
  rs_id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  occurred_at: string;
  occurred_by: string;
}

export interface DemoAccessRequest {
  request_id: string;
  application_id: string;
  request_type: string;
  status: "pending" | "approved" | "denied";
  requester_client_id: string;
  requester_name: string;
  acting_user?: { id: string; email: string; name?: string };
  source_workspace?: string;
  requested_scopes: string[];
  created_at: string;
  expires_at?: string;
}

export interface DemoScope {
  id: string;
  application_id: string;
  scope_string: string;
  display_name: string;
  description: string;
  risk_level: RiskLevel;
  created_at: string;
}

export interface DemoRole {
  id: string;
  application_id: string;
  name: string;
  label: string;
  description: string;
  is_default: boolean;
  scope_ids: string[];
  source: string;
  updated_at: string;
}

export interface DemoAssignment {
  id: string;
  application_id: string;
  identity_type: "user" | "service_account";
  identity_id: string;
  role_id: string;
  status: string;
  source: string;
  created_at: string;
}

export interface DemoEndUser {
  id: string;
  email: string;
  name: string;
  username: string;
  active: boolean;
  status: "active" | "suspended";
  suspended_reason?: string;
  provider: string;
  mfa_enabled: boolean;
  mfa_method: string[];
  plan_tier: string;
  created_at: string;
  first_consent_at: string;
  last_login: string | null;
}

export interface AuthLogRow {
  id: number;
  timestamp: string;
  requestId: string;
  workspaceId: string;
  actorRealm: string;
  userId: string;
  action: string;
  status: "success" | "failure";
  ipAddress: string;
  userAgent: string;
  error?: string;
}

export interface AuditLogRow {
  id: number;
  timestamp: string;
  requestId: string;
  workspaceId: string;
  actorRealm: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  method: string;
  path: string;
  statusCode: number;
  status: "success" | "failure";
  ipAddress: string;
  userAgent: string;
  error?: string;
}

export interface M2MLogRow {
  id: string;
  createdAt: string;
  workspaceId: string;
  tokenFamily: string;
  clientId: string;
  subjectType: string;
  subjectId?: string;
  resourceServerId: string;
  pdpEffect: "permit" | "deny" | "no_policy";
  gateEffect: "permit" | "deny";
  pdpAgrees: boolean;
  scopesRequested: string;
  scopesGranted: string;
  pdpReason?: string;
}

export interface DemoDb {
  workspaceId: string;
  now: number;
  /** The signed-in operator; demo actions are recorded in the audit log as them. */
  actorEmail: string;
  nextSeq: number;
  admins: AdminUser[];
  endUsers: DemoEndUser[];
  applications: ResourceServer[];
  scopes: DemoScope[];
  roles: DemoRole[];
  assignments: DemoAssignment[];
  clients: WorkspaceClientItem[];
  serviceAccounts: WorkspaceServiceAccount[];
  identityProviders: IdentityProvider[];
  scimConnections: ScimConnection[];
  syncConfigs: SyncConfig[];
  externalServices: RawExternalService[];
  permissions: Permission[];
  trustedIssuers: TrustedIssuer[];
  workloadProviders: WorkloadIdentityProvider[];
  tools: DemoTool[];
  domains: CustomDomain[];
  delegationPolicies: DelegationPolicyRecord[];
  consents: DemoConsent[];
  drift: DemoDrift[];
  requests: DemoAccessRequest[];
  authLogs: AuthLogRow[];
  auditLogs: AuditLogRow[];
  m2mLogs: M2MLogRow[];
}

/** Stable, UUID-shaped ids so links, breadcrumbs and caches treat demo rows like real ones. */
export function demoId(kind: number, n: number): string {
  const k = kind.toString(16).padStart(2, "0");
  const num = n.toString(16).padStart(4, "0");
  return `de${k}${num}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

export const KIND = {
  admin: 1,
  endUser: 2,
  app: 3,
  scope: 4,
  role: 5,
  assignment: 6,
  client: 7,
  serviceAccount: 8,
  idp: 9,
  scim: 10,
  sync: 11,
  externalService: 12,
  permission: 13,
  tool: 14,
  consent: 15,
  drift: 16,
  request: 17,
  domain: 18,
  delegation: 19,
  created: 0xf0,
} as const;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function createSeed({ workspaceId, actorEmail, now }: { workspaceId: string; actorEmail: string; now: number }): DemoDb {
  const at = (msAgo: number) => new Date(now - msAgo).toISOString();

  const admins: AdminUser[] = ADMINS.map((a, i) => ({
    id: demoId(KIND.admin, i + 1),
    email: `${a.handle}@${DEMO_DOMAIN}`,
    username: a.handle,
    name: a.name,
    first_name: a.name.split(" ")[0],
    last_name: a.name.split(" ").slice(1).join(" "),
    active: a.status !== "inactive",
    status: a.status,
    roles: [a.role],
    groups: [],
    created_at: at(a.joinedDaysAgo * DAY),
    updated_at: at(Math.min(a.joinedDaysAgo, 3) * DAY),
    last_login: a.lastLoginHoursAgo === null ? undefined : at(a.lastLoginHoursAgo * HOUR),
    mfa_enabled: a.mfa,
    mfa_method: a.mfa ? ["webauthn"] : null,
    mfa_default_method: a.mfa ? "webauthn" : undefined,
    mfa_verified: a.mfa,
    workspace_id: workspaceId,
    provider: a.provider,
    provider_name: a.provider === "okta" ? "Okta" : "Password",
    is_synced_user: a.provider === "okta",
    is_synced: a.provider === "okta",
    accepted_invite: a.status !== "invited",
  }));

  const endUsers: DemoEndUser[] = END_USERS.map((u, i) => ({
    id: demoId(KIND.endUser, i + 1),
    email: `${u.handle}@${u.domain ?? DEMO_DOMAIN}`,
    name: u.name,
    username: u.handle,
    active: u.status === "active",
    status: u.status,
    suspended_reason: u.suspendedReason,
    provider: u.provider,
    mfa_enabled: u.mfa,
    mfa_method: u.mfa ? ["totp"] : [],
    plan_tier: u.plan,
    created_at: at(u.joinedDaysAgo * DAY),
    first_consent_at: at((u.joinedDaysAgo - 1) * DAY),
    last_login: u.lastSeenHoursAgo === null ? null : at(u.lastSeenHoursAgo * HOUR),
  }));

  const scopes: DemoScope[] = [];
  const roles: DemoRole[] = [];
  const applications: ResourceServer[] = [];
  let scopeN = 0;
  let roleN = 0;

  APPS.forEach((app, ai) => {
    const appId = demoId(KIND.app, ai + 1);
    const scopeIdByKey = new Map<string, string>();
    app.scopes.forEach((s) => {
      scopeN += 1;
      const id = demoId(KIND.scope, scopeN);
      scopeIdByKey.set(s.key, id);
      scopes.push({
        id,
        application_id: appId,
        scope_string: s.key,
        display_name: s.label,
        description: s.description,
        risk_level: s.risk,
        created_at: at(app.createdDaysAgo * DAY),
      });
    });
    app.roles.forEach((r) => {
      roleN += 1;
      roles.push({
        id: demoId(KIND.role, roleN),
        application_id: appId,
        name: r.name,
        label: r.label,
        description: r.description,
        is_default: r.isDefault,
        scope_ids: r.scopes.map((k) => scopeIdByKey.get(k)!).filter(Boolean),
        source: "custom",
        updated_at: at(Math.max(1, app.createdDaysAgo - 5) * DAY),
      });
    });
    const defaultRole = app.roles.find((r) => r.isDefault);
    applications.push({
      id: appId,
      workspace_id: workspaceId,
      name: app.name,
      public_base_url: app.url,
      protected_base_path: app.path,
      resource_uri: `${app.url}${app.path}`,
      scopes_supported: app.scopes.map((s) => s.key),
      registration_modes: ["dcr", "prereg"],
      active: app.state === "ready",
      access_policy_enabled: Boolean(defaultRole),
      access_policy_role_name: defaultRole?.name,
      default_role_name: defaultRole?.name,
      last_scan_status: app.state === "scan_failed" ? "failed" : "succeeded",
      last_scan_error: app.scanError,
      scan_generation: app.state === "pending_scan" ? 0 : 4,
      last_successful_generation: app.state === "scan_failed" ? 2 : 4,
      last_scan_started_at: at(app.lastScanHoursAgo * HOUR + 40_000),
      last_scan_completed_at: at(app.lastScanHoursAgo * HOUR),
      last_validated_at: app.state === "ready" ? at(app.lastScanHoursAgo * HOUR) : undefined,
      last_validation_status: app.state === "ready" ? "passed" : app.state === "scan_failed" ? "failed" : undefined,
      tools_count: 0,
      scopes_count: app.scopes.length,
      roles_count: app.roles.length,
      state: app.state,
      setup_completed_at: app.state === "ready" ? at((app.createdDaysAgo - 2) * DAY) : undefined,
      latest_access_issue: app.accessIssue,
      created_at: at(app.createdDaysAgo * DAY),
      updated_at: at(app.lastScanHoursAgo * HOUR),
    });
  });

  const appIdByKey = new Map(APPS.map((a, i) => [a.key, demoId(KIND.app, i + 1)]));
  const roleId = (appKey: string, roleName: string) => {
    const appId = appIdByKey.get(appKey);
    return roles.find((r) => r.application_id === appId && r.name === roleName)?.id ?? "";
  };

  const assignments: DemoAssignment[] = [];
  let assignN = 0;
  USER_GRANTS.forEach(([userIdx, appKey, roleName, daysAgo]) => {
    assignN += 1;
    assignments.push({
      id: demoId(KIND.assignment, assignN),
      application_id: appIdByKey.get(appKey)!,
      identity_type: "user",
      identity_id: endUsers[userIdx].id,
      role_id: roleId(appKey, roleName),
      status: "active",
      source: daysAgo > 30 ? "default_access" : "manual",
      created_at: at(daysAgo * DAY),
    });
  });

  const serviceAccounts: WorkspaceServiceAccount[] = SERVICE_ACCOUNTS.map((sa, i) => ({
    id: demoId(KIND.serviceAccount, i + 1),
    workspace_id: workspaceId,
    name: sa.name,
    description: sa.description,
    status: sa.status,
    oauth_client_id: sa.clientId,
    spiffe_id: sa.spiffe,
    owner_email: `${sa.owner}@${DEMO_DOMAIN}`,
    owner_team: sa.team,
    last_seen_at: sa.lastSeenHoursAgo === null ? undefined : at(sa.lastSeenHoursAgo * HOUR),
    created_at: at(sa.createdDaysAgo * DAY),
    updated_at: at(Math.min(sa.createdDaysAgo, 10) * DAY),
  }));

  SA_GRANTS.forEach(([saIdx, appKey, roleName, daysAgo]) => {
    assignN += 1;
    assignments.push({
      id: demoId(KIND.assignment, assignN),
      application_id: appIdByKey.get(appKey)!,
      identity_type: "service_account",
      identity_id: serviceAccounts[saIdx].id,
      role_id: roleId(appKey, roleName),
      status: "active",
      source: "manual",
      created_at: at(daysAgo * DAY),
    });
  });

  const clients: WorkspaceClientItem[] = CLIENTS.map((c, i) => {
    const appId = appIdByKey.get(c.app)!;
    return {
      id: demoId(KIND.client, i + 1),
      client_id: c.clientId,
      client_name: c.name,
      client_kind: c.kind,
      registration_type: c.registration,
      software_id: c.software,
      software_version: c.version,
      status: c.status,
      sync_status: "active",
      resource_server_id: appId,
      resource_server_name: APPS.find((a) => a.key === c.app)!.name,
      redirect_uris: c.kind === "human_app" || c.kind === "cli" ? [c.redirect ?? "http://127.0.0.1:33418/callback"] : [],
      tags: c.tags,
      last_token_issued_at: c.lastTokenMinutesAgo === null ? undefined : at(c.lastTokenMinutesAgo * 60_000),
      adopted_elsewhere: Boolean(c.foreign),
      created_at: at(c.createdDaysAgo * DAY),
    };
  });

  const identityProviders: IdentityProvider[] = [
    { name: "Okta Workforce", type: "oidc", status: "configured", days: 140 },
    { name: "Azure AD (Contractors)", type: "saml", status: "configured", days: 96 },
    { name: "Google Workspace", type: "oidc", status: "disabled", days: 31 },
  ].map((p, i) => ({
    id: demoId(KIND.idp, i + 1),
    workspace_id: workspaceId,
    provider_type: p.type as IdentityProvider["provider_type"],
    display_name: p.name,
    config_ref: `${p.type}-config-${i + 1}`,
    status: p.status as IdentityProvider["status"],
    redirect_uri: `https://northwind.authsec.example/oidc/auth/callback`,
    created_by_user_id: admins[0].id,
    created_at: at(p.days * DAY),
    updated_at: at(Math.min(p.days, 12) * DAY),
  }));

  const scimConnections: ScimConnection[] = [
    {
      id: demoId(KIND.scim, 1),
      workspace_id: workspaceId,
      identity_provider_id: identityProviders[0].id,
      status: "active",
      created_at: at(120 * DAY),
    },
  ];

  const syncConfigs: SyncConfig[] = [
    {
      id: demoId(KIND.sync, 1),
      workspace_id: workspaceId,
      sync_type: "entra_id",
      config_name: "Contractors directory (Entra ID)",
      description: "Nightly import of contractor accounts from the partner tenant",
      is_active: true,
      entra_tenant_id: "5f1c2b7e-demo-4a51-9e0d-northwind00",
      entra_client_id: "b8c0e4a2-demo-4c3f-8d2a-sync000000001",
      created_at: at(90 * DAY),
      updated_at: at(9 * DAY),
      last_sync_at: at(7 * HOUR),
      last_sync_status: "success",
      last_sync_users_count: 6,
    },
  ];

  const externalServices: RawExternalService[] = [
    { name: "Stripe", type: "API", url: "https://api.stripe.com", auth: "bearer_token", tags: ["payments"], agent: true, desc: "Card processing used by the Finance Reconciler agent" },
    { name: "Slack", type: "API", url: "https://slack.com/api", auth: "oauth2", tags: ["notifications"], agent: true, desc: "Posts incident and approval notifications to #ops" },
    { name: "Snowflake", type: "Database", url: "https://northwind.snowflakecomputing.com", auth: "basic_auth", tags: ["analytics"], agent: false, desc: "Warehouse loaded by the nightly ETL job" },
  ].map((s, i) => ({
    id: demoId(KIND.externalService, i + 1),
    name: s.name,
    type: s.type,
    url: s.url,
    description: s.desc,
    tags: s.tags,
    resource_id: i + 1,
    auth_type: s.auth,
    vault_path: `secret/data/northwind/${s.name.toLowerCase()}`,
    created_by: admins[0].email,
    agent_accessible: s.agent,
    created_at: at((60 - i * 12) * DAY),
    updated_at: at((10 - i * 3) * DAY),
  }));

  const permissions: Permission[] = [
    ["users", "read", "View users and their access"],
    ["users", "write", "Invite, edit and deactivate users"],
    ["applications", "read", "View applications and their configuration"],
    ["applications", "write", "Register and configure applications"],
    ["roles", "write", "Create roles and change their scopes"],
    ["clients", "approve", "Approve or revoke agent and app connections"],
    ["logs", "read", "Read authentication, audit and M2M logs"],
    ["settings", "write", "Change workspace settings and identity providers"],
  ].map(([resource, action, description], i) => ({
    id: demoId(KIND.permission, i + 1),
    resource,
    action,
    description,
    full_permission_string: `${resource}:${action}`,
    roles_assigned: [3, 2, 3, 2, 2, 2, 4, 1][i],
  }));

  const trustedIssuers: TrustedIssuer[] = [
    {
      id: demoId(KIND.idp, 101),
      iss: "https://brightpath-consulting.okta.example",
      jwks_uri: "https://brightpath-consulting.okta.example/oauth2/v1/keys",
      provider_name: "BrightPath Consulting (partner Okta)",
      allowed_algs: ["RS256"],
      allowed_auds: ["https://northwind.authsec.example"],
      clock_skew_secs: 60,
      subject_mapping: "email",
      jit_provisioning: false,
      status: "active",
      created_at: at(41 * DAY),
      updated_at: at(41 * DAY),
    },
    {
      id: demoId(KIND.idp, 102),
      iss: "https://login.acme-retail.example",
      jwks_uri: "https://login.acme-retail.example/.well-known/jwks.json",
      provider_name: "Acme Retail (pilot customer)",
      allowed_algs: ["RS256", "ES256"],
      allowed_auds: ["https://northwind.authsec.example"],
      clock_skew_secs: 30,
      jit_provisioning: true,
      status: "revoked",
      revoked_at: at(6 * DAY),
      created_at: at(70 * DAY),
      updated_at: at(6 * DAY),
    },
  ];

  const workloadProviders: WorkloadIdentityProvider[] = [
    {
      id: demoId(KIND.idp, 201),
      workspace_id: workspaceId,
      name: "Production Kubernetes (SPIRE)",
      kind: "spiffe",
      issuer: "https://spire.northwind.example",
      trust_domain: "northwind.example",
      allowed_audiences: ["https://northwind.authsec.example"],
      subject_claim: "sub",
      status: "active",
      created_at: at(88 * DAY),
      updated_at: at(20 * DAY),
    },
    {
      id: demoId(KIND.idp, 202),
      workspace_id: workspaceId,
      name: "GitHub Actions",
      kind: "oidc",
      issuer: "https://token.actions.githubusercontent.com",
      jwks_uri: "https://token.actions.githubusercontent.com/.well-known/jwks",
      allowed_audiences: ["https://northwind.authsec.example"],
      subject_claim: "sub",
      status: "active",
      created_at: at(110 * DAY),
      updated_at: at(30 * DAY),
    },
  ];

  const tools: DemoTool[] = [];
  let toolN = 0;
  for (const app of APPS) {
    const appId = appIdByKey.get(app.key)!;
    for (const def of TOOLS[app.key] ?? []) {
      toolN += 1;
      tools.push(toolFromDef(scopes, appId, def, demoId(KIND.tool, toolN), at((def.addedDaysAgo ?? app.createdDaysAgo - 1) * DAY)));
    }
  }

  // A user who holds a role on an application has consented to the client they use with it.
  const consentClient: Record<string, string> = {
    github: "Claude Desktop",
    crm: "Claude Desktop",
    payments: "Cursor",
    kb: "VS Code Copilot Chat",
    jira: "Claude Desktop",
  };
  const consents: DemoConsent[] = [];
  let consentN = 0;
  for (const [userIdx, appKey, roleName, daysAgo] of USER_GRANTS) {
    const user = endUsers[userIdx];
    const appId = appIdByKey.get(appKey)!;
    const client = clients.find((c) => c.client_name === consentClient[appKey])!;
    const role = roles.find((r) => r.application_id === appId && r.name === roleName)!;
    consentN += 1;
    consents.push({
      id: demoId(KIND.consent, consentN),
      user_id: user.id,
      client_id: client.client_id,
      client_name: client.client_name,
      resource_server_id: appId,
      resource_name: APPS.find((a) => a.key === appKey)!.name,
      granted_scopes: role.scope_ids.map((id) => scopes.find((s) => s.id === id)!.scope_string),
      expires_at: new Date(now + (90 - Math.min(daysAgo, 80)) * DAY).toISOString(),
      revoked_at: user.status === "suspended" ? at(5 * DAY) : undefined,
      created_at: at(Math.max(daysAgo - 1, 0.5) * DAY),
    });
  }

  const github = appIdByKey.get("github")!;
  const payments = appIdByKey.get("payments")!;
  const crm = appIdByKey.get("crm")!;
  const drift: DemoDrift[] = [
    {
      id: demoId(KIND.drift, 1),
      rs_id: github,
      event_type: "tool_added",
      event_payload: { tool: "delete_repository", suggested_scope: "admin:org", note: "New tool is denied until an admin maps it" },
      occurred_at: at(1 * DAY),
      occurred_by: "sdk_manifest",
    },
    {
      id: demoId(KIND.drift, 2),
      rs_id: payments,
      event_type: "scope_risk_changed",
      event_payload: { scope: "refunds:issue", from: "medium", to: "high" },
      occurred_at: at(3 * DAY),
      occurred_by: "priya.raman@northwind.example",
    },
  ];

  const byClientName = (name: string) => clients.find((c) => c.client_name === name)!;
  const requests: DemoAccessRequest[] = [
    {
      request_id: demoId(KIND.request, 1),
      application_id: payments,
      request_type: "role_request",
      status: "pending",
      requester_client_id: byClientName("Release Bot").client_id,
      requester_name: "Release Bot",
      requested_scopes: ["ledger:read", "payouts:approve"],
      created_at: at(20 * HOUR),
      expires_at: new Date(now + 6 * DAY).toISOString(),
    },
    {
      request_id: demoId(KIND.request, 2),
      application_id: crm,
      request_type: "cross_app",
      status: "pending",
      requester_client_id: byClientName("Sales Research Agent").client_id,
      requester_name: "Sales Research Agent",
      acting_user: { id: endUsers[16].id, email: endUsers[16].email, name: endUsers[16].name },
      source_workspace: "brightpath-consulting",
      requested_scopes: ["customers:read"],
      created_at: at(22 * HOUR),
      expires_at: new Date(now + 6 * DAY).toISOString(),
    },
  ];

  const domains: CustomDomain[] = [
    { domain: "northwind.authsec.example", kind: "platform", primary: false, verified: true, days: 140 },
    { domain: "login.northwind.example", kind: "custom", primary: true, verified: true, days: 60 },
    { domain: "auth.northwind-labs.example", kind: "custom", primary: false, verified: false, days: 1 },
  ].map((d, i) => ({
    id: demoId(KIND.domain, i + 1),
    workspace_id: workspaceId,
    domain: d.domain,
    kind: d.kind as CustomDomain["kind"],
    is_primary: d.primary,
    is_verified: d.verified,
    verification_method: "dns_txt",
    verification_token: `authsec-verify-${(i + 1) * 7391}`,
    verification_txt_name: `_authsec-challenge.${d.domain}`,
    verification_txt_value: `authsec-verify-${(i + 1) * 7391}`,
    verified_at: d.verified ? at((d.days - 1) * DAY) : null,
    created_at: at(d.days * DAY),
    updated_at: at(Math.min(d.days, 10) * DAY),
  }));

  const delegationPolicies: DelegationPolicyRecord[] = [
    { role_name: "release-manager", agent: "mcp-agent", perms: ["repo:read", "pull_requests:write"], ttl: 3600, enabled: true, client: "Release Bot" },
    { role_name: "support-agent", agent: "mcp-agent", perms: ["customers:read"], ttl: 900, enabled: true, client: "Support Copilot" },
    { role_name: "billing-operator", agent: "autonomous-workload", perms: ["ledger:read", "invoices:create"], ttl: 1800, enabled: true, client: "Finance Reconciler" },
    { role_name: "data-steward", agent: "user-service-account", perms: ["customers:export"], ttl: 600, enabled: false, client: "Nightly ETL" },
  ].map((p, i) => {
    const client = clients.find((c) => c.client_name === p.client)!;
    return {
      id: demoId(KIND.delegation, i + 1),
      workspace_id: workspaceId,
      role_name: p.role_name,
      agent_type: p.agent,
      allowed_permissions: p.perms,
      max_ttl_seconds: p.ttl,
      enabled: p.enabled,
      client_id: client.client_id,
      client_label: client.client_name,
      created_by: admins[0].email,
    };
  });

  const db: DemoDb = {
    domains,
    delegationPolicies,
    tools,
    consents,
    drift,
    requests,
    trustedIssuers,
    workloadProviders,
    workspaceId,
    now,
    actorEmail,
    nextSeq: 1,
    admins,
    endUsers,
    applications,
    scopes,
    roles,
    assignments,
    clients,
    serviceAccounts,
    identityProviders,
    scimConnections,
    syncConfigs,
    externalServices,
    permissions,
    authLogs: [],
    auditLogs: [],
    m2mLogs: [],
  };
  buildActivity(db);
  refreshCounts(db);
  return db;
}

/** Keeps the derived counters on applications in step with roles, scopes and assignments. */
export function refreshCounts(db: DemoDb): void {
  for (const app of db.applications) {
    const appRoles = db.roles.filter((r) => r.application_id === app.id);
    const appAssignments = db.assignments.filter((a) => a.application_id === app.id && a.status === "active");
    app.roles_count = appRoles.length;
    app.scopes_count = db.scopes.filter((s) => s.application_id === app.id).length;
    app.tools_count = db.tools.filter((t) => t.application_id === app.id).length;
    app.scopes_supported = db.scopes.filter((s) => s.application_id === app.id).map((s) => s.scope_string);
    app.bindings_count = appAssignments.length;
    app.end_users_count = new Set(appAssignments.filter((a) => a.identity_type === "user").map((a) => a.identity_id)).size;
    app.client_count = db.clients.filter((c) => c.resource_server_id === app.id && c.status !== "revoked").length;
  }
}

export function toolFromDef(scopes: DemoScope[], appId: string, def: ToolDef, id: string, createdAt: string): DemoTool {
  const scopeId = (key: string) => scopes.find((s) => s.application_id === appId && s.scope_string === key)?.id;
  return {
    id,
    application_id: appId,
    name: def.name,
    title: def.title,
    description: def.description,
    scope_ids: def.scopes.map(scopeId).filter((x): x is string => Boolean(x)),
    suggested: def.suggested ?? [],
    is_public: Boolean(def.public),
    inventory_source: def.source ?? "sdk_manifest",
    created_at: createdAt,
  };
}

/** A fresh id for a record created during the tutorial session. */
export function newId(db: DemoDb): string {
  const id = demoId(KIND.created, db.nextSeq);
  db.nextSeq += 1;
  return id;
}

/** Records a demo action in the audit log, as the real backend does for every change. */
export function recordAudit(
  db: DemoDb,
  entry: { action: string; resource: string; resourceId: string; method: string; path: string; status?: "success" | "failure"; error?: string },
): void {
  const nextId = (db.auditLogs[0]?.id ?? 0) + 1;
  db.auditLogs.unshift({
    id: nextId,
    timestamp: new Date().toISOString(),
    requestId: `req-demo-${nextId}`,
    workspaceId: db.workspaceId,
    actorRealm: "admin",
    userId: db.actorEmail,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    method: entry.method,
    path: entry.path,
    statusCode: entry.status === "failure" ? 403 : 200,
    status: entry.status ?? "success",
    ipAddress: "203.0.113.24",
    userAgent: "AuthSec Console (tutorial)",
    error: entry.error,
  });
}
