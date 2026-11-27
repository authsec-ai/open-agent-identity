import type { AuditLogRow, AuthLogRow, DemoDb, M2MLogRow } from "./db";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Small seeded PRNG: the same seed always yields the same history. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/17.5",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0",
  "Claude-Desktop/1.9.2 (darwin)",
];

const OFFICE_IPS = ["198.51.100.14", "198.51.100.27", "198.51.100.63", "203.0.113.24"];
const ATTACKER_IP = "185.220.101.47";

/**
 * Builds two weeks of history. Most of it is routine traffic; a few planted
 * incidents give the tutorial something to investigate:
 *  - a password-spray against marcus.chen from a Tor exit node (2 days ago)
 *  - Release Bot repeatedly asking the Payments Ledger for payouts:approve
 *  - Support Copilot attempting a bulk customer export
 *  - a token minted for the legacy Zapier client after it was revoked
 */
export function buildActivity(db: DemoDb): void {
  const rand = mulberry32(20_241_127);
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
  const ts = (msAgo: number) => new Date(db.now - msAgo).toISOString();

  // ── Authentication ────────────────────────────────────────────────────
  const auth: Array<Omit<AuthLogRow, "id">> = [];
  const authRow = (msAgo: number, row: Partial<AuthLogRow> & Pick<AuthLogRow, "userId" | "action" | "actorRealm">) =>
    auth.push({
      timestamp: ts(msAgo),
      requestId: `req-${Math.floor(rand() * 1e9).toString(36)}`,
      workspaceId: db.workspaceId,
      status: "success",
      ipAddress: pick(OFFICE_IPS),
      userAgent: pick(USER_AGENTS),
      ...row,
    });

  for (let day = 0; day < 14; day++) {
    for (const admin of db.admins.filter((a) => a.active && a.accepted_invite)) {
      if (rand() < 0.25) continue;
      const base = (day + rand()) * DAY;
      authRow(base, { userId: admin.email, actorRealm: "admin", action: "admin.login" });
      authRow(base - 40_000, { userId: admin.email, actorRealm: "admin", action: "mfa.verify" });
    }
    for (const user of db.endUsers) {
      if (user.status === "suspended" && day < 9) continue;
      if (rand() < 0.45) continue;
      const base = (day + rand()) * DAY;
      const failed = rand() < 0.05;
      authRow(base, {
        userId: user.email,
        actorRealm: "enduser",
        action: "enduser.login",
        status: failed ? "failure" : "success",
        error: failed ? "invalid_credentials" : undefined,
      });
      if (!failed && user.mfa_enabled) {
        authRow(base - 25_000, { userId: user.email, actorRealm: "enduser", action: "mfa.verify" });
      }
      if (!failed && rand() < 0.5) {
        authRow(base - 3 * HOUR, { userId: user.email, actorRealm: "enduser", action: "token.refresh" });
      }
    }
  }
  // Password spray against an admin, from one Tor exit node.
  for (let i = 0; i < 9; i++) {
    authRow(2 * DAY + 3 * HOUR - i * 47_000, {
      userId: "marcus.chen@northwind.example",
      actorRealm: "admin",
      action: "admin.login",
      status: "failure",
      error: i === 0 ? "account_temporarily_locked" : "invalid_credentials",
      ipAddress: ATTACKER_IP,
      userAgent: "python-requests/2.31.0",
    });
  }
  // A suspended contractor still trying to sign in.
  authRow(5 * HOUR, {
    userId: "victor.petrov@brightpath-consulting.example",
    actorRealm: "enduser",
    action: "enduser.login",
    status: "failure",
    error: "user_suspended",
  });

  auth.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  db.authLogs = auth.map((row, i) => ({ id: auth.length - i, ...row }));

  // ── M2M token decisions ───────────────────────────────────────────────
  const m2m: Array<Omit<M2MLogRow, "id">> = [];
  const byName = (name: string) => db.clients.find((c) => c.client_name === name)!;
  const appOf = (name: string) => db.applications.find((a) => a.name === name)!;
  const m2mRow = (msAgo: number, row: Omit<M2MLogRow, "id" | "createdAt" | "workspaceId" | "tokenFamily">) =>
    m2m.push({
      createdAt: ts(msAgo),
      workspaceId: db.workspaceId,
      tokenFamily: `tf-${Math.floor(rand() * 1e10).toString(36)}`,
      ...row,
    });

  const routine: Array<{ client: string; app: string; subject: string; scopes: string[]; perDay: number }> = [
    { client: "Support Copilot", app: "Customer Data API", subject: "agent", scopes: ["customers:read"], perDay: 9 },
    { client: "Release Bot", app: "GitHub MCP Server", subject: "agent", scopes: ["repo:read", "pull_requests:write"], perDay: 4 },
    { client: "Code Review Agent", app: "GitHub MCP Server", subject: "agent", scopes: ["repo:read", "pull_requests:write"], perDay: 5 },
    { client: "Finance Reconciler", app: "Payments Ledger MCP", subject: "agent", scopes: ["ledger:read"], perDay: 3 },
    { client: "Billing Sync", app: "Payments Ledger MCP", subject: "service_account", scopes: ["ledger:read", "invoices:create"], perDay: 4 },
    { client: "Nightly ETL", app: "Customer Data API", subject: "service_account", scopes: ["customers:read", "customers:export"], perDay: 1 },
    { client: "Claude Desktop", app: "GitHub MCP Server", subject: "user", scopes: ["repo:read"], perDay: 6 },
    { client: "Cursor", app: "GitHub MCP Server", subject: "user", scopes: ["repo:read", "repo:write"], perDay: 4 },
  ];
  for (let day = 0; day < 14; day++) {
    for (const r of routine) {
      const client = byName(r.client);
      const app = appOf(r.app);
      for (let n = 0; n < r.perDay; n++) {
        if (rand() < 0.2) continue;
        const scopes = r.scopes.join(" ");
        m2mRow(day * DAY + rand() * DAY, {
          clientId: client.client_id,
          subjectType: r.subject,
          resourceServerId: app.id,
          pdpEffect: "permit",
          gateEffect: "permit",
          pdpAgrees: true,
          scopesRequested: scopes,
          scopesGranted: scopes,
        });
      }
    }
  }
  // Release Bot keeps asking the ledger for payouts it was never granted.
  for (const hoursAgo of [2, 7, 13, 19]) {
    m2mRow(hoursAgo * HOUR, {
      clientId: byName("Release Bot").client_id,
      subjectType: "agent",
      resourceServerId: appOf("Payments Ledger MCP").id,
      pdpEffect: "deny",
      gateEffect: "deny",
      pdpAgrees: true,
      scopesRequested: "ledger:read payouts:approve",
      scopesGranted: "",
      pdpReason: "client has no role on this application; payouts:approve is critical risk",
    });
  }
  // Support Copilot tried to export customers beyond its support-agent role.
  m2mRow(26 * HOUR, {
    clientId: byName("Support Copilot").client_id,
    subjectType: "agent",
    resourceServerId: appOf("Customer Data API").id,
    pdpEffect: "deny",
    gateEffect: "deny",
    pdpAgrees: true,
    scopesRequested: "customers:read customers:export",
    scopesGranted: "customers:read",
    pdpReason: "customers:export is not granted by role support-agent",
  });
  // The policy engine and the gate disagreed once — worth a look.
  m2mRow(3 * DAY + 4 * HOUR, {
    clientId: byName("Cursor").client_id,
    subjectType: "user",
    resourceServerId: appOf("GitHub MCP Server").id,
    pdpEffect: "no_policy",
    gateEffect: "permit",
    pdpAgrees: false,
    scopesRequested: "repo:read",
    scopesGranted: "repo:read",
    pdpReason: "no policy matched; gate fell back to the default role",
  });

  m2m.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  db.m2mLogs = m2m.map((row, i) => ({ id: `m2m-${(m2m.length - i).toString().padStart(5, "0")}`, ...row }));

  // ── Admin audit trail ─────────────────────────────────────────────────
  const audit: Array<Omit<AuditLogRow, "id">> = [];
  const admin = (handle: string) => `${handle}@northwind.example`;
  const auditRow = (
    msAgo: number,
    who: string,
    action: string,
    resource: string,
    resourceId: string,
    method: string,
    path: string,
    status: "success" | "failure" = "success",
    error?: string,
  ) =>
    audit.push({
      timestamp: ts(msAgo),
      requestId: `req-${Math.floor(rand() * 1e9).toString(36)}`,
      workspaceId: db.workspaceId,
      actorRealm: "admin",
      userId: admin(who),
      action,
      resource,
      resourceId,
      method,
      path,
      statusCode: status === "success" ? 200 : 403,
      status,
      ipAddress: pick(OFFICE_IPS),
      userAgent: USER_AGENTS[0],
      error,
    });

  const app = (name: string) => appOf(name).id;
  const role = (appName: string, roleName: string) =>
    db.roles.find((r) => r.application_id === app(appName) && r.name === roleName)?.id ?? "";
  auditRow(2 * HOUR, "priya.raman", "application.scan", "application", app("Jira Ops MCP"), "POST", "/authsec/applications/:id/rescan", "failure", "manifest endpoint returned 503");
  auditRow(5 * HOUR, "marcus.chen", "user.suspend", "end_user", db.endUsers[19].id, "POST", "/authsec/uflow/v2/tenants/:ws/end-users/:id/suspend");
  auditRow(26 * HOUR, "elena.rossi", "application.create", "application", app("Jira Ops MCP"), "POST", "/authsec/applications");
  auditRow(2 * DAY, "sofia.martins", "user.invite", "admin_user", db.admins[5].id, "POST", "/authsec/uflow/admin/invite");
  auditRow(2 * DAY + 2 * HOUR, "marcus.chen", "user.lock", "admin_user", db.admins[1].id, "POST", "/authsec/uflow/admin/users/active");
  auditRow(3 * DAY, "priya.raman", "role.update_scopes", "role", role("Payments Ledger MCP", "treasury-approver"), "PUT", "/authsec/applications/:id/roles/:rid/scope-grants");
  auditRow(4 * DAY, "elena.rossi", "application.create", "application", app("Knowledge Base MCP"), "POST", "/authsec/applications");
  auditRow(4 * DAY + 3 * HOUR, "daniel.okafor", "role.create", "role", role("GitHub MCP Server", "release-manager"), "POST", "/authsec/applications/:id/roles", "failure", "readonly_auditor cannot create roles");
  auditRow(5 * DAY, "marcus.chen", "client.approve", "client", byName("Code Review Agent").id, "PUT", "/authsec/applications/:id/connections/:cid/approve");
  auditRow(6 * DAY, "priya.raman", "access_policy.enable", "application", app("Payments Ledger MCP"), "PUT", "/authsec/applications/:id/access-policy");
  auditRow(7 * DAY, "marcus.chen", "client.revoke", "client", byName("Zapier Bridge (legacy)").id, "DELETE", "/authsec/applications/:id/connections/:cid");
  auditRow(8 * DAY, "elena.rossi", "service_account.disable", "service_account", db.serviceAccounts[5].id, "PUT", "/authsec/uflow/admin/service-accounts/:id");
  auditRow(9 * DAY, "priya.raman", "sync_config.update", "sync_config", "sync-entra", "PUT", "/authsec/uflow/admin/sync-configs/update");
  auditRow(10 * DAY, "marcus.chen", "user.suspend", "end_user", db.endUsers[13].id, "POST", "/authsec/uflow/v2/tenants/:ws/end-users/:id/suspend");
  auditRow(11 * DAY, "elena.rossi", "assignment.create", "assignment", db.assignments[0]?.id ?? "", "POST", "/authsec/applications/:id/access-assignments/users");
  auditRow(12 * DAY, "priya.raman", "identity_provider.disable", "auth_method", db.identityProviders[2].id, "PUT", "/authsec/identity-providers/:id");
  auditRow(13 * DAY, "marcus.chen", "role.create", "role", role("Customer Data API", "data-steward"), "POST", "/authsec/applications/:id/roles");

  audit.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  db.auditLogs = audit.map((row, i) => ({ id: audit.length - i, ...row }));
}
