export const DOCS_BASE = "https://docs.authsec.dev";

/** Docs pages the console links to. Every URL here was checked to exist. */
export const DOCS = {
  home: DOCS_BASE,
  dashboard: `${DOCS_BASE}/getting-started/dashboard-overview`,
  protectApplication: `${DOCS_BASE}/lifecycle`,
  registerApplication: `${DOCS_BASE}/lifecycle/register`,
  setupApplication: `${DOCS_BASE}/lifecycle/setup`,
  testApplication: `${DOCS_BASE}/lifecycle/test`,
  toolInventory: `${DOCS_BASE}/lifecycle/tool-inventory`,
  defineScopes: `${DOCS_BASE}/lifecycle/define-scopes`,
  rolesAndAccess: `${DOCS_BASE}/lifecycle/roles-and-access`,
  launch: `${DOCS_BASE}/lifecycle/launch`,
  clients: `${DOCS_BASE}/lifecycle/clients`,
  monitor: `${DOCS_BASE}/lifecycle/monitor`,
  connect: `${DOCS_BASE}/connect`,
  agents: `${DOCS_BASE}/connect/idjag-agents`,
  workloadIdentity: `${DOCS_BASE}/connect/kubernetes-spiffe`,
  sso: `${DOCS_BASE}/sso`,
  oidcSetup: `${DOCS_BASE}/sso/oidc-setup`,
  samlSetup: `${DOCS_BASE}/sso/saml-setup`,
  scopes: `${DOCS_BASE}/concepts/what-are-scopes`,
  roleBindings: `${DOCS_BASE}/concepts/groups-and-role-bindings`,
  userTaxonomy: `${DOCS_BASE}/concepts/user-taxonomy`,
  administration: `${DOCS_BASE}/administration`,
} as const;

/**
 * The docs page for each console page. Patterns use `:param` segments and are
 * tried in order. Pages with no matching docs page (custom domains, trust
 * delegation) are left out rather than linked somewhere approximate.
 */
const PAGE_DOCS: Array<[pattern: string, href: string]> = [
  ["/dashboard", DOCS.dashboard],
  ["/applications", DOCS.protectApplication],
  ["/applications/new", DOCS.registerApplication],
  ["/applications/:id/overview", DOCS.launch],
  ["/applications/:id/setup", DOCS.setupApplication],
  ["/applications/:id/tools", DOCS.toolInventory],
  ["/applications/:id/scopes", DOCS.defineScopes],
  ["/applications/:id/roles", DOCS.rolesAndAccess],
  ["/applications/:id/access-assignments", DOCS.rolesAndAccess],
  ["/applications/:id/clients", DOCS.clients],
  ["/applications/:id/connections", DOCS.connect],
  ["/applications/:id/consent-grants", DOCS.clients],
  ["/applications/:id/test", DOCS.testApplication],
  ["/applications/:id/activity", DOCS.monitor],
  ["/service-accounts", DOCS.connect],
  ["/agents", DOCS.agents],
  ["/clients", DOCS.clients],
  ["/admin/users", DOCS.administration],
  ["/settings/team", DOCS.administration],
  ["/end-users", DOCS.userTaxonomy],
  ["/access/roles", DOCS.rolesAndAccess],
  ["/admin/authz/roles", DOCS.rolesAndAccess],
  ["/access/scopes", DOCS.scopes],
  ["/access/scope-catalog", DOCS.scopes],
  ["/access/assignments", DOCS.roleBindings],
  ["/authz/effective-access", DOCS.roleBindings],
  ["/identity-providers", DOCS.sso],
  ["/identity-providers/create", DOCS.oidcSetup],
  ["/identity-providers/oidc/edit/:id", DOCS.oidcSetup],
  ["/identity-providers/saml/create", DOCS.samlSetup],
  ["/identity-providers/saml/edit/:id", DOCS.samlSetup],
  ["/scim-connections", DOCS.sso],
  ["/directory-sync", DOCS.sso],
  ["/logs/auth", DOCS.monitor],
  ["/logs/audit", DOCS.monitor],
  ["/logs/m2m", DOCS.monitor],
  ["/settings/trusted-issuers", DOCS.workloadIdentity],
];

const compiled = PAGE_DOCS.map(([pattern, href]) => ({
  regex: new RegExp(`^${pattern.replace(/:[^/]+/g, "[^/]+")}/?$`),
  href,
}));

export function docsForPath(pathname: string): string | null {
  return compiled.find((c) => c.regex.test(pathname))?.href ?? null;
}
