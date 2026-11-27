import type { MCPToolResponse, OAuthScope, OAuthScopeResponse, ScopeMatrixResponse } from "@/app/api/types/scopeMatrix";
import type { ResourceServer } from "@/app/api/resourceServersApi";
import { badRequest, created, demoRoute, notFound, ok, type DemoResponse } from "../router";
import { newId, recordAudit, refreshCounts, toolFromDef, type DemoDb, type DemoScope, type DemoTool } from "../db";
import { JIRA_RECOVERED_TOOLS } from "../seedData";

const nowIso = () => new Date().toISOString();
const ISSUER = "https://northwind.authsec.example";

function appOf(db: DemoDb, id: string): ResourceServer | undefined {
  return db.applications.find((a) => a.id === id);
}

function withApp(db: DemoDb, id: string, fn: (app: ResourceServer) => DemoResponse): DemoResponse {
  const app = appOf(db, id);
  return app ? fn(app) : notFound("Application");
}

const scopeString = (db: DemoDb, id: string) => db.scopes.find((s) => s.id === id)?.scope_string ?? "";

function scopeResponse(s: DemoScope): OAuthScopeResponse {
  return { id: s.id, scope_string: s.scope_string, display_name: s.display_name, description: s.description, risk_level: s.risk_level, is_auto_discovered: true };
}

function usersHolding(db: DemoDb, scopeId: string): Set<string> {
  const roleIds = new Set(db.roles.filter((r) => r.scope_ids.includes(scopeId)).map((r) => r.id));
  return new Set(db.assignments.filter((a) => a.status === "active" && a.identity_type === "user" && roleIds.has(a.role_id)).map((a) => a.identity_id));
}

function oauthScope(db: DemoDb, s: DemoScope): OAuthScope {
  const users = usersHolding(db, s.id);
  return {
    ...scopeResponse(s),
    workspace_id: db.workspaceId,
    resource_server_id: s.application_id,
    source: "manifest",
    tools_count: db.tools.filter((t) => t.scope_ids.includes(s.id)).length,
    roles_count: db.roles.filter((r) => r.scope_ids.includes(s.id)).length,
    users_count: users.size,
    consent_grants_count: db.consents.filter((c) => !c.revoked_at && c.granted_scopes.includes(s.scope_string)).length,
    created_at: s.created_at,
    updated_at: s.created_at,
  };
}

function toolResponse(db: DemoDb, t: DemoTool): MCPToolResponse {
  const mapped = t.scope_ids
    .map((id) => db.scopes.find((s) => s.id === id))
    .filter((s): s is DemoScope => Boolean(s))
    .map((s) => ({ scope_id: s.id, scope_string: s.scope_string, display_name: s.display_name, risk_level: s.risk_level, auto_matched: false, source: "admin_override" as const }));
  const suggested = t.suggested
    .map((key) => db.scopes.find((s) => s.application_id === t.application_id && s.scope_string === key))
    .filter((s): s is DemoScope => Boolean(s) && !t.scope_ids.includes(s!.id))
    .map((s) => ({ scope_id: s.id, scope_string: s.scope_string, display_name: s.display_name, risk_level: s.risk_level, auto_matched: true, source: "sdk_suggested" as const }));
  return {
    id: t.id,
    name: t.name,
    title: t.title,
    description: t.description,
    input_schema: { type: "object", properties: {} },
    annotations: { readOnlyHint: t.scope_ids.every((id) => scopeString(db, id).endsWith(":read")) },
    scopes: [...mapped, ...suggested],
    is_public: t.is_public,
    inventory_source: t.inventory_source,
    suggested_scopes: suggested.map((s) => s.scope_string),
  };
}

function scopeMatrix(db: DemoDb, app: ResourceServer): ScopeMatrixResponse {
  const tools = db.tools.filter((t) => t.application_id === app.id);
  const scopes = db.scopes.filter((s) => s.application_id === app.id);
  const used = new Set(tools.flatMap((t) => t.scope_ids));
  return {
    resource_server: {
      id: app.id,
      name: app.name,
      url: app.resource_uri,
      status: app.state,
      last_scan_status: app.last_scan_status,
      scan_generation: app.scan_generation,
      last_successful_generation: app.last_successful_generation,
      last_scan_started_at: app.last_scan_started_at,
      last_scan_completed_at: app.last_scan_completed_at,
    },
    tools: tools.map((t) => toolResponse(db, t)),
    scopes: scopes.map(scopeResponse),
    unmapped_scopes: scopes.filter((s) => !used.has(s.id)).map(scopeResponse),
    total_scopes: scopes.length,
    total_tools: tools.length,
  };
}

function toolStats(db: DemoDb, appId: string) {
  const tools = db.tools.filter((t) => t.application_id === appId);
  const publicTools = tools.filter((t) => t.is_public);
  const mapped = tools.filter((t) => !t.is_public && t.scope_ids.length > 0);
  const unmapped = tools.filter((t) => !t.is_public && t.scope_ids.length === 0);
  return { tools, total: tools.length, public: publicTools.length, mapped: mapped.length, unmapped: unmapped.length, publicNames: publicTools.map((t) => t.name) };
}

function checklist(db: DemoDb, app: ResourceServer) {
  const stats = toolStats(db, app.id);
  const scopes = db.scopes.filter((s) => s.application_id === app.id).length;
  const defaultRole = db.roles.find((r) => r.application_id === app.id && r.is_default);
  const clients = db.clients.filter((c) => c.resource_server_id === app.id && c.status !== "revoked").length;
  const steps = [
    { step: 1, name: "Register the protected endpoint", complete: true, detail: app.resource_uri },
    { step: 2, name: "Discover tools", complete: stats.total > 0, detail: stats.total ? `${stats.total} tools in the manifest` : app.last_scan_error ?? "No manifest received yet" },
    { step: 3, name: "Define scopes", complete: scopes > 0, detail: `${scopes} scopes` },
    { step: 4, name: "Map every tool to a scope", complete: stats.total > 0 && stats.unmapped === 0, detail: `${stats.unmapped} unmapped` },
    { step: 5, name: "Choose default access", complete: Boolean(defaultRole), detail: defaultRole ? `Default role: ${defaultRole.label}` : "No default role" },
    { step: 6, name: "Review clients and test", complete: clients > 0 || app.state === "ready", detail: `${clients} clients registered` },
  ];
  const blocking = steps.filter((s) => s.step >= 2 && s.step <= 5 && !s.complete);
  return { steps, can_activate: blocking.length === 0 && app.state !== "ready", blocking };
}

function rsRoles(db: DemoDb, appId: string) {
  return db.roles
    .filter((r) => r.application_id === appId)
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      is_default: r.is_default,
      permissions: r.scope_ids.length,
      bindings: db.assignments.filter((a) => a.role_id === r.id && a.status === "active").length,
      scopes: r.scope_ids.map((id) => scopeString(db, id)),
    }));
}

function rsBindings(db: DemoDb, appId: string) {
  return db.assignments
    .filter((a) => a.application_id === appId && a.status === "active" && a.identity_type === "user")
    .map((a) => {
      const user = db.endUsers.find((u) => u.id === a.identity_id);
      const role = db.roles.find((r) => r.id === a.role_id);
      return {
        id: a.id,
        user_id: a.identity_id,
        username: user?.username ?? "",
        user_email: user?.email ?? "",
        role_id: a.role_id,
        role_name: role?.name ?? "",
        scope_type: "application",
        scope_id: appId,
        created_at: a.created_at,
        assignment_source: a.source,
      };
    });
}

function accessUsers(db: DemoDb, app: ResourceServer) {
  const grants = db.assignments.filter((a) => a.application_id === app.id && a.status === "active" && a.identity_type === "user");
  const userIds = Array.from(new Set(grants.map((g) => g.identity_id)));
  const users = userIds
    .map((uid) => db.endUsers.find((u) => u.id === uid))
    .filter((u): u is DemoDb["endUsers"][number] => Boolean(u))
    .map((u) => {
      const mine = grants.filter((g) => g.identity_id === u.id);
      const roles = mine.map((g) => db.roles.find((r) => r.id === g.role_id)!).filter(Boolean);
      const scopeIds = Array.from(new Set(roles.flatMap((r) => r.scope_ids)));
      return {
        user: { id: u.id, email: u.email, name: u.name, status: u.status },
        roles: roles.map((r) => ({ id: r.id, name: r.name, label: r.label, source: r.source, binding_id: mine.find((g) => g.role_id === r.id)?.id })),
        scopes: scopeIds.map((id) => db.scopes.find((s) => s.id === id)!).filter(Boolean).map((s) => ({ id: s.id, scope_string: s.scope_string, display_name: s.display_name, risk_level: s.risk_level })),
        bindings: mine.map((g) => ({
          id: g.id,
          user_id: u.id,
          username: u.username,
          user_email: u.email,
          role_id: g.role_id,
          role_name: roles.find((r) => r.id === g.role_id)?.name ?? "",
          scope_type: "application",
          scope_id: app.id,
          created_at: g.created_at,
          assignment_source: g.source,
        })),
        first_consent_at: u.first_consent_at,
        last_seen_at: u.last_login ?? undefined,
      };
    });
  return { users, count: users.length };
}

function effectiveAccess(db: DemoDb, appId: string, userId: string): DemoResponse {
  const app = appOf(db, appId);
  const user = db.endUsers.find((u) => u.id === userId);
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
}

// ── Setup checklist, launch, readiness ──────────────────────────────────
demoRoute("GET", "/authsec/applications/:id/setup", ({ db, params }) =>
  withApp(db, params.id, (app) => {
    const { steps, can_activate } = checklist(db, app);
    return ok({ steps, can_activate });
  }),
);

demoRoute("GET", "/authsec/applications/:id/activation-preview", ({ db, params }) =>
  withApp(db, params.id, (app) => {
    const stats = toolStats(db, app.id);
    const scopes = db.scopes.filter((s) => s.application_id === app.id);
    const defaultRole = db.roles.find((r) => r.application_id === app.id && r.is_default);
    const viewer = (defaultRole?.scope_ids ?? []).map((id) => scopeString(db, id));
    return ok({
      tools: { total: stats.total, public: stats.public, mapped: stats.mapped, unmapped: stats.unmapped },
      scopes: scopes.map((s) => ({ scope_string: s.scope_string, display_name: s.display_name, tool_count: stats.tools.filter((t) => t.scope_ids.includes(s.id)).length })),
      scope_count: scopes.length,
      default_role: defaultRole?.name ?? "",
      viewer_scopes: viewer,
      public_tool_names: stats.publicNames,
      first_time_user_grant: viewer,
      can_activate: checklist(db, app).can_activate,
    });
  }),
);

demoRoute("POST", "/authsec/applications/:id/activate", ({ db, params, path }) =>
  withApp(db, params.id, (app) => {
    const { can_activate, blocking } = checklist(db, app);
    if (!can_activate) {
      return { status: 409, data: { error: "This application is not ready to launch", failed: blocking.map((s) => s.name) } };
    }
    app.state = "ready";
    app.active = true;
    app.setup_completed_at = nowIso();
    app.last_validation_status = "passed";
    app.last_validated_at = nowIso();
    app.updated_at = nowIso();
    recordAudit(db, { action: "application.activate", resource: "application", resourceId: app.id, method: "POST", path });
    return ok({ status: "ready" });
  }),
);

demoRoute("POST", "/authsec/applications/:id/validate", ({ db, params, path }) =>
  withApp(db, params.id, (app) => {
    const failing = app.state === "scan_failed" || app.state === "pending_scan";
    app.last_validated_at = nowIso();
    app.last_validation_status = failing ? "failed" : "passed";
    app.last_validation_error = failing ? "The protected endpoint did not return a WWW-Authenticate bearer challenge" : undefined;
    recordAudit(db, { action: "application.validate", resource: "application", resourceId: app.id, method: "POST", path, status: failing ? "failure" : "success" });
    const check = (key: string, label: string, pass: boolean, message: string) => ({ key, label, status: pass ? "passing" : "failing", message });
    return ok({
      status: failing ? "failed" : "passed",
      last_validated_at: app.last_validated_at,
      checks: [
        check("metadata", "Endpoint metadata", true, `${app.public_base_url}/.well-known/oauth-protected-resource responded with this application's resource URI`),
        check("challenge", "Bearer challenge", !failing, failing ? "An unauthenticated call did not return a WWW-Authenticate bearer challenge" : "Unauthenticated calls get 401 with WWW-Authenticate: Bearer"),
        check("client_registration", "Client registration", true, "Dynamic client registration is open for this resource"),
        check("browser_login", "Browser login", !failing, failing ? "Fix the bearer challenge before testing a browser login" : "Ready for a browser sign-in test"),
      ],
    });
  }),
);

demoRoute("POST", "/authsec/applications/:id/test-login", ({ db, params }) =>
  withApp(db, params.id, (app) => {
    const stats = toolStats(db, app.id);
    return ok({
      resource_server: { id: app.id, name: app.name, state: app.state, status: app.active ? "active" : "inactive" },
      oauth: { state: app.state, ready_since: app.setup_completed_at },
      sdk_enforcement: { sdk_policy_state: app.state === "ready" ? "enforcing" : "observing", tool_count: stats.total, unmapped_tools: stats.unmapped },
    });
  }),
);

demoRoute("GET", "/authsec/applications/:id/sdk-manifest-status", ({ db, params }) =>
  withApp(db, params.id, (app) => {
    const total = toolStats(db, app.id).total;
    const success = total > 0
      ? { id: `ma-${app.id.slice(0, 8)}-ok`, rs_id: app.id, attempted_at: app.last_scan_completed_at ?? nowIso(), status: "success", tool_count: total, manifest_version: "2025-06-18", sdk_build_id: "authsec-sdk-py 1.8.2" }
      : null;
    const attempt = app.state === "scan_failed"
      ? { id: `ma-${app.id.slice(0, 8)}-err`, rs_id: app.id, attempted_at: app.last_scan_completed_at ?? nowIso(), status: "failed", reason: app.last_scan_error }
      : success;
    return ok({ last_attempt: attempt, last_success: success, never_seen: !attempt });
  }),
);

demoRoute("POST", "/authsec/applications/:id/rescan", ({ db, params, path }) =>
  withApp(db, params.id, (app) => {
    let added: DemoTool[] = [];
    if (app.state === "scan_failed" && app.name === "Jira Ops MCP") {
      added = JIRA_RECOVERED_TOOLS.map((def) => toolFromDef(db.scopes, app.id, def, newId(db), nowIso()));
    } else if (app.state === "pending_scan" && db.tools.every((t) => t.application_id !== app.id)) {
      added = [
        { name: "ping", title: "Ping", description: "Health check.", scopes: [], public: true },
        { name: "list_items", title: "List items", description: "Lists records.", scopes: [] },
        { name: "get_item", title: "Get an item", description: "Returns one record.", scopes: [] },
        { name: "update_item", title: "Update an item", description: "Edits a record.", scopes: [] },
      ].map((def) => toolFromDef(db.scopes, app.id, def, newId(db), nowIso()));
    }
    db.tools.push(...added);
    if (added.length && app.state !== "ready") app.state = "needs_setup";
    app.last_scan_status = "succeeded";
    app.last_scan_error = undefined;
    app.scan_generation = (app.scan_generation ?? 0) + 1;
    app.last_successful_generation = app.scan_generation;
    app.last_scan_started_at = new Date(Date.now() - 4000).toISOString();
    app.last_scan_completed_at = nowIso();
    refreshCounts(db);
    recordAudit(db, { action: "application.scan", resource: "application", resourceId: app.id, method: "POST", path });
    return ok({
      result: { tools_added: added.length, tools_updated: 0, tools_removed: 0, scopes_added: 0, scopes_removed: 0, unmapped_scopes: null, warnings: added.length ? [`${added.length} new tools are denied until you map them to scopes`] : null },
      status: app.state,
      last_scan_status: app.last_scan_status,
      scan_generation: app.scan_generation,
      last_successful_generation: app.last_successful_generation,
    });
  }),
);

demoRoute("GET", "/authsec/applications/:id/drift-events", ({ db, params }) =>
  ok({ events: db.drift.filter((d) => d.rs_id === params.id) }),
);

demoRoute("POST", "/authsec/applications/:id/drift-events/:eventId/dismiss", ({ db, params, path }) => {
  if (!db.drift.some((d) => d.id === params.eventId)) return notFound("Drift event");
  db.drift = db.drift.filter((d) => d.id !== params.eventId);
  recordAudit(db, { action: "drift.dismiss", resource: "application", resourceId: params.id, method: "POST", path });
  return ok({ status: "dismissed" });
});

// ── Tools and scopes ────────────────────────────────────────────────────
demoRoute("GET", "/authsec/applications/:id/scope-matrix", ({ db, params }) => withApp(db, params.id, (app) => ok(scopeMatrix(db, app))));
demoRoute("GET", "/authsec/v1/applications/:id/tool-exposure", ({ db, params }) => withApp(db, params.id, (app) => ok(scopeMatrix(db, app))));

demoRoute("PUT", "/authsec/applications/:id/tool-scope-map", ({ db, params, body, path }) =>
  withApp(db, params.id, (app) => {
    const mappings = Array.isArray(body.mappings) ? (body.mappings as Array<{ tool_id: string; scope_id: string; remove?: boolean }>) : [];
    for (const m of mappings) {
      const tool = db.tools.find((t) => t.id === m.tool_id && t.application_id === app.id);
      if (!tool) continue;
      if (m.remove) {
        tool.scope_ids = tool.scope_ids.filter((id) => id !== m.scope_id);
      } else if (!tool.scope_ids.includes(m.scope_id)) {
        tool.scope_ids.push(m.scope_id);
        tool.suggested = tool.suggested.filter((s) => s !== scopeString(db, m.scope_id));
      }
    }
    recordAudit(db, { action: "tool.map_scopes", resource: "resource", resourceId: app.id, method: "PUT", path });
    return ok({ status: "updated" });
  }),
);

demoRoute("POST", "/authsec/applications/:id/tools/:toolId/public", ({ db, params, body, path }) => {
  const tool = db.tools.find((t) => t.id === params.toolId && t.application_id === params.id);
  if (!tool) return notFound("Tool");
  tool.is_public = Boolean(body.is_public);
  recordAudit(db, { action: tool.is_public ? "tool.make_public" : "tool.make_private", resource: "resource", resourceId: tool.id, method: "POST", path });
  return ok({ tool_id: tool.id, is_public: tool.is_public });
});

demoRoute("POST", "/authsec/applications/:id/tools", ({ db, params, body, path }) =>
  withApp(db, params.id, (app) => {
    const name = String(body.name ?? "").trim();
    if (!name) return badRequest("name is required");
    const tool = toolFromDef(db.scopes, app.id, { name, title: name, description: String(body.description ?? ""), scopes: [], source: "manual" }, newId(db), nowIso());
    db.tools.push(tool);
    if (app.state === "pending_scan") app.state = "needs_setup";
    refreshCounts(db);
    recordAudit(db, { action: "tool.create", resource: "resource", resourceId: tool.id, method: "POST", path });
    return created({ tool_id: tool.id, name: tool.name, inventory_source: "manual" });
  }),
);

const listScopes = (db: DemoDb, appId: string) => db.scopes.filter((s) => s.application_id === appId).map((s) => oauthScope(db, s));
demoRoute("GET", "/authsec/applications/:id/scopes", ({ db, params }) => withApp(db, params.id, (app) => ok(listScopes(db, app.id))));
demoRoute("GET", "/authsec/v1/applications/:id/scopes", ({ db, params }) => withApp(db, params.id, (app) => ok(listScopes(db, app.id))));

demoRoute("POST", "/authsec/applications/:id/scopes", ({ db, params, body, path }) =>
  withApp(db, params.id, (app) => {
    const key = String(body.scope_string ?? "").trim();
    if (!key) return badRequest("scope_string is required");
    if (db.scopes.some((s) => s.application_id === app.id && s.scope_string === key)) return badRequest(`${key} already exists on this application`);
    const scope: DemoScope = {
      id: newId(db),
      application_id: app.id,
      scope_string: key,
      display_name: String(body.display_name ?? key),
      description: String(body.description ?? ""),
      risk_level: (body.risk_level as DemoScope["risk_level"]) ?? "low",
      created_at: nowIso(),
    };
    db.scopes.push(scope);
    refreshCounts(db);
    recordAudit(db, { action: "scope.create", resource: "resource", resourceId: scope.id, method: "POST", path });
    return created(oauthScope(db, scope));
  }),
);

demoRoute("PUT", "/authsec/scopes/:scopeId", ({ db, params, body, path }) => {
  const scope = db.scopes.find((s) => s.id === params.scopeId);
  if (!scope) return notFound("Scope");
  if (typeof body.display_name === "string") scope.display_name = body.display_name;
  if (typeof body.description === "string") scope.description = body.description;
  if (typeof body.risk_level === "string") scope.risk_level = body.risk_level as DemoScope["risk_level"];
  recordAudit(db, { action: "scope.update", resource: "resource", resourceId: scope.id, method: "PUT", path });
  return ok(oauthScope(db, scope));
});

demoRoute("DELETE", "/authsec/scopes/:scopeId", ({ db, params, path }) => {
  if (!db.scopes.some((s) => s.id === params.scopeId)) return notFound("Scope");
  db.scopes = db.scopes.filter((s) => s.id !== params.scopeId);
  db.roles.forEach((r) => (r.scope_ids = r.scope_ids.filter((id) => id !== params.scopeId)));
  db.tools.forEach((t) => (t.scope_ids = t.scope_ids.filter((id) => id !== params.scopeId)));
  refreshCounts(db);
  recordAudit(db, { action: "scope.delete", resource: "resource", resourceId: params.scopeId, method: "DELETE", path });
  return ok({});
});

demoRoute("GET", "/authsec/v1/applications/:id/scopes/:scopeId/impact", ({ db, params }) => {
  const scope = db.scopes.find((s) => s.id === params.scopeId);
  if (!scope) return notFound("Scope");
  return ok({
    scope_id: scope.id,
    application_id: params.id,
    impact: {
      tools_unlocked: db.tools.filter((t) => t.scope_ids.includes(scope.id)).length,
      roles_using: db.roles.filter((r) => r.scope_ids.includes(scope.id)).length,
      users_affected: usersHolding(db, scope.id).size,
      active_consent_grants: db.consents.filter((c) => !c.revoked_at && c.granted_scopes.includes(scope.scope_string)).length,
    },
  });
});

demoRoute("GET", "/authsec/scope-presets", () =>
  ok({
    presets: [
      { id: "read_write", name: "Read / write", category: "common", description: "A read scope for lookups and a write scope for changes.", recommended: true, scopes: [{ suffix: "read", description: "Read records", risk: "low" }, { suffix: "write", description: "Create and change records", risk: "medium" }] },
      { id: "read_write_admin", name: "Read / write / admin", category: "common", description: "Adds an admin scope for destructive or org-wide actions.", recommended: false, scopes: [{ suffix: "read", description: "Read records", risk: "low" }, { suffix: "write", description: "Create and change records", risk: "medium" }, { suffix: "admin", description: "Delete and administer", risk: "critical" }] },
      { id: "code_repos", name: "Code repositories", category: "domain", description: "Scopes shaped for source-control servers.", recommended: false, scopes: [{ suffix: "repo:read", description: "Read code", risk: "low" }, { suffix: "repo:write", description: "Push code", risk: "medium" }, { suffix: "actions:run", description: "Run workflows", risk: "high" }] },
      { id: "blank", name: "Start blank", category: "custom", description: "Define scopes yourself after the first scan.", recommended: false, scopes: [] },
    ],
  }),
);

// ── Roles, bindings and who has access ──────────────────────────────────
demoRoute("GET", "/authsec/applications/:id/roles", ({ db, params }) => withApp(db, params.id, (app) => ok({ roles: rsRoles(db, app.id) })));

demoRoute("GET", "/authsec/applications/:id/bindings", ({ db, params }) => withApp(db, params.id, (app) => ok({ bindings: rsBindings(db, app.id) })));
demoRoute("GET", "/authsec/v1/applications/:id/access-assignments", ({ db, params }) => withApp(db, params.id, (app) => ok({ bindings: rsBindings(db, app.id) })));

demoRoute("POST", "/authsec/applications/:id/bindings", ({ db, params, body, path }) =>
  withApp(db, params.id, (app) => {
    const role = db.roles.find((r) => r.id === body.role_id && r.application_id === app.id);
    if (!role) return badRequest("role does not belong to this application");
    const userId = String(body.user_id ?? "");
    if (!db.endUsers.some((u) => u.id === userId)) return badRequest("unknown user");
    const id = newId(db);
    db.assignments.push({ id, application_id: app.id, identity_type: "user", identity_id: userId, role_id: role.id, status: "active", source: "manual", created_at: nowIso() });
    refreshCounts(db);
    recordAudit(db, { action: "assignment.create", resource: "assignment", resourceId: id, method: "POST", path });
    return created({ id, user_id: userId, role_id: role.id, role_name: role.name });
  }),
);

demoRoute("DELETE", "/authsec/applications/:id/bindings/:bindingId", ({ db, params, path }) => {
  if (!db.assignments.some((a) => a.id === params.bindingId)) return notFound("Binding");
  db.assignments = db.assignments.filter((a) => a.id !== params.bindingId);
  refreshCounts(db);
  recordAudit(db, { action: "assignment.delete", resource: "assignment", resourceId: params.bindingId, method: "DELETE", path });
  return ok({ status: "deleted" });
});

demoRoute("GET", "/authsec/applications/:id/eligible-users", ({ db }) =>
  ok({ users: db.endUsers.filter((u) => u.status === "active").map((u) => ({ id: u.id, email: u.email, name: u.name })) }),
);

demoRoute("GET", "/authsec/applications/:id/access/users", ({ db, params }) => withApp(db, params.id, (app) => ok(accessUsers(db, app))));
demoRoute("GET", "/authsec/v1/applications/:id/end-user-access-summary", ({ db, params }) => withApp(db, params.id, (app) => ok(accessUsers(db, app))));
demoRoute("GET", "/authsec/v1/applications/:id/effective-access", ({ db, params, query }) => effectiveAccess(db, params.id, query.get("user_id") ?? ""));

demoRoute("GET", "/authsec/applications/:id/access-policy", ({ db, params }) =>
  withApp(db, params.id, (app) => {
    const roles = db.roles.filter((r) => r.application_id === app.id);
    const def = roles.find((r) => r.is_default);
    return ok({
      enabled: Boolean(app.access_policy_enabled),
      default_role_id: def?.id,
      default_role_name: def?.name,
      assignment_trigger: "first_login",
      assignment_source: "default_access",
      role_options: roles.map((r) => ({ role_id: r.id, name: r.name, description: r.description, is_generated: false, recommended: r.is_default, permissions: r.scope_ids.length })),
    });
  }),
);

demoRoute("PUT", "/authsec/applications/:id/access-policy", ({ db, params, body, path }) =>
  withApp(db, params.id, (app) => {
    app.access_policy_enabled = Boolean(body.enabled);
    if (typeof body.default_role_id === "string") {
      db.roles.forEach((r) => r.application_id === app.id && (r.is_default = r.id === body.default_role_id));
    }
    if (!app.access_policy_enabled) db.roles.forEach((r) => r.application_id === app.id && (r.is_default = false));
    const def = db.roles.find((r) => r.application_id === app.id && r.is_default);
    app.access_policy_role_name = def?.name;
    app.default_role_name = def?.name;
    recordAudit(db, { action: app.access_policy_enabled ? "access_policy.enable" : "access_policy.disable", resource: "application", resourceId: app.id, method: "PUT", path });
    const roles = db.roles.filter((r) => r.application_id === app.id);
    return ok({
      enabled: app.access_policy_enabled,
      default_role_id: def?.id,
      default_role_name: def?.name,
      assignment_trigger: "first_login",
      assignment_source: "default_access",
      role_options: roles.map((r) => ({ role_id: r.id, name: r.name, description: r.description, is_generated: false, recommended: r.is_default, permissions: r.scope_ids.length })),
    });
  }),
);

// ── Agent access requests ───────────────────────────────────────────────
demoRoute("GET", "/authsec/applications/:id/requests", ({ db, params }) =>
  ok({ items: db.requests.filter((r) => r.application_id === params.id).map(({ application_id: _app, ...r }) => r) }),
);

demoRoute("POST", "/authsec/applications/:id/requests/:requestId/approve", ({ db, params, body, path }) =>
  withApp(db, params.id, (app) => {
    const req = db.requests.find((r) => r.request_id === params.requestId && r.application_id === app.id);
    if (!req) return notFound("Request");
    if (req.status !== "pending") return badRequest(`This request was already ${req.status}`);
    req.status = "approved";
    const source = db.clients.find((c) => c.client_id === req.requester_client_id);
    if (source && !db.clients.some((c) => c.client_id === source.client_id && c.resource_server_id === app.id)) {
      db.clients.push({ ...source, id: newId(db), resource_server_id: app.id, resource_server_name: app.name, status: "approved", created_at: nowIso() });
    } else if (source && source.resource_server_id === app.id) {
      source.status = "approved";
    }
    refreshCounts(db);
    const role = db.roles.find((r) => r.id === body.role_id);
    recordAudit(db, { action: "request.approve", resource: "client", resourceId: req.requester_client_id, method: "POST", path });
    return ok({ status: "approved", connection_id: req.requester_client_id, assignment_id: role ? role.id : undefined });
  }),
);

demoRoute("POST", "/authsec/applications/:id/requests/:requestId/deny", ({ db, params, path }) => {
  const req = db.requests.find((r) => r.request_id === params.requestId && r.application_id === params.id);
  if (!req) return notFound("Request");
  req.status = "denied";
  recordAudit(db, { action: "request.deny", resource: "client", resourceId: req.requester_client_id, method: "POST", path });
  return ok({ status: "denied" });
});

demoRoute("POST", "/authsec/applications/:id/connections", ({ db, params, body, path }) =>
  withApp(db, params.id, (app) => {
    const name = String(body.client_name ?? "").trim();
    if (!name) return badRequest("client_name is required");
    const clientId = `nw-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${db.nextSeq.toString(16).padStart(6, "0")}`;
    const kind = (body.client_kind as "agent" | "human_app" | "m2m" | "cli" | undefined) ?? "human_app";
    db.clients.unshift({
      id: newId(db),
      client_id: clientId,
      client_name: name,
      client_kind: kind,
      registration_type: "prereg",
      software_id: body.software_id ? String(body.software_id) : undefined,
      status: "approved",
      sync_status: "active",
      resource_server_id: app.id,
      resource_server_name: app.name,
      redirect_uris: (body.redirect_uris as string[] | undefined) ?? [],
      tags: [],
      adopted_elsewhere: false,
      created_at: nowIso(),
    });
    refreshCounts(db);
    recordAudit(db, { action: "client.register", resource: "client", resourceId: clientId, method: "POST", path });
    return created({ client_id: clientId, client_name: name });
  }),
);

// ── Machine access: workloads and API credentials ───────────────────────
function grantServiceAccount(db: DemoDb, app: ResourceServer, body: Record<string, unknown>, path: string) {
  const role = db.roles.find((r) => r.id === body.role_id && r.application_id === app.id);
  if (!role) return { error: badRequest("Choose a role on this application") };
  let sa = db.serviceAccounts.find((s) => s.id === body.service_account_id);
  if (!sa) {
    const name = String(body.service_account_name ?? "").trim();
    if (!name) return { error: badRequest("Choose an existing service account or name a new one") };
    sa = {
      id: newId(db),
      workspace_id: db.workspaceId,
      name,
      description: String(body.description ?? ""),
      status: "active",
      owner_email: db.actorEmail,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.serviceAccounts.unshift(sa);
  }
  sa.oauth_client_id = sa.oauth_client_id ?? `nw-sa-${sa.name}-${db.nextSeq.toString(16)}`;
  const assignmentId = newId(db);
  db.assignments.push({ id: assignmentId, application_id: app.id, identity_type: "service_account", identity_id: sa.id, role_id: role.id, status: "active", source: "manual", created_at: nowIso() });
  refreshCounts(db);
  recordAudit(db, { action: "service_account.grant", resource: "service_account", resourceId: sa.id, method: "POST", path });
  return { sa, role, assignmentId };
}

demoRoute("GET", "/authsec/applications/:id/workloads", ({ db, params }) =>
  ok({
    items: db.assignments
      .filter((a) => a.application_id === params.id && a.identity_type === "service_account" && a.status === "active")
      .map((a) => db.serviceAccounts.find((s) => s.id === a.identity_id))
      .filter((sa): sa is DemoDb["serviceAccounts"][number] => Boolean(sa?.spiffe_id))
      .map((sa) => ({
        workload_id: `wl-${sa.id.slice(0, 8)}`,
        spiffe_id: sa.spiffe_id!,
        service_account_id: sa.id,
        service_account_name: sa.name,
        status: "active",
        platform: "kubernetes",
        selectors: { "k8s:ns": sa.spiffe_id!.split("/ns/")[1]?.split("/")[0] ?? "default", "k8s:sa": sa.name },
        last_attested_at: sa.last_seen_at,
        last_token_issued_at: sa.last_seen_at,
        created_at: sa.created_at,
      })),
  }),
);

demoRoute("POST", "/authsec/applications/:id/machine-access/workload", ({ db, params, body, path }) =>
  withApp(db, params.id, (app) => {
    const res = grantServiceAccount(db, app, body, path);
    if ("error" in res) return res.error!;
    const ns = (body.selectors as Record<string, string> | undefined)?.["k8s:ns"] ?? "default";
    res.sa.spiffe_id = `spiffe://northwind.example/ns/${ns}/sa/${res.sa.name}`;
    return created({
      workload_id: `wl-${res.sa.id.slice(0, 8)}`,
      spiffe_id: res.sa.spiffe_id,
      service_account_id: res.sa.id,
      service_account_name: res.sa.name,
      client_id: res.sa.oauth_client_id,
      role_id: res.role.id,
      role_name: res.role.name,
      assignment_id: res.assignmentId,
      status: "active",
      platform: String(body.platform ?? "kubernetes"),
      selectors: (body.selectors as Record<string, string> | undefined) ?? {},
      install_snippet: `helm install authsec-agent authsec/workload-agent --set spiffeId=${res.sa.spiffe_id}`,
      token_endpoint: `${ISSUER}/oauth2/token`,
    });
  }),
);

demoRoute("POST", "/authsec/applications/:id/machine-access/api-credential", ({ db, params, body, path }) =>
  withApp(db, params.id, (app) => {
    const res = grantServiceAccount(db, app, body, path);
    if ("error" in res) return res.error!;
    const secret = body.use_client_secret !== false && !body.jwks && !body.jwks_uri;
    return created({
      service_account_id: res.sa.id,
      service_account_name: res.sa.name,
      client_id: res.sa.oauth_client_id,
      client_secret: secret ? "demo_client_secret_shown_once_Hd73" : undefined,
      role_id: res.role.id,
      role_name: res.role.name,
      token_endpoint: `${ISSUER}/oauth2/token`,
      resource: app.resource_uri,
    });
  }),
);

demoRoute("POST", "/authsec/applications/:id/access/workloads", ({ db, params, body, path }) =>
  withApp(db, params.id, (app) => {
    const res = grantServiceAccount(db, app, body, path);
    if ("error" in res) return res.error!;
    return created({
      service_account_id: res.sa.id,
      service_account_name: res.sa.name,
      client_id: res.sa.oauth_client_id,
      role_id: res.role.id,
      role_name: res.role.name,
      assignment_id: res.assignmentId,
      effective_scopes: res.role.scope_ids.map((id) => scopeString(db, id)),
      resource: app.resource_uri,
    });
  }),
);

// ── Token debugger and access simulation ────────────────────────────────
demoRoute("POST", "/authsec/applications/:id/token-test/simulate", ({ db, params, body }) =>
  withApp(db, params.id, (app) => {
    const assignment = db.assignments.find((a) => a.id === body.assignment_id) ??
      db.assignments.find((a) => a.application_id === app.id && a.identity_id === body.service_account_id && (!body.role_id || a.role_id === body.role_id));
    const role = db.roles.find((r) => r.id === (body.role_id ?? assignment?.role_id));
    const sa = db.serviceAccounts.find((s) => s.id === (body.service_account_id ?? assignment?.identity_id));
    const effective = (role?.scope_ids ?? []).map((id) => scopeString(db, id));
    const requested = Array.isArray(body.requested_scopes) && body.requested_scopes.length ? (body.requested_scopes as string[]) : effective;
    const missing = requested.filter((s) => !effective.includes(s));
    const checks = [
      { name: "Application is launched", status: app.state === "ready" ? "pass" : "fail", reason: app.state === "ready" ? undefined : `State is ${app.state}` },
      { name: "Service account is active", status: sa?.status === "active" ? "pass" : "fail", reason: sa ? (sa.status === "active" ? undefined : "Service account is disabled") : "No service account selected" },
      { name: "Role assigned on this application", status: assignment ? "pass" : "fail", reason: assignment ? undefined : "The service account has no role here" },
      { name: "Requested scopes are granted", status: missing.length ? "fail" : "pass", reason: missing.length ? `Not granted by ${role?.name ?? "the role"}: ${missing.join(", ")}` : undefined },
    ] as const;
    const failing = checks.find((c) => c.status === "fail");
    return ok({
      would_mint: !failing,
      subject_type: "service_account",
      effective_scopes: effective.filter((s) => requested.includes(s)),
      expires_in: 900,
      checks,
      failure_bundle: failing ? `Token for ${sa?.name ?? "workload"} → ${app.name} would be refused: ${failing.name} — ${failing.reason}` : undefined,
    });
  }),
);

demoRoute("POST", "/authsec/applications/:id/token-test/simulate-xaa", ({ db, params, body }) =>
  withApp(db, params.id, (app) => {
    const client = db.clients.find((c) => c.client_id === body.client_id);
    const onApp = db.clients.find((c) => c.client_id === body.client_id && c.resource_server_id === app.id);
    const pending = db.requests.find((r) => r.application_id === app.id && r.requester_client_id === body.client_id && r.status === "pending");
    const checks = [
      { name: "Caller is a registered client", status: client ? "pass" : "fail", reason: client ? undefined : "Unknown client_id" },
      { name: "Caller is approved for this application", status: onApp?.status === "approved" ? "pass" : "fail", reason: onApp ? (onApp.status === "approved" ? undefined : `Connection is ${onApp.status}`) : pending ? "An access request is waiting for approval" : "No connection to this application" },
      { name: "Brokering policy allows the exchange", status: onApp?.status === "approved" ? "pass" : "fail" },
    ] as const;
    const failing = checks.find((c) => c.status === "fail");
    return ok({
      would_mint: !failing,
      subject_type: "agent",
      effective_scopes: failing ? [] : app.scopes_supported?.slice(0, 1) ?? [],
      expires_in: 300,
      checks,
      failure_bundle: failing ? `${client?.client_name ?? body.client_id} → ${app.name}: ${failing.name}${"reason" in failing && failing.reason ? ` — ${failing.reason}` : ""}` : undefined,
    });
  }),
);

demoRoute("POST", "/authsec/v1/applications/:id/access-simulations", ({ db, params, body }) =>
  withApp(db, params.id, (app) => {
    const user = db.endUsers.find((u) => u.id === body.user_id);
    const tool = db.tools.find((t) => t.application_id === app.id && (t.id === body.tool_id || t.name === body.tool_name));
    const roles = db.assignments
      .filter((a) => a.application_id === app.id && a.identity_id === user?.id && a.status === "active")
      .map((a) => db.roles.find((r) => r.id === a.role_id)!)
      .filter(Boolean);
    const held = new Set(roles.flatMap((r) => r.scope_ids));
    const toolCovered = tool ? tool.is_public || (tool.scope_ids.length > 0 && tool.scope_ids.every((id) => held.has(id))) : roles.length > 0;
    const trace = [
      { check: "Application launched", state: app.state === "ready" ? "passed" : "failed", detail: `State: ${app.state}` },
      { check: "User is active", state: user?.status === "active" ? "passed" : "failed", detail: user ? `${user.email} is ${user.status}` : "Unknown user" },
      { check: "User holds a role", state: roles.length ? "passed" : "failed", detail: roles.length ? roles.map((r) => r.label).join(", ") : "No role on this application" },
      {
        check: "Role grants the tool's scopes",
        state: toolCovered ? "passed" : "failed",
        detail: tool ? (tool.is_public ? "Tool is public" : tool.scope_ids.length ? `Needs ${tool.scope_ids.map((id) => scopeString(db, id)).join(", ")}` : "Tool is not mapped to any scope, so it is denied") : "No specific tool selected",
      },
    ] as Array<{ check: string; state: "passed" | "failed"; detail: string }>;
    const failed = trace.find((t) => t.state === "failed");
    return ok({
      verdict: failed ? "denied" : "allowed",
      failed_condition: failed?.check,
      safest_fix: failed
        ? failed.check === "User holds a role"
          ? "Assign the default role to this user"
          : failed.check === "Role grants the tool's scopes"
            ? "Map the tool to a scope, or grant a role that includes it"
            : failed.check === "User is active"
              ? "Reactivate the user"
              : "Finish setup and launch the application"
        : undefined,
      reason: failed?.detail,
      application: { id: app.id, name: app.name, launched: app.state === "ready" },
      user: { id: user?.id ?? "", active: user?.status === "active" },
      tool: tool ? { id: tool.id, name: tool.name, public: tool.is_public } : undefined,
      access_path: roles.map((r) => `${user?.email} → ${r.label} → ${r.scope_ids.map((id) => scopeString(db, id)).join(", ")}`),
      decision_trace: trace,
    });
  }),
);

demoRoute("POST", "/authsec/v1/applications/:id/access-change-previews", ({ db, params }) =>
  withApp(db, params.id, (app) => {
    const bindings = db.assignments.filter((a) => a.application_id === app.id && a.status === "active");
    return ok({
      application_id: app.id,
      change_type: "role_change",
      impact: { bindings: bindings.length, users_affected: new Set(bindings.map((b) => b.identity_id)).size, scopes_affected: db.scopes.filter((s) => s.application_id === app.id).length },
    });
  }),
);

demoRoute("POST", "/authsec/v1/applications/:id/evidence-exports", ({ db, params }) =>
  withApp(db, params.id, (app) =>
    ok({
      status: "queued",
      export_type: "access_review",
      requested_at: nowIso(),
      evidence: {
        application_id: app.id,
        tools: db.tools.filter((t) => t.application_id === app.id).length,
        scopes: db.scopes.filter((s) => s.application_id === app.id).length,
        bindings: db.assignments.filter((a) => a.application_id === app.id && a.status === "active").length,
        consent_grants: db.consents.filter((c) => c.resource_server_id === app.id && !c.revoked_at).length,
      },
    }),
  ),
);

// ── Consent grants ──────────────────────────────────────────────────────
demoRoute("GET", "/authsec/consent-grants", ({ db, query }) => {
  const rs = query.get("rs_id");
  const user = query.get("user_id");
  const client = query.get("client_id");
  return ok({
    consent_grants: db.consents
      .filter((c) => (!rs || c.resource_server_id === rs) && (!user || c.user_id === user) && (!client || c.client_id === client))
      .map((c) => ({ ...c, workspace_id: db.workspaceId })),
  });
});

demoRoute("DELETE", "/authsec/consent-grants/:grantId", ({ db, params, path }) => {
  const grant = db.consents.find((c) => c.id === params.grantId);
  if (!grant) return notFound("Consent grant");
  grant.revoked_at = nowIso();
  recordAudit(db, { action: "consent.revoke", resource: "client", resourceId: grant.id, method: "DELETE", path });
  return ok({ status: "revoked" });
});

// ── Workspace posture (dashboard aggregate) ─────────────────────────────
demoRoute("GET", "/authsec/v1/workspaces/:ws/applications/posture-summary", ({ db }) => {
  const queue = db.applications.flatMap((app) => {
    const stats = toolStats(db, app.id);
    const items = [];
    const href = `/applications/${app.id}`;
    if (app.state === "scan_failed") items.push({ application_id: app.id, application: app.name, type: "scan_failed", severity: "high", label: "Tool scan failed", action: "Rescan", href: `${href}/tools` });
    if (stats.unmapped > 0) items.push({ application_id: app.id, application: app.name, type: "unmapped_tools", severity: app.state === "ready" ? "high" : "medium", label: `${stats.unmapped} tools not mapped to a scope`, action: "Map tools", href: `${href}/tools` });
    const pending = db.requests.filter((r) => r.application_id === app.id && r.status === "pending").length;
    if (pending) items.push({ application_id: app.id, application: app.name, type: "pending_requests", severity: "medium", label: `${pending} access request${pending === 1 ? "" : "s"} waiting`, action: "Review", href: `${href}/connections` });
    return items;
  });
  const grants = db.assignments.filter((a) => a.status === "active");
  return ok({
    workspace_id: db.workspaceId,
    generated_at: nowIso(),
    summary: {
      applications: db.applications.length,
      launched: db.applications.filter((a) => a.state === "ready").length,
      tools: db.tools.length,
      unmapped_tools: db.tools.filter((t) => !t.is_public && t.scope_ids.length === 0).length,
      public_tools: db.tools.filter((t) => t.is_public).length,
      risky_scopes: db.scopes.filter((s) => s.risk_level === "high" || s.risk_level === "critical").length,
      access_assignments: grants.length,
      users_with_access: new Set(grants.filter((g) => g.identity_type === "user").map((g) => g.identity_id)).size,
      recommended_actions: queue.length,
    },
    action_queue: queue,
  });
});

