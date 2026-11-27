import type { AdminUser } from "@/app/api/admin/usersApi";
import type { TenantEndUserState, TenantMembership } from "@/app/api/membershipApi";
import { badRequest, created, demoRoute, notFound, ok, type DemoRequest } from "../router";
import { newId, recordAudit, refreshCounts, type DemoDb, type DemoEndUser } from "../db";

const nowIso = () => new Date().toISOString();

function paginate<T>(rows: T[], body: Record<string, unknown>) {
  const page = Math.max(1, Number(body.page) || 1);
  const limit = Math.max(1, Number(body.limit) || 50);
  return {
    users: rows.slice((page - 1) * limit, page * limit),
    total: rows.length,
    page,
    limit,
    total_pages: Math.max(1, Math.ceil(rows.length / limit)),
  };
}

function matchesSearch(row: { email: string; name: string }, body: Record<string, unknown>) {
  const needle = String(body.email ?? body.name ?? "").toLowerCase().trim();
  return !needle || row.email.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle);
}

function filterActive<T extends { active: boolean }>(rows: T[], body: Record<string, unknown>) {
  if (body.active === undefined) return rows;
  const want = body.active === true || body.active === "true";
  return rows.filter((r) => r.active === want);
}

function endUserAsUserRow(db: DemoDb, u: DemoEndUser): AdminUser {
  const roleNames = db.assignments
    .filter((a) => a.identity_id === u.id && a.status === "active")
    .map((a) => db.roles.find((r) => r.id === a.role_id)?.name)
    .filter((n): n is string => Boolean(n));
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    first_name: u.name.split(" ")[0],
    last_name: u.name.split(" ").slice(1).join(" "),
    active: u.active,
    status: u.status,
    roles: Array.from(new Set(roleNames)),
    groups: [],
    created_at: u.created_at,
    updated_at: u.created_at,
    last_login: u.last_login ?? undefined,
    mfa_enabled: u.mfa_enabled,
    mfa_method: u.mfa_method,
    mfa_verified: u.mfa_enabled,
    workspace_id: db.workspaceId,
    provider: u.provider,
    provider_name: u.provider === "entra" ? "Microsoft Entra ID" : "Okta",
    is_synced_user: true,
    is_synced: true,
    sync_source: u.provider === "entra" ? "entra_id" : "scim",
    accepted_invite: true,
  };
}

export function endUserState(db: DemoDb, u: DemoEndUser): TenantEndUserState {
  const grants = db.assignments.filter((a) => a.identity_type === "user" && a.identity_id === u.id && a.status === "active");
  const applications = grants.map((g) => {
    const app = db.applications.find((a) => a.id === g.application_id)!;
    const role = db.roles.find((r) => r.id === g.role_id)!;
    return {
      application_id: app.id,
      name: app.name,
      resource_uri: app.resource_uri,
      role_id: role.id,
      role_name: role.name,
      role_label: role.label,
      binding_id: g.id,
      scopes_count: role.scope_ids.length,
    };
  });
  const scopes = new Set(grants.flatMap((g) => db.roles.find((r) => r.id === g.role_id)?.scope_ids ?? []));
  return {
    workspace_id: db.workspaceId,
    user_id: u.id,
    status: u.status,
    plan_tier: u.plan_tier,
    first_consent_at: u.first_consent_at,
    last_seen_at: u.last_login,
    suspended_at: u.status === "suspended" ? u.last_login : null,
    suspended_by: u.status === "suspended" ? "marcus.chen@northwind.example" : null,
    suspended_reason: u.suspended_reason ?? null,
    created_at: u.created_at,
    updated_at: u.created_at,
    user_email: u.email,
    user_name: u.name,
    user_username: u.username,
    user_last_login: u.last_login,
    access_summary: applications.length
      ? applications.map((a) => `${a.name} · ${a.role_label}`).join(", ")
      : "No application access",
    applications_count: new Set(applications.map((a) => a.application_id)).size,
    effective_scopes_count: scopes.size,
    applications,
  };
}

function membershipView(db: DemoDb, a: AdminUser): TenantMembership {
  const role = a.roles?.[0] ?? "admin";
  return {
    id: `m-${a.id}`,
    workspace_id: db.workspaceId,
    user_id: a.id,
    status: a.status === "invited" ? "invited" : a.active ? "active" : "suspended",
    membership_type: (["owner", "admin", "member", "contractor", "service_operator", "readonly_auditor"].includes(role) ? role : "admin") as TenantMembership["membership_type"],
    source: a.provider === "okta" ? "scim" : "invite",
    invited_by: null,
    joined_at: a.accepted_invite ? a.created_at : null,
    created_at: a.created_at,
    updated_at: a.updated_at,
    user_email: a.email,
    user_name: a.name,
    user_username: a.username,
    user_last_login: a.last_login ?? null,
  };
}

function setEndUserStatus(db: DemoDb, userId: string, status: "active" | "suspended", reason: string | undefined, req: DemoRequest) {
  const u = db.endUsers.find((x) => x.id === userId);
  if (!u) return notFound("End user");
  u.status = status;
  u.active = status === "active";
  u.suspended_reason = status === "suspended" ? reason || "Suspended from the console" : undefined;
  recordAudit(db, { action: status === "active" ? "user.reactivate" : "user.suspend", resource: "end_user", resourceId: u.id, method: req.method, path: req.path });
  return ok(endUserState(db, u));
}

// ── Admin users (the console team) ─────────────────────────────────────
demoRoute("POST", "/authsec/uflow/admin/users/list", ({ db, body }) =>
  ok(paginate(filterActive(db.admins, body).filter((a) => matchesSearch(a, body)), body)),
);

demoRoute("DELETE", "/authsec/uflow/admin/users/:userId", ({ db, params, path }) => {
  if (!db.admins.some((a) => a.id === params.userId)) return notFound("Admin user");
  db.admins = db.admins.filter((a) => a.id !== params.userId);
  recordAudit(db, { action: "user.delete", resource: "admin_user", resourceId: params.userId, method: "DELETE", path });
  return ok({ success: true });
});

demoRoute("POST", "/authsec/uflow/admin/users/active", ({ db, body, path }) => {
  const a = db.admins.find((x) => x.id === body.user_id);
  if (!a) return notFound("Admin user");
  a.active = body.active === true || body.active === "true";
  a.status = a.active ? "active" : "inactive";
  a.updated_at = nowIso();
  recordAudit(db, { action: a.active ? "user.activate" : "user.deactivate", resource: "admin_user", resourceId: a.id, method: "POST", path });
  return ok({ success: true });
});

demoRoute("POST", "/authsec/uflow/admin/invite", ({ db, body, path }) => {
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) return badRequest("A valid email is required");
  if (db.admins.some((a) => a.email === email)) return badRequest(`${email} is already a member of this workspace`);
  const first = String(body.first_name ?? email.split("@")[0]);
  const last = String(body.last_name ?? "");
  const id = newId(db);
  db.admins.push({
    id,
    email,
    username: String(body.username ?? email.split("@")[0]),
    name: `${first} ${last}`.trim(),
    first_name: first,
    last_name: last,
    active: true,
    status: "invited",
    roles: Array.isArray(body.roles) && body.roles.length ? (body.roles as string[]) : ["admin"],
    groups: [],
    created_at: nowIso(),
    updated_at: nowIso(),
    mfa_enabled: false,
    workspace_id: db.workspaceId,
    provider: "password",
    accepted_invite: false,
  });
  recordAudit(db, { action: "user.invite", resource: "admin_user", resourceId: id, method: "POST", path });
  return created({ success: true, message: `Invitation sent to ${email} (tutorial: no email is sent)`, user_id: id });
});

for (const realm of ["users", "enduser"]) {
  for (const kind of ["ad", "entra"]) {
    demoRoute("POST", `/authsec/uflow/admin/${realm}/${kind}/status`, ({ db }) => {
      const cfg = db.syncConfigs.find((c) => c.sync_type === (kind === "ad" ? "active_directory" : "entra_id"));
      return ok(
        cfg
          ? { configured: true, last_sync: cfg.last_sync_at, user_count: cfg.last_sync_users_count, status: "active" }
          : { configured: false },
      );
    });
  }
}

for (const action of ["reset-password", "change-password"]) {
  demoRoute("POST", `/authsec/uflow/user/admin/${action}`, ({ db, body, path }) => {
    recordAudit(db, { action: `user.${action.replace("-", "_")}`, resource: "user", resourceId: String(body.email ?? ""), method: "POST", path });
    return ok({ success: true, message: "Done (tutorial: no email is sent and no password changes)" });
  });
}

// ── End users ───────────────────────────────────────────────────────────
demoRoute("POST", "/authsec/uflow/admin/enduser/list", ({ db, body }) =>
  ok(paginate(filterActive(db.endUsers, body).filter((u) => matchesSearch(u, body)).map((u) => endUserAsUserRow(db, u)), body)),
);

demoRoute("POST", "/authsec/uflow/admin/enduser/active", ({ db, body, ...rest }) =>
  setEndUserStatus(db, String(body.user_id ?? ""), body.active === true || body.active === "true" ? "active" : "suspended", undefined, { db, body, ...rest }),
);

demoRoute("DELETE", "/authsec/uflow/user/enduser/:ws/:userId", ({ db, params, path }) => {
  if (!db.endUsers.some((u) => u.id === params.userId)) return notFound("End user");
  db.endUsers = db.endUsers.filter((u) => u.id !== params.userId);
  db.assignments = db.assignments.filter((a) => a.identity_id !== params.userId);
  refreshCounts(db);
  recordAudit(db, { action: "user.delete", resource: "end_user", resourceId: params.userId, method: "DELETE", path });
  return ok({ success: true });
});

demoRoute("GET", "/authsec/uflow/v2/tenants/:ws/end-users", ({ db, query }) => {
  const status = query.get("status");
  const q = query.get("q")?.toLowerCase();
  const items = db.endUsers
    .filter((u) => !status || u.status === status)
    .filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q))
    .map((u) => endUserState(db, u));
  return ok({ items, count: items.length });
});

demoRoute("GET", "/authsec/uflow/v2/tenants/:ws/end-users/:userId", ({ db, params }) => {
  const u = db.endUsers.find((x) => x.id === params.userId);
  return u ? ok(endUserState(db, u)) : notFound("End user");
});

demoRoute("PATCH", "/authsec/uflow/v2/tenants/:ws/end-users/:userId", (req) => {
  const u = req.db.endUsers.find((x) => x.id === req.params.userId);
  if (!u) return notFound("End user");
  if (typeof req.body.plan_tier === "string") u.plan_tier = req.body.plan_tier;
  if (req.body.status === "active" || req.body.status === "suspended") {
    return setEndUserStatus(req.db, u.id, req.body.status, undefined, req);
  }
  return ok(endUserState(req.db, u));
});

demoRoute("POST", "/authsec/uflow/v2/tenants/:ws/end-users/:userId/suspend", (req) =>
  setEndUserStatus(req.db, req.params.userId, "suspended", String(req.body.reason ?? ""), req),
);

demoRoute("POST", "/authsec/uflow/v2/tenants/:ws/end-users/:userId/reactivate", (req) =>
  setEndUserStatus(req.db, req.params.userId, "active", undefined, req),
);

// ── Team memberships ─────────────────────────────────────────────────────
demoRoute("GET", "/authsec/uflow/v2/tenants/:ws/memberships", ({ db, query }) => {
  const status = query.get("status");
  const items = db.admins.map((a) => membershipView(db, a)).filter((m) => !status || m.status === status);
  return ok({ items, count: items.length });
});

demoRoute("PATCH", "/authsec/uflow/v2/tenants/:ws/memberships/:userId", ({ db, params, body, path }) => {
  const a = db.admins.find((x) => x.id === params.userId);
  if (!a) return notFound("Member");
  if (typeof body.membership_type === "string") a.roles = [body.membership_type];
  if (body.status === "suspended") {
    a.active = false;
    a.status = "inactive";
  } else if (body.status === "active") {
    a.active = true;
    a.status = "active";
  }
  recordAudit(db, { action: "membership.update", resource: "admin_user", resourceId: a.id, method: "PATCH", path });
  return ok(membershipView(db, a));
});

demoRoute("DELETE", "/authsec/uflow/v2/tenants/:ws/memberships/:userId", ({ db, params, path }) => {
  if (!db.admins.some((a) => a.id === params.userId)) return notFound("Member");
  db.admins = db.admins.filter((a) => a.id !== params.userId);
  recordAudit(db, { action: "membership.delete", resource: "admin_user", resourceId: params.userId, method: "DELETE", path });
  return ok({});
});
