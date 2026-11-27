import type { ApplicationRole, AccessScopeRef } from "@/app/api/accessApi";
import type { AccessAssignment, AgentConnection } from "@/app/api/agentIdentityApi";
import type { WorkspaceClientItem } from "@/app/api/mcpClientsApi";
import { badRequest, created, demoRoute, notFound, ok } from "../router";
import { newId, recordAudit, refreshCounts, type DemoDb, type DemoRole } from "../db";

const nowIso = () => new Date().toISOString();

function scopeRef(db: DemoDb, scopeId: string): AccessScopeRef | null {
  const s = db.scopes.find((x) => x.id === scopeId);
  return s ? { id: s.id, scope_string: s.scope_string, display_name: s.display_name, risk_level: s.risk_level, source: "application" } : null;
}

export function roleView(db: DemoDb, role: DemoRole): ApplicationRole {
  const app = db.applications.find((a) => a.id === role.application_id);
  const users = db.assignments.filter((a) => a.role_id === role.id && a.status === "active" && a.identity_type === "user");
  return {
    id: role.id,
    name: role.name,
    label: role.label,
    display_name: role.label,
    description: role.description,
    application: { id: app?.id ?? "", name: app?.name ?? "", resource_uri: app?.resource_uri ?? "" },
    is_default: role.is_default,
    users_count: users.length,
    scopes_count: role.scope_ids.length,
    scopes: role.scope_ids.map((id) => scopeRef(db, id)).filter((s): s is AccessScopeRef => s !== null),
    source: role.source,
    updated_at: role.updated_at,
  };
}

function identityName(db: DemoDb, type: "user" | "service_account", id: string): string {
  if (type === "user") return db.endUsers.find((u) => u.id === id)?.name ?? "Unknown user";
  return db.serviceAccounts.find((s) => s.id === id)?.name ?? "Unknown service account";
}

function assignmentView(db: DemoDb, a: DemoDb["assignments"][number]): AccessAssignment {
  const role = db.roles.find((r) => r.id === a.role_id);
  return {
    id: a.id,
    identity_type: a.identity_type,
    identity_id: a.identity_id,
    identity_name: identityName(db, a.identity_type, a.identity_id),
    role_id: a.role_id,
    role_name: role?.name ?? "",
    effective_scopes: (role?.scope_ids ?? []).map((id) => db.scopes.find((s) => s.id === id)?.scope_string ?? "").filter(Boolean),
    status: a.status,
    created_at: a.created_at,
  };
}

function connectionView(db: DemoDb, c: WorkspaceClientItem): AgentConnection {
  const sa = db.serviceAccounts.find((s) => s.oauth_client_id === c.client_id);
  const saGrant = sa && db.assignments.find((a) => a.identity_id === sa.id && a.application_id === c.resource_server_id);
  const role = saGrant && db.roles.find((r) => r.id === saGrant.role_id);
  return {
    connection_id: c.client_id,
    status: c.status,
    client_id: c.client_id,
    client_name: c.client_name,
    client_kind: c.client_kind,
    registration_type: c.registration_type,
    access_method: c.client_kind === "m2m" ? "m2m" : c.client_kind === "agent" ? "xaa" : "user",
    authority: sa ? { type: "service_account", id: sa.id, name: sa.name } : undefined,
    granted_through: role
      ? {
          role_id: role.id,
          role_name: role.name,
          scopes: role.scope_ids.map((id) => db.scopes.find((s) => s.id === id)?.scope_string ?? ""),
        }
      : undefined,
    created_at: c.created_at,
  };
}

// ── Applications (resource servers) ─────────────────────────────────────
demoRoute("GET", "/authsec/applications", ({ db }) => ok(db.applications));

demoRoute("GET", "/authsec/applications/:id", ({ db, params }) => {
  const app = db.applications.find((a) => a.id === params.id);
  return app ? ok(app) : notFound("Application");
});

demoRoute("POST", "/authsec/applications", ({ db, body, path }) => {
  const name = String(body.name ?? "").trim();
  const url = String(body.public_base_url ?? "").trim();
  if (!name || !url) return badRequest("name and public_base_url are required");
  const id = newId(db);
  const basePath = String(body.protected_base_path ?? "/mcp");
  db.applications.unshift({
    id,
    workspace_id: db.workspaceId,
    name,
    public_base_url: url,
    protected_base_path: basePath,
    resource_uri: `${url}${basePath}`,
    scopes_supported: [],
    registration_modes: ["dcr", "prereg"],
    active: false,
    tools_count: 0,
    scopes_count: 0,
    roles_count: 0,
    state: "pending_scan",
    last_scan_status: "pending",
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  recordAudit(db, { action: "application.create", resource: "application", resourceId: id, method: "POST", path });
  return created({
    id,
    issuer_url: "https://northwind.authsec.example",
    resource_url: `${url}${basePath}`,
    jwks_uri: "https://northwind.authsec.example/.well-known/jwks.json",
    introspection_endpoint: "https://northwind.authsec.example/oauth2/introspect",
    introspection_secret: "demo_secret_shown_once_7Hq2mV9xK4pL",
    validation_mode: "jwt",
    scopes_supported: [],
  });
});

demoRoute("PUT", "/authsec/applications/:id", ({ db, params, body, path }) => {
  const app = db.applications.find((a) => a.id === params.id);
  if (!app) return notFound("Application");
  for (const key of ["name", "public_base_url", "protected_base_path", "active"] as const) {
    if (body[key] !== undefined) (app as unknown as Record<string, unknown>)[key] = body[key];
  }
  app.resource_uri = `${app.public_base_url}${app.protected_base_path}`;
  app.updated_at = nowIso();
  recordAudit(db, { action: "application.update", resource: "application", resourceId: app.id, method: "PUT", path });
  return ok(app);
});

demoRoute("DELETE", "/authsec/applications/:id", ({ db, params, path }) => {
  const app = db.applications.find((a) => a.id === params.id);
  if (!app) return notFound("Application");
  db.applications = db.applications.filter((a) => a.id !== app.id);
  const roleIds = new Set(db.roles.filter((r) => r.application_id === app.id).map((r) => r.id));
  db.roles = db.roles.filter((r) => !roleIds.has(r.id));
  db.scopes = db.scopes.filter((s) => s.application_id !== app.id);
  db.assignments = db.assignments.filter((a) => a.application_id !== app.id);
  db.clients = db.clients.filter((c) => c.resource_server_id !== app.id);
  recordAudit(db, { action: "application.delete", resource: "application", resourceId: app.id, method: "DELETE", path });
  return ok({ status: "deleted" });
});

demoRoute("POST", "/authsec/applications/:id/rotate-introspection-secret", ({ db, params, path }) => {
  if (!db.applications.some((a) => a.id === params.id)) return notFound("Application");
  recordAudit(db, { action: "application.rotate_secret", resource: "application", resourceId: params.id, method: "POST", path });
  return ok({ introspection_secret: `demo_secret_${Math.random().toString(36).slice(2, 14)}` });
});

// ── Roles ───────────────────────────────────────────────────────────────
demoRoute("GET", "/authsec/application-roles", ({ db, query }) => {
  const q = query.get("q")?.toLowerCase();
  const appId = query.get("application_id");
  const onlyDefault = query.get("default");
  const roles = db.roles
    .filter((r) => !appId || r.application_id === appId)
    .filter((r) => onlyDefault === null || String(r.is_default) === onlyDefault)
    .filter((r) => !q || `${r.name} ${r.label} ${r.description}`.toLowerCase().includes(q))
    .map((r) => roleView(db, r));
  return ok({ roles, count: roles.length });
});

demoRoute("POST", "/authsec/applications/:id/roles", ({ db, params, body, path }) => {
  const app = db.applications.find((a) => a.id === params.id);
  if (!app) return notFound("Application");
  const name = String(body.name ?? "").trim();
  if (!name) return badRequest("name is required");
  if (db.roles.some((r) => r.application_id === app.id && r.name === name)) return badRequest(`A role named ${name} already exists`);
  const role: DemoRole = {
    id: newId(db),
    application_id: app.id,
    name,
    label: name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: String(body.description ?? ""),
    is_default: Boolean(body.default_role),
    scope_ids: Array.isArray(body.scope_ids) ? (body.scope_ids as string[]) : [],
    source: "custom",
    updated_at: nowIso(),
  };
  if (role.is_default) db.roles.forEach((r) => r.application_id === app.id && (r.is_default = false));
  db.roles.push(role);
  for (const userId of (body.assign_user_ids as string[] | undefined) ?? []) {
    db.assignments.push({ id: newId(db), application_id: app.id, identity_type: "user", identity_id: userId, role_id: role.id, status: "active", source: "manual", created_at: nowIso() });
  }
  refreshCounts(db);
  recordAudit(db, { action: "role.create", resource: "role", resourceId: role.id, method: "POST", path });
  return created(roleView(db, role));
});

demoRoute("PUT", "/authsec/applications/:id/roles/:roleId/scope-grants", ({ db, params, body, path }) => {
  const role = db.roles.find((r) => r.id === params.roleId && r.application_id === params.id);
  if (!role) return notFound("Role");
  role.scope_ids = Array.isArray(body.scope_ids) ? (body.scope_ids as string[]) : role.scope_ids;
  role.updated_at = nowIso();
  recordAudit(db, { action: "role.update_scopes", resource: "role", resourceId: role.id, method: "PUT", path });
  const granted = role.scope_ids.map((id) => db.scopes.find((s) => s.id === id)?.scope_string ?? "").filter(Boolean);
  return ok({ role_id: role.id, role_name: role.name, scope_ids: role.scope_ids, granted_scopes: granted, permissions_count: granted.length });
});

// ── Access assignments ─────────────────────────────────────────────────
demoRoute("GET", "/authsec/applications/:id/access-assignments", ({ db, params }) =>
  ok({ items: db.assignments.filter((a) => a.application_id === params.id && a.status === "active").map((a) => assignmentView(db, a)) }),
);

demoRoute("GET", "/authsec/applications/:id/access-assignments/summary", ({ db, params }) => {
  const items = db.assignments.filter((a) => a.application_id === params.id && a.status === "active");
  const conns = db.clients.filter((c) => c.resource_server_id === params.id);
  return ok({
    total_assignments: items.length,
    user_assignments: items.filter((a) => a.identity_type === "user").length,
    service_account_assignments: items.filter((a) => a.identity_type === "service_account").length,
    workload_assignments: 0,
    pending_requests: conns.filter((c) => c.status === "pending_approval").length,
    active_connections: conns.filter((c) => c.status === "approved").length,
  });
});

function createAssignment(db: DemoDb, appId: string, type: "user" | "service_account", identityId: string, roleId: string, path: string) {
  if (!db.applications.some((a) => a.id === appId)) return notFound("Application");
  if (!db.roles.some((r) => r.id === roleId && r.application_id === appId)) return badRequest("role does not belong to this application");
  const existing = db.assignments.find((a) => a.application_id === appId && a.identity_id === identityId && a.role_id === roleId && a.status === "active");
  if (existing) return ok({ id: existing.id });
  const id = newId(db);
  db.assignments.push({ id, application_id: appId, identity_type: type, identity_id: identityId, role_id: roleId, status: "active", source: "manual", created_at: nowIso() });
  refreshCounts(db);
  recordAudit(db, { action: "assignment.create", resource: "assignment", resourceId: id, method: "POST", path });
  return created({ id });
}

demoRoute("POST", "/authsec/applications/:id/access-assignments/users", ({ db, params, body, path }) =>
  createAssignment(db, params.id, "user", String(body.user_id ?? ""), String(body.role_id ?? ""), path),
);

demoRoute("POST", "/authsec/applications/:id/access-assignments/service-accounts", ({ db, params, body, path }) =>
  createAssignment(db, params.id, "service_account", String(body.service_account_id ?? ""), String(body.role_id ?? ""), path),
);

demoRoute("DELETE", "/authsec/applications/:id/access-assignments/:assignmentId", ({ db, params, path }) => {
  const a = db.assignments.find((x) => x.id === params.assignmentId && x.application_id === params.id);
  if (!a) return notFound("Assignment");
  db.assignments = db.assignments.filter((x) => x.id !== a.id);
  refreshCounts(db);
  recordAudit(db, { action: "assignment.delete", resource: "assignment", resourceId: a.id, method: "DELETE", path });
  return ok({ status: "deleted" });
});

demoRoute("GET", "/authsec/applications/:id/users/:userId/effective-access", ({ db, params }) => {
  const app = db.applications.find((a) => a.id === params.id);
  const user = db.endUsers.find((u) => u.id === params.userId);
  if (!app || !user) return notFound("User access");
  const grants = db.assignments.filter((a) => a.application_id === app.id && a.identity_id === user.id && a.status === "active");
  const roles = grants.map((g) => db.roles.find((r) => r.id === g.role_id)!).filter(Boolean);
  return ok({
    user: { id: user.id, email: user.email, name: user.name, status: user.status },
    application: { id: app.id, name: app.name, resource_uri: app.resource_uri },
    roles: roles.map((r) => ({ id: r.id, name: r.name, label: r.label, source: r.source, binding_id: grants.find((g) => g.role_id === r.id)?.id })),
    scopes: db.scopes
      .filter((s) => s.application_id === app.id)
      .map((s) => {
        const through = roles.filter((r) => r.scope_ids.includes(s.id));
        return {
          id: s.id,
          scope_string: s.scope_string,
          display_name: s.display_name,
          risk_level: s.risk_level,
          status: through.length ? "granted" : "not_granted",
          granted_through: through.map((r) => ({ role_id: r.id, role_name: r.name, binding_id: grants.find((g) => g.role_id === r.id)?.id ?? "", source: r.source })),
          removable: through.length > 0,
        };
      }),
  });
});

// ── Workspace-wide role bindings (the Assignments tab) ──────────────────
demoRoute("GET", "/authsec/uflow/admin/bindings", ({ db, query }) => {
  const userId = query.get("user_id");
  const roleId = query.get("role_id");
  const rows = db.assignments
    .filter((a) => a.status === "active" && a.identity_type === "user")
    .filter((a) => (!userId || a.identity_id === userId) && (!roleId || a.role_id === roleId))
    .map((a) => {
      const user = db.endUsers.find((u) => u.id === a.identity_id);
      const role = db.roles.find((r) => r.id === a.role_id);
      const app = db.applications.find((x) => x.id === a.application_id);
      return {
        id: a.id,
        user_id: a.identity_id,
        username: user?.username,
        email: user?.email,
        role_id: a.role_id,
        role_name: role?.name ?? "",
        scope_type: "application",
        scope_id: a.application_id,
        created_at: a.created_at,
        source: a.source,
        user: user ? { id: user.id, email: user.email, name: user.name } : undefined,
        role: role ? { id: role.id, name: role.name, label: role.label } : undefined,
        application: app ? { id: app.id, name: app.name, resource_uri: app.resource_uri } : undefined,
      };
    });
  return ok(rows);
});

demoRoute("POST", "/authsec/uflow/admin/bindings", ({ db, body, path }) => {
  const role = db.roles.find((r) => r.id === body.role_id);
  if (!role) return badRequest("role_id is not a role in this workspace");
  const res = createAssignment(db, role.application_id, "user", String(body.user_id ?? ""), role.id, path);
  const id = (res.data as { id?: string }).id ?? "";
  return res.status >= 400 ? res : created({ id, role_name: role.name, scope_description: "Application", status: "active" });
});

demoRoute("DELETE", "/authsec/uflow/admin/bindings/:bindingId", ({ db, params, path }) => {
  const a = db.assignments.find((x) => x.id === params.bindingId);
  if (!a) return notFound("Binding");
  db.assignments = db.assignments.filter((x) => x.id !== a.id);
  refreshCounts(db);
  recordAudit(db, { action: "assignment.delete", resource: "assignment", resourceId: a.id, method: "DELETE", path });
  return ok({});
});

// ── Scope catalog ────────────────────────────────────────────────────────
demoRoute("GET", "/authsec/scope-catalog", ({ db, query }) => {
  const q = query.get("q")?.toLowerCase();
  const risk = query.get("risk_level");
  const appId = query.get("application_id");
  const items = db.scopes
    .filter((s) => (!appId || s.application_id === appId) && (!risk || s.risk_level === risk))
    .filter((s) => !q || `${s.scope_string} ${s.display_name} ${s.description}`.toLowerCase().includes(q))
    .map((s) => {
      const app = db.applications.find((a) => a.id === s.application_id);
      const roles = db.roles.filter((r) => r.scope_ids.includes(s.id));
      const users = new Set(
        db.assignments.filter((a) => a.status === "active" && a.identity_type === "user" && roles.some((r) => r.id === a.role_id)).map((a) => a.identity_id),
      );
      return {
        id: s.id,
        kind: "application" as const,
        key: s.scope_string,
        scope_string: s.scope_string,
        display_name: s.display_name,
        description: s.description,
        risk_level: s.risk_level,
        source: "sdk_manifest",
        application: app ? { id: app.id, name: app.name, resource_uri: app.resource_uri } : undefined,
        tools_count: Math.max(1, Math.round((app?.tools_count ?? 0) / Math.max(1, app?.scopes_count ?? 1))),
        roles_count: roles.length,
        users_count: users.size,
        consent_grants_count: users.size,
        updated_at: s.created_at,
      };
    });
  return ok({ items, count: items.length });
});

// ── Connections and workspace clients ───────────────────────────────────
demoRoute("GET", "/authsec/applications/:id/connections", ({ db, params }) =>
  ok({ items: db.clients.filter((c) => c.resource_server_id === params.id).map((c) => connectionView(db, c)) }),
);

demoRoute("DELETE", "/authsec/applications/:id/connections/:clientId", ({ db, params, path }) => {
  const client = db.clients.find((c) => c.client_id === params.clientId && c.resource_server_id === params.id);
  if (!client) return notFound("Connection");
  client.status = "revoked";
  refreshCounts(db);
  recordAudit(db, { action: "client.revoke", resource: "client", resourceId: client.id, method: "DELETE", path });
  return ok({ status: "revoked" });
});

demoRoute("PUT", "/authsec/applications/:id/connections/:clientId/approve", ({ db, params, path }) => {
  const client = db.clients.find((c) => c.client_id === params.clientId && c.resource_server_id === params.id);
  if (!client) return notFound("Connection");
  client.status = "approved";
  refreshCounts(db);
  recordAudit(db, { action: "client.approve", resource: "client", resourceId: client.id, method: "PUT", path });
  return ok({ status: "approved" });
});

demoRoute("GET", "/authsec/clients", ({ db, query }) => {
  const rs = query.get("resource_server_id");
  return ok(db.clients.filter((c) => !rs || c.resource_server_id === rs));
});

demoRoute("POST", "/authsec/agents", ({ db, body, path }) => {
  const name = String(body.name ?? "").trim();
  if (!name) return badRequest("name is required");
  const github = db.applications[0];
  const clientId = `nw-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${db.nextSeq.toString(16).padStart(6, "0")}`;
  const redirects = Array.isArray(body.redirect_uris) ? (body.redirect_uris as string[]) : [];
  db.clients.unshift({
    id: newId(db),
    client_id: clientId,
    client_name: name,
    client_kind: "agent",
    registration_type: "prereg",
    status: "approved",
    sync_status: "active",
    resource_server_id: github.id,
    resource_server_name: github.name,
    redirect_uris: redirects,
    tags: ["agent"],
    adopted_elsewhere: false,
    created_at: nowIso(),
  });
  refreshCounts(db);
  recordAudit(db, { action: "agent.register", resource: "client", resourceId: clientId, method: "POST", path });
  return created({ client_id: clientId, client_secret: "demo_agent_secret_shown_once_Xk29", redirect_uris: redirects, issuer: "https://northwind.authsec.example" });
});
