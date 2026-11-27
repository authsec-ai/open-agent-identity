/**
 * Which explanation belongs to which page. A new console area registers its
 * page here and its text in content.ts; nothing in the page itself changes.
 * Patterns use `:param` segments and are tried in order.
 */
const PAGE_EXPLANATIONS: Array<[pattern: string, id: string]> = [
  ["/dashboard", "page.dashboard"],
  ["/", "page.dashboard"],
  ["/admin/users", "page.adminUsers"],
  ["/end-users", "page.endUsers"],
  ["/end-users/:id", "page.endUsers"],
  ["/applications", "page.applications"],
  ["/applications/new", "page.createApplication"],
  ["/applications/:id/overview", "app.overview"],
  ["/applications/:id/setup", "app.setup"],
  ["/applications/:id/tools", "app.tools"],
  ["/applications/:id/scopes", "app.scopes"],
  ["/applications/:id/roles", "app.roles"],
  ["/applications/:id/access-assignments", "app.access"],
  ["/applications/:id/clients", "app.clients"],
  ["/applications/:id/connections", "app.connections"],
  ["/applications/:id/consent-grants", "app.consent"],
  ["/applications/:id/test", "app.test"],
  ["/applications/:id/activity", "app.activity"],
  ["/service-accounts", "page.serviceAccounts"],
  ["/agents", "page.agents"],
  ["/clients", "page.clients"],
  ["/access/roles", "page.roles"],
  ["/admin/authz/roles", "page.roles"],
  ["/access/scopes", "page.scopes"],
  ["/access/assignments", "page.assignments"],
  ["/access/scope-catalog", "page.scopes"],
  ["/identity-providers", "page.identityProviders"],
  ["/scim-connections", "page.scim"],
  ["/directory-sync", "page.directorySync"],
  ["/logs/auth", "page.authLogs"],
  ["/logs/audit", "page.auditLogs"],
  ["/logs/m2m", "page.m2mLogs"],
  ["/settings/team", "page.team"],
  ["/settings/trusted-issuers", "page.trustedIssuers"],
  ["/custom-domains", "page.customDomains"],
  ["/trust-delegation", "page.trustDelegation"],
  ["/trust-delegation/policies", "page.trustDelegation"],
  ["/effective-access", "page.effectiveAccess"],
  ["/consent-grants", "app.consent"],
];

const compiled = PAGE_EXPLANATIONS.map(([pattern, id]) => ({
  regex: new RegExp(`^${pattern.replace(/:[^/]+/g, "[^/]+")}/?$`),
  id,
}));

export function explainIdForPath(pathname: string): string | null {
  return compiled.find((c) => c.regex.test(pathname))?.id ?? null;
}
