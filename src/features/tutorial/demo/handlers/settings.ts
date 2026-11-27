import type { CustomDomain } from "@/app/api/domainApi";
import { badRequest, created, demoRoute, notFound, ok } from "../router";
import { newId, recordAudit, type DemoDb } from "../db";

const nowIso = () => new Date().toISOString();

// ── Custom domains ──────────────────────────────────────────────────────
const DOMAINS = "/authsec/uflow/admin/tenants/:ws/domains";

function findDomain(db: DemoDb, id: string): CustomDomain | undefined {
  return db.domains.find((d) => d.id === id);
}

demoRoute("GET", DOMAINS, ({ db }) => ok({ success: true, domains: db.domains, count: db.domains.length }));

demoRoute("GET", `${DOMAINS}/:domainId`, ({ db, params }) => {
  const d = findDomain(db, params.domainId);
  return d ? ok({ success: true, domain: d }) : notFound("Domain");
});

demoRoute("POST", DOMAINS, ({ db, body, path }) => {
  const name = String(body.domain ?? "").trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(name)) return badRequest("Enter a domain such as login.example.com");
  if (db.domains.some((d) => d.domain === name)) return badRequest(`${name} is already added`);
  const token = `authsec-verify-${db.nextSeq * 9173}`;
  const domain: CustomDomain = {
    id: newId(db),
    workspace_id: db.workspaceId,
    domain: name,
    kind: "custom",
    is_primary: false,
    is_verified: false,
    verification_method: "dns_txt",
    verification_token: token,
    verification_txt_name: `_authsec-challenge.${name}`,
    verification_txt_value: token,
    verified_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.domains.push(domain);
  recordAudit(db, { action: "domain.create", resource: "config", resourceId: domain.id, method: "POST", path });
  return created({ success: true, domain, verification: { method: "dns_txt", txt_name: domain.verification_txt_name, txt_value: token, token } });
});

// Verification always succeeds in the tutorial: there is no DNS to check.
demoRoute("POST", `${DOMAINS}/:domainId/verify`, ({ db, params, path }) => {
  const d = findDomain(db, params.domainId);
  if (!d) return notFound("Domain");
  d.is_verified = true;
  d.verified_at = nowIso();
  d.updated_at = nowIso();
  recordAudit(db, { action: "domain.verify", resource: "config", resourceId: d.id, method: "POST", path });
  return ok({ success: true, message: `${d.domain} verified (tutorial: the TXT record was not actually checked)`, domain: d });
});

demoRoute("POST", `${DOMAINS}/:domainId/set-primary`, ({ db, params, path }) => {
  const d = findDomain(db, params.domainId);
  if (!d) return notFound("Domain");
  if (!d.is_verified) return badRequest("Verify the domain before making it primary");
  db.domains.forEach((x) => (x.is_primary = x.id === d.id));
  recordAudit(db, { action: "domain.set_primary", resource: "config", resourceId: d.id, method: "POST", path });
  return ok({ success: true, message: `${d.domain} is now the primary domain`, domain: d });
});

demoRoute("DELETE", `${DOMAINS}/:domainId`, ({ db, params, path }) => {
  const d = findDomain(db, params.domainId);
  if (!d) return notFound("Domain");
  if (d.kind === "platform") return badRequest("The platform domain cannot be removed");
  db.domains = db.domains.filter((x) => x.id !== d.id);
  recordAudit(db, { action: "domain.delete", resource: "config", resourceId: d.id, method: "DELETE", path });
  return ok({ success: true, message: `${d.domain} removed` });
});

// ── Trust delegation ────────────────────────────────────────────────────
demoRoute("GET", "/authsec/uflow/admin/me/roles-permissions", ({ db }) =>
  ok({ permissions: Array.from(new Set(db.scopes.map((s) => s.scope_string))) }),
);

demoRoute("GET", "/authsec/uflow/delegation-policies", ({ db, query }) => {
  const role = query.get("role_name");
  const agent = query.get("agent_type");
  const client = query.get("client_id");
  const enabled = query.get("enabled");
  return ok({
    policies: db.delegationPolicies.filter(
      (p) => (!role || p.role_name === role) && (!agent || p.agent_type === agent) && (!client || p.client_id === client) && (enabled === null || String(p.enabled) === enabled),
    ),
  });
});

demoRoute("GET", "/authsec/uflow/delegation-policies/:id", ({ db, params }) => {
  const p = db.delegationPolicies.find((x) => x.id === params.id);
  return p ? ok({ policy: p }) : notFound("Delegation policy");
});

demoRoute("POST", "/authsec/uflow/delegation-policies", ({ db, body, path }) => {
  if (!body.role_name || !body.client_id) return badRequest("role_name and client_id are required");
  const client = db.clients.find((c) => c.client_id === body.client_id);
  const policy = {
    id: newId(db),
    workspace_id: db.workspaceId,
    role_name: String(body.role_name),
    agent_type: String(body.agent_type ?? "mcp-agent"),
    allowed_permissions: (body.allowed_permissions as string[] | undefined) ?? [],
    max_ttl_seconds: Number(body.max_ttl_seconds ?? 3600),
    enabled: body.enabled !== false,
    client_id: String(body.client_id),
    client_label: client?.client_name,
    created_by: db.actorEmail,
  };
  db.delegationPolicies.unshift(policy);
  recordAudit(db, { action: "delegation_policy.create", resource: "config", resourceId: policy.id, method: "POST", path });
  return created({ policy });
});

demoRoute("PUT", "/authsec/uflow/delegation-policies/:id", ({ db, params, body, path }) => {
  const p = db.delegationPolicies.find((x) => x.id === params.id);
  if (!p) return notFound("Delegation policy");
  if (typeof body.role_name === "string") p.role_name = body.role_name;
  if (typeof body.agent_type === "string") p.agent_type = body.agent_type;
  if (Array.isArray(body.allowed_permissions)) p.allowed_permissions = body.allowed_permissions as string[];
  if (body.max_ttl_seconds !== undefined) p.max_ttl_seconds = Number(body.max_ttl_seconds);
  if (typeof body.enabled === "boolean") p.enabled = body.enabled;
  if (typeof body.client_id === "string") {
    p.client_id = body.client_id;
    p.client_label = db.clients.find((c) => c.client_id === body.client_id)?.client_name;
  }
  recordAudit(db, { action: "delegation_policy.update", resource: "config", resourceId: p.id, method: "PUT", path });
  return ok({ policy: p });
});

demoRoute("DELETE", "/authsec/uflow/delegation-policies/:id", ({ db, params, path }) => {
  if (!db.delegationPolicies.some((p) => p.id === params.id)) return notFound("Delegation policy");
  db.delegationPolicies = db.delegationPolicies.filter((p) => p.id !== params.id);
  recordAudit(db, { action: "delegation_policy.delete", resource: "config", resourceId: params.id, method: "DELETE", path });
  return ok({ message: "Policy deleted" });
});

// ── Permission resources ────────────────────────────────────────────────
demoRoute("GET", "/authsec/uflow/admin/permissions/resources", ({ db }) =>
  ok({ resources: Array.from(new Set(db.permissions.map((p) => p.resource))) }),
);
