import { badRequest, created, demoRoute, notFound, ok } from "../router";
import { newId, recordAudit, refreshCounts, type DemoDb } from "../db";

const nowIso = () => new Date().toISOString();

// ── Service accounts (workload identities) ──────────────────────────────
demoRoute("GET", "/authsec/uflow/admin/service-accounts", ({ db }) => ok(db.serviceAccounts));

demoRoute("POST", "/authsec/uflow/admin/service-accounts", ({ db, body, path }) => {
  const name = String(body.name ?? "").trim();
  if (!name) return badRequest("name is required");
  if (db.serviceAccounts.some((s) => s.name === name)) return badRequest(`A service account named ${name} already exists`);
  const sa = {
    id: newId(db),
    workspace_id: db.workspaceId,
    name,
    description: String(body.description ?? ""),
    status: "active",
    owner_email: String(body.owner_email ?? db.actorEmail),
    owner_team: body.owner_team ? String(body.owner_team) : undefined,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.serviceAccounts.unshift(sa);
  recordAudit(db, { action: "service_account.create", resource: "service_account", resourceId: sa.id, method: "POST", path });
  return created(sa);
});

demoRoute("PUT", "/authsec/uflow/admin/service-accounts/:saId", ({ db, params, body, path }) => {
  const sa = db.serviceAccounts.find((s) => s.id === params.saId);
  if (!sa) return notFound("Service account");
  if (typeof body.name === "string") sa.name = body.name;
  if (typeof body.description === "string") sa.description = body.description;
  sa.updated_at = nowIso();
  recordAudit(db, { action: "service_account.update", resource: "service_account", resourceId: sa.id, method: "PUT", path });
  return ok(sa);
});

demoRoute("DELETE", "/authsec/uflow/admin/service-accounts/:saId", ({ db, params, path }) => {
  if (!db.serviceAccounts.some((s) => s.id === params.saId)) return notFound("Service account");
  db.serviceAccounts = db.serviceAccounts.filter((s) => s.id !== params.saId);
  db.assignments = db.assignments.filter((a) => a.identity_id !== params.saId);
  refreshCounts(db);
  recordAudit(db, { action: "service_account.delete", resource: "service_account", resourceId: params.saId, method: "DELETE", path });
  return ok({ message: "Service account deleted", id: params.saId });
});

demoRoute("GET", "/authsec/uflow/admin/service-accounts/:saId/access", ({ db, params }) => {
  const sa = db.serviceAccounts.find((s) => s.id === params.saId);
  if (!sa) return notFound("Service account");
  const items = db.assignments
    .filter((a) => a.identity_id === sa.id && a.status === "active")
    .map((a) => {
      const app = db.applications.find((x) => x.id === a.application_id)!;
      const role = db.roles.find((r) => r.id === a.role_id)!;
      return {
        resource_server_id: app.id,
        resource_server_name: app.name,
        resource_uri: app.resource_uri,
        role_id: role.id,
        role_name: role.name,
        effective_scopes: role.scope_ids.map((id) => db.scopes.find((s) => s.id === id)?.scope_string ?? "").filter(Boolean),
      };
    });
  return ok({ service_account_id: sa.id, service_account_name: sa.name, items });
});

demoRoute("POST", "/authsec/uflow/admin/service-accounts/:saId/credentials", ({ db, params, body, path }) => {
  const sa = db.serviceAccounts.find((s) => s.id === params.saId);
  if (!sa) return notFound("Service account");
  sa.oauth_client_id = sa.oauth_client_id ?? `nw-sa-${sa.name}-${db.nextSeq.toString(16)}`;
  const secret = body.use_client_secret !== false && !body.jwks && !body.jwks_uri;
  recordAudit(db, { action: "service_account.credential_create", resource: "service_account", resourceId: sa.id, method: "POST", path });
  return created({
    client_id: sa.oauth_client_id,
    auth_method: secret ? "client_secret_basic" : "private_key_jwt",
    client_secret: secret ? "demo_sa_secret_shown_once_Qm81" : undefined,
  });
});

demoRoute("POST", "/authsec/uflow/admin/service-accounts/:saId/credentials/rotate", ({ db, params, path }) => {
  const sa = db.serviceAccounts.find((s) => s.id === params.saId);
  if (!sa?.oauth_client_id) return notFound("Credential");
  recordAudit(db, { action: "service_account.credential_rotate", resource: "service_account", resourceId: sa.id, method: "POST", path });
  return ok({ client_id: sa.oauth_client_id, token_endpoint_auth_method: "client_secret_basic", client_secret: "demo_rotated_secret_Zt47" });
});

// ── Console roles and permissions (who can administer the workspace) ────
const CONSOLE_ROLES = [
  { name: "owner", description: "Full control of the workspace, including billing and deletion", permissions: 8 },
  { name: "admin", description: "Manages applications, users, roles and connections", permissions: 7 },
  { name: "readonly_auditor", description: "Reads everything, including logs; changes nothing", permissions: 3 },
];

function consoleRoles(db: DemoDb) {
  return CONSOLE_ROLES.map((r, i) => {
    const members = db.admins.filter((a) => a.roles?.includes(r.name));
    return {
      id: `de0e000${i + 1}-0000-4000-8000-00000000000${i + 1}`,
      name: r.name,
      description: r.description,
      workspace_id: db.workspaceId,
      created_at: db.admins[0]?.created_at,
      updated_at: db.admins[0]?.updated_at,
      permissions_count: r.permissions,
      users_assigned: members.length,
      user_ids: members.map((m) => m.id),
      usernames: members.map((m) => m.username),
      group_ids: [],
    };
  });
}

demoRoute("GET", "/authsec/uflow/admin/roles", ({ db }) => ok(consoleRoles(db)));
// The same path serves the role list (by workspace) and one role's detail (by role id).
demoRoute("GET", "/authsec/uflow/admin/roles/:idOrWs", ({ db, params }) => {
  const appRole = db.roles.find((r) => r.id === params.idOrWs);
  if (appRole) {
    const scopes = appRole.scope_ids.map((id) => db.scopes.find((s) => s.id === id)?.scope_string ?? "").filter(Boolean);
    const holders = db.assignments.filter((a) => a.role_id === appRole.id && a.status === "active" && a.identity_type === "user");
    return ok({
      id: appRole.id,
      name: appRole.name,
      description: appRole.description,
      permissions: scopes,
      granted_scopes: scopes,
      user_ids: holders.map((h) => h.identity_id),
      usernames: holders.map((h) => db.endUsers.find((u) => u.id === h.identity_id)?.username ?? ""),
    });
  }
  const consoleRole = consoleRoles(db).find((r) => r.id === params.idOrWs);
  if (consoleRole) {
    return ok({ id: consoleRole.id, name: consoleRole.name, description: consoleRole.description, permissions: db.permissions.slice(0, consoleRole.permissions_count).map((p) => p.full_permission_string), user_ids: consoleRole.user_ids, usernames: consoleRole.usernames });
  }
  return ok(consoleRoles(db));
});
demoRoute("GET", "/authsec/uflow/admin/permissions", ({ db }) => ok(db.permissions));

// ── Logs ─────────────────────────────────────────────────────────────────
function page<T>(rows: T[], query: URLSearchParams) {
  const pageNo = Math.max(1, Number(query.get("page")) || 1);
  const limit = Math.max(1, Number(query.get("limit")) || 25);
  return { logs: rows.slice((pageNo - 1) * limit, pageNo * limit), page: pageNo, limit, total: rows.length };
}

demoRoute("GET", "/authsec/logs/auth/paginated", ({ db, query }) => {
  const status = query.get("status");
  const action = query.get("action");
  return ok(page(db.authLogs.filter((l) => (!status || l.status === status) && (!action || l.action.includes(action))), query));
});

demoRoute("GET", "/authsec/logs/audit/paginated", ({ db, query }) => {
  const action = query.get("action");
  const resource = query.get("resource");
  return ok(page(db.auditLogs.filter((l) => (!action || l.action.includes(action)) && (!resource || l.resource.includes(resource))), query));
});

demoRoute("GET", "/authsec/logs/m2m/paginated", ({ db, query }) => {
  const clientId = query.get("client_id");
  return ok(page(db.m2mLogs.filter((l) => !clientId || l.clientId === clientId), query));
});

demoRoute("GET", "/authsec/logs/status", () =>
  ok({ enabled: true, backend: "database", sources: { auth: "active", audit: "active", m2m: "active", spire: "inactive" } }),
);

demoRoute("POST", "/authsec/logs/admin/fluent-bit", () =>
  ok({ success: true, message: "Forwarding saved (tutorial: nothing is sent anywhere)" }),
);

// ── Identity sources ─────────────────────────────────────────────────────
demoRoute("GET", "/authsec/identity-providers", ({ db, query }) => {
  const type = query.get("provider_type");
  return ok(db.identityProviders.filter((p) => !type || p.provider_type === type));
});

demoRoute("GET", "/authsec/identity-providers/:id", ({ db, params }) => {
  const p = db.identityProviders.find((x) => x.id === params.id);
  return p ? ok(p) : notFound("Identity provider");
});

demoRoute("GET", "/authsec/scim-connections", ({ db }) => ok(db.scimConnections));

demoRoute("POST", "/authsec/uflow/admin/sync-configs/list", ({ db, body }) => {
  const type = body.sync_type;
  return ok({ configs: db.syncConfigs.filter((c) => !type || c.sync_type === type) });
});

demoRoute("GET", "/authsec/exsvc/services", ({ db }) => ok({ services: db.externalServices }));

// ── The operator's own MFA and voice devices (never the real ones) ──────
demoRoute("GET", "/authsec/uflow/auth/ciba/devices", ({ db }) =>
  ok({
    success: true,
    devices: [
      { id: "demo-ciba-1", device_name: "Priya's iPhone", platform: "ios", device_model: "iPhone 15", app_version: "AuthSec 2.4.0", os_version: "iOS 18.1", is_active: true, last_used: Math.floor((db.now - 3_600_000) / 1000), created_at: Math.floor((db.now - 40 * 86_400_000) / 1000) },
    ],
  }),
);
demoRoute("DELETE", "/authsec/uflow/auth/ciba/devices/:deviceId", () => ok({ success: true, message: "Device removed (tutorial)" }));
demoRoute("GET", "/authsec/uflow/auth/totp/devices", ({ db }) =>
  ok({
    success: true,
    devices: [
      { id: "demo-totp-1", user_id: db.admins[0]?.id ?? "", workspace_id: db.workspaceId, device_name: "1Password", device_type: "totp", last_used: Math.floor((db.now - 7_200_000) / 1000), is_active: true, is_primary: true, created_at: Math.floor((db.now - 90 * 86_400_000) / 1000), updated_at: Math.floor((db.now - 7_200_000) / 1000) },
    ],
  }),
);

// ── Trusted issuers and workload identity providers ─────────────────────
demoRoute("GET", "/authsec/trusted-issuers", ({ db }) => ok({ items: db.trustedIssuers }));

demoRoute("POST", "/authsec/trusted-issuers", ({ db, body, path }) => {
  const iss = String(body.iss ?? "").trim();
  if (!iss || !body.jwks_uri) return badRequest("iss and jwks_uri are required");
  const issuer = {
    id: newId(db),
    iss,
    jwks_uri: String(body.jwks_uri),
    provider_name: String(body.provider_name ?? iss),
    allowed_algs: (body.allowed_algs as string[] | undefined) ?? ["RS256"],
    allowed_auds: (body.allowed_auds as string[] | undefined) ?? [],
    clock_skew_secs: Number(body.clock_skew_secs ?? 60),
    jit_provisioning: Boolean(body.jit_provisioning),
    status: "active" as const,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.trustedIssuers.unshift(issuer);
  recordAudit(db, { action: "trusted_issuer.create", resource: "auth_method", resourceId: issuer.id, method: "POST", path });
  return created(issuer);
});

demoRoute("POST", "/authsec/trusted-issuers/test", ({ body }) =>
  ok(
    String(body.assertion ?? "").split(".").length === 3
      ? { pass: true, iss: "https://brightpath-consulting.okta.example", sub: "isabel.moreno", jti: "demo-jti-1", issued_at: nowIso(), expires_at: nowIso() }
      : { pass: false, reason: "The assertion is not a JWT (expected three dot-separated parts)" },
  ),
);

demoRoute("DELETE", "/authsec/trusted-issuers/:id", ({ db, params, path }) => {
  const issuer = db.trustedIssuers.find((t) => t.id === params.id);
  if (!issuer) return notFound("Trusted issuer");
  issuer.status = "revoked";
  issuer.revoked_at = nowIso();
  recordAudit(db, { action: "trusted_issuer.revoke", resource: "auth_method", resourceId: issuer.id, method: "DELETE", path });
  return ok({ status: "revoked" });
});

demoRoute("GET", "/authsec/workload-identity-providers", ({ db }) => ok({ items: db.workloadProviders }));

demoRoute("POST", "/authsec/workload-identity-providers", ({ db, body, path }) => {
  const name = String(body.name ?? "").trim();
  if (!name || !body.issuer) return badRequest("name and issuer are required");
  const provider = {
    id: newId(db),
    workspace_id: db.workspaceId,
    name,
    kind: body.kind === "spiffe" ? ("spiffe" as const) : ("oidc" as const),
    issuer: String(body.issuer),
    jwks_uri: body.jwks_uri ? String(body.jwks_uri) : undefined,
    trust_domain: body.trust_domain ? String(body.trust_domain) : undefined,
    allowed_audiences: (body.allowed_audiences as string[] | undefined) ?? [],
    subject_claim: String(body.subject_claim ?? "sub"),
    status: "active" as const,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.workloadProviders.unshift(provider);
  recordAudit(db, { action: "workload_provider.create", resource: "auth_method", resourceId: provider.id, method: "POST", path });
  return created(provider);
});

demoRoute("DELETE", "/authsec/workload-identity-providers/:id", ({ db, params, path }) => {
  if (!db.workloadProviders.some((p) => p.id === params.id)) return notFound("Workload identity provider");
  db.workloadProviders = db.workloadProviders.filter((p) => p.id !== params.id);
  recordAudit(db, { action: "workload_provider.delete", resource: "auth_method", resourceId: params.id, method: "DELETE", path });
  return ok({ deleted: params.id });
});
