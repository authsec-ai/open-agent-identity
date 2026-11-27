import type { DemoDb } from "../demo/db";
import { GLOSSARY, type HoverInfo } from "./glossary";

const ago = (iso: string | null | undefined): string => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
};

const appName = (db: DemoDb, id: string) => db.applications.find((a) => a.id === id)?.name ?? "an application";
const scopeKey = (db: DemoDb, id: string) => db.scopes.find((s) => s.id === id)?.scope_string ?? "";

function scopeInfo(db: DemoDb, text: string): HoverInfo | null {
  const matches = db.scopes.filter((s) => s.scope_string === text);
  if (!matches.length) return null;
  const s = matches[0];
  const roles = db.roles.filter((r) => matches.some((m) => r.scope_ids.includes(m.id)));
  const tools = db.tools.filter((t) => matches.some((m) => t.scope_ids.includes(m.id)));
  const holders = new Set(
    db.assignments.filter((a) => a.status === "active" && a.identity_type === "user" && roles.some((r) => r.id === a.role_id)).map((a) => a.identity_id),
  );
  return {
    title: `${s.scope_string} · ${s.display_name}`,
    body: `${s.description}. A permission on ${matches.map((m) => appName(db, m.application_id)).join(", ")}.`,
    facts: [
      ["Risk", s.risk_level],
      ["Tools it unlocks", tools.length ? tools.map((t) => t.name).join(", ") : "none yet"],
      ["Roles granting it", roles.length ? roles.map((r) => r.label).join(", ") : "none"],
      ["People holding it", String(holders.size)],
    ],
  };
}

function clientInfo(db: DemoDb, text: string): HoverInfo | null {
  const c = db.clients.find((x) => x.client_id === text || x.client_name === text);
  if (!c) return null;
  const kind = { human_app: "an app a person uses", agent: "an AI agent", m2m: "a background job", cli: "a command-line tool" }[c.client_kind];
  const decisions = db.m2mLogs.filter((l) => l.clientId === c.client_id);
  const denied = decisions.filter((l) => l.gateEffect === "deny").length;
  return {
    title: c.client_name,
    body: `${c.client_name} is ${kind} connected to ${c.resource_server_name}.${c.adopted_elsewhere ? " It belongs to another company's workspace." : ""}`,
    facts: [
      ["Client ID", c.client_id],
      ["Status", c.status.replace("_", " ")],
      ["Last token", ago(c.last_token_issued_at)],
      ["Token decisions (14 days)", decisions.length ? `${decisions.length}, ${denied} denied` : "none"],
    ],
  };
}

function personInfo(db: DemoDb, text: string): HoverInfo | null {
  const email = text.replace(/^@/, "");
  const user = db.endUsers.find((u) => u.email === email || u.username === email || u.name === text);
  if (user) {
    const grants = db.assignments.filter((a) => a.identity_id === user.id && a.status === "active");
    const access = grants.map((g) => `${appName(db, g.application_id)} (${db.roles.find((r) => r.id === g.role_id)?.label ?? "role"})`);
    return {
      title: user.name,
      body: `${user.status === "suspended" ? `Suspended: ${user.suspended_reason ?? "access removed"}. ` : ""}Uses protected applications through apps and agents; every call made for them is checked against this access.`,
      facts: [
        ["Email", user.email],
        ["Access", access.length ? access.join(", ") : "none"],
        ["MFA", user.mfa_enabled ? "on" : "off — a risk"],
        ["Last seen", ago(user.last_login)],
      ],
    };
  }
  const admin = db.admins.find((a) => a.email === email || a.username === email || a.name === text);
  if (admin) {
    return {
      title: admin.name,
      body: "Administers this workspace: can change applications, roles and who has access.",
      facts: [
        ["Role", admin.roles?.[0]?.replace("_", " ") ?? "admin"],
        ["Status", admin.status ?? (admin.active ? "active" : "inactive")],
        ["MFA", admin.mfa_enabled ? "on" : "off"],
        ["Last sign-in", ago(admin.last_login)],
      ],
    };
  }
  return null;
}

function appInfo(db: DemoDb, text: string): HoverInfo | null {
  const app = db.applications.find((a) => a.name === text || a.resource_uri === text);
  if (!app) return null;
  const tools = db.tools.filter((t) => t.application_id === app.id);
  const unmapped = tools.filter((t) => !t.is_public && t.scope_ids.length === 0).length;
  const stateText = { ready: "launched and enforcing", needs_setup: "still in setup", scan_failed: "blocked by a failed tool scan", pending_scan: "waiting for its first scan" }[app.state ?? "needs_setup"];
  return {
    title: app.name,
    body: `A protected server, ${stateText}. Agents reach it at ${app.resource_uri}.`,
    facts: [
      ["Tools", `${tools.length}${unmapped ? `, ${unmapped} denied until mapped` : ""}`],
      ["Scopes", String(app.scopes_count ?? 0)],
      ["People with access", String(app.end_users_count ?? 0)],
      ["Clients", String(app.client_count ?? 0)],
    ],
  };
}

function toolInfo(db: DemoDb, text: string): HoverInfo | null {
  const tool = db.tools.find((t) => t.name === text);
  if (!tool) return null;
  const needs = tool.scope_ids.map((id) => scopeKey(db, id));
  return {
    title: `${tool.name} · ${tool.title}`,
    body: tool.description,
    facts: [
      ["On", appName(db, tool.application_id)],
      ["Needs", tool.is_public ? "nothing (public)" : needs.length ? needs.join(" + ") : "not mapped, so denied for everyone"],
      ...(tool.suggested.length ? ([["SDK suggests", tool.suggested.join(", ")]] as Array<[string, string]>) : []),
      ["Found via", tool.inventory_source.replace("_", " ")],
    ],
  };
}

function roleInfo(db: DemoDb, text: string): HoverInfo | null {
  const lower = text.toLowerCase();
  const role = db.roles.find((r) => r.name === lower || r.label.toLowerCase() === lower);
  if (!role) return null;
  const holders = db.assignments.filter((a) => a.role_id === role.id && a.status === "active").length;
  return {
    title: `${role.label} role`,
    body: `${role.description}. A role on ${appName(db, role.application_id)}.`,
    facts: [
      ["Grants", role.scope_ids.map((id) => scopeKey(db, id)).join(", ") || "nothing yet"],
      ["Held by", `${holders} ${holders === 1 ? "identity" : "identities"}`],
      ["Default", role.is_default ? "yes, new users get it" : "no"],
    ],
  };
}

function serviceAccountInfo(db: DemoDb, text: string): HoverInfo | null {
  const sa = db.serviceAccounts.find((s) => s.name === text || s.oauth_client_id === text || s.spiffe_id === text);
  if (!sa) return null;
  const grants = db.assignments.filter((a) => a.identity_id === sa.id && a.status === "active");
  return {
    title: sa.name,
    body: sa.description ?? "An identity for software.",
    facts: [
      ["Owner", `${sa.owner_email ?? "unassigned"}${sa.owner_team ? ` (${sa.owner_team})` : ""}`],
      ["Proves itself with", sa.spiffe_id ? "Kubernetes workload identity (SPIFFE)" : sa.oauth_client_id ? "client credential" : "nothing yet"],
      ["Can reach", grants.map((g) => appName(db, g.application_id)).join(", ") || "nothing"],
      ["Last seen", ago(sa.last_seen_at)],
    ],
  };
}

function ipInfo(db: DemoDb, text: string): HoverInfo | null {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) return null;
  const events = db.authLogs.filter((l) => l.ipAddress === text);
  const failures = events.filter((l) => l.status === "failure");
  if (text === "185.220.101.47") {
    return {
      title: text,
      body: "A Tor exit node. Every attempt from it was a failed admin sign-in against one account — a password spray.",
      facts: [["Attempts", String(events.length)], ["Failed", String(failures.length)]],
    };
  }
  return {
    title: text,
    body: text.startsWith("198.51.100.") || text === "203.0.113.24" ? "One of Northwind's office or VPN addresses." : "The address the request came from.",
    facts: [["Sign-in events", String(events.length)], ["Failed", String(failures.length)]],
  };
}

/** The indented detail line under a log entry: where it came from, or which token it was. */
function logDetailInfo(db: DemoDb, text: string): HoverInfo | null {
  const ip = /^ip=(\S+)/.exec(text);
  if (ip) return ipInfo(db, ip[1]);
  const token = /^family=(\S+)\s+subject=(\S+)\s+gate=(\S+)\s+pdp_agrees=(\S+)/.exec(text);
  if (token) {
    const [, family, subject, gate, agrees] = token;
    const who = { user: "a person, through an app", agent: "an AI agent", service_account: "a service account" }[subject] ?? subject;
    return {
      title: "Token details",
      body: `Requested for ${who}. The gate ${gate === "permit" ? "issued" : "refused"} it${agrees === "true" ? ", and the policy engine agreed." : ", but the policy engine disagreed — review the policy for this case."}`,
      facts: [["Token family", family], ["Policy and gate agree", agrees === "true" ? "yes" : "no"]],
    };
  }
  return null;
}

/** Explains one line of the M2M, auth or audit log consoles. */
function logLineInfo(db: DemoDb, text: string): HoverInfo | null {
  if (!text.startsWith("[20")) return logDetailInfo(db, text);
  const m2m = /\]\s+(PERMIT|DENY)\s+client=(\S+)\s+rs=(\S+)/.exec(text);
  if (m2m) {
    const [, effect, clientId, rsId] = m2m;
    const client = db.clients.find((c) => c.client_id === clientId);
    const row = db.m2mLogs.find((l) => l.clientId === clientId && l.resourceServerId === rsId && (effect === "DENY") === (l.gateEffect === "deny"));
    return {
      title: effect === "PERMIT" ? "Token issued" : "Token refused",
      body: `${client?.client_name ?? clientId} asked ${appName(db, rsId)} for access${effect === "PERMIT" ? " and got it." : " and was refused."}${row?.pdpReason ? ` Reason: ${row.pdpReason}.` : ""}`,
      facts: row ? [["Asked for", row.scopesRequested || "—"], ["Got", row.scopesGranted || "nothing"]] : undefined,
    };
  }
  const auth = /\]\s+(SUCCESS|FAILURE)\s+\[(\w+)\]\s+user=(\S+)\s+action=(\S+)/.exec(text);
  if (auth) {
    const [, status, realm, user, action] = auth;
    const what = GLOSSARY.get(action.toLowerCase())?.title ?? action;
    return {
      title: `${what}: ${status.toLowerCase()}`,
      body: `${user} (${realm === "admin" ? "console admin" : "application user"}). ${status === "FAILURE" ? "Look for repeats from the same address or against the same account." : "A normal sign-in event."}`,
    };
  }
  const audit = /\]\s+(LOW|MEDIUM|HIGH|CRITICAL)\s+(\w+)\s+actor=\S*\s+action=(\w+)\s+resource=(\S+)/.exec(text);
  if (audit) {
    const [, severity, category, action, resource] = audit;
    return {
      title: `Admin change: ${action.toLowerCase()}`,
      body: `A ${category.toLowerCase()} change to ${resource}. Severity is ${severity.toLowerCase()}: deletions, disabled controls and refused actions rank higher.`,
    };
  }
  return null;
}

const LOOKUPS = [logLineInfo, scopeInfo, clientInfo, personInfo, appInfo, toolInfo, serviceAccountInfo, roleInfo, ipInfo];

/** The explanation for a piece of on-screen text, or null when there is nothing useful to say. */
export function explainText(db: DemoDb, raw: string): HoverInfo | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text.length > 160) return null;
  for (const lookup of LOOKUPS) {
    const info = lookup(db, text);
    if (info) return info;
  }
  return GLOSSARY.get(text.toLowerCase()) ?? null;
}
