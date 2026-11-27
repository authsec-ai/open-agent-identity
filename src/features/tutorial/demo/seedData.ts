import type { RiskLevel } from "./db";

/** `.example` is reserved (RFC 2606), so no demo address can reach a real mailbox. */
export const DEMO_DOMAIN = "northwind.example";
export const PARTNER_DOMAIN = "brightpath-consulting.example";

type AppState = "pending_scan" | "needs_setup" | "ready" | "scan_failed";

interface AppDef {
  key: string;
  name: string;
  url: string;
  path: string;
  state: AppState;
  tools: number;
  createdDaysAgo: number;
  lastScanHoursAgo: number;
  scanError?: string;
  accessIssue?: string;
  scopes: Array<{ key: string; label: string; description: string; risk: RiskLevel }>;
  roles: Array<{ name: string; label: string; description: string; isDefault: boolean; scopes: string[] }>;
}

export const APPS: AppDef[] = [
  {
    key: "github",
    name: "GitHub MCP Server",
    url: "https://mcp-github.northwind.example",
    path: "/mcp",
    state: "ready",
    tools: 14,
    createdDaysAgo: 128,
    lastScanHoursAgo: 3,
    scopes: [
      { key: "repo:read", label: "Read repositories", description: "Browse code, branches and commit history", risk: "low" },
      { key: "issues:write", label: "Manage issues", description: "Open, comment on and close issues", risk: "low" },
      { key: "repo:write", label: "Push code", description: "Create branches and push commits", risk: "medium" },
      { key: "pull_requests:write", label: "Manage pull requests", description: "Open, review and merge pull requests", risk: "medium" },
      { key: "actions:run", label: "Run workflows", description: "Trigger CI/CD workflows, including deploys", risk: "high" },
      { key: "admin:org", label: "Administer organisation", description: "Change org members, teams and settings", risk: "critical" },
    ],
    roles: [
      { name: "viewer", label: "Viewer", description: "Read-only access for every employee", isDefault: true, scopes: ["repo:read", "issues:write"] },
      { name: "developer", label: "Developer", description: "Day-to-day engineering work", isDefault: false, scopes: ["repo:read", "issues:write", "repo:write", "pull_requests:write"] },
      { name: "release-manager", label: "Release manager", description: "Ships releases and runs deploy workflows", isDefault: false, scopes: ["repo:read", "repo:write", "pull_requests:write", "actions:run"] },
    ],
  },
  {
    key: "crm",
    name: "Customer Data API",
    url: "https://crm-api.northwind.example",
    path: "/v2",
    state: "ready",
    tools: 9,
    createdDaysAgo: 104,
    lastScanHoursAgo: 6,
    scopes: [
      { key: "customers:read", label: "Read customer records", description: "Look up accounts, contacts and order history", risk: "low" },
      { key: "customers:write", label: "Update customer records", description: "Edit contact details and account notes", risk: "medium" },
      { key: "customers:export", label: "Bulk export customers", description: "Export customer lists as CSV", risk: "high" },
      { key: "pii:read", label: "Read personal data", description: "See unmasked emails, phone numbers and addresses", risk: "high" },
    ],
    roles: [
      { name: "support-agent", label: "Support agent", description: "Answers tickets with customer context", isDefault: true, scopes: ["customers:read"] },
      { name: "account-manager", label: "Account manager", description: "Owns customer relationships", isDefault: false, scopes: ["customers:read", "customers:write"] },
      { name: "data-steward", label: "Data steward", description: "Handles exports and data-subject requests", isDefault: false, scopes: ["customers:read", "customers:export", "pii:read"] },
    ],
  },
  {
    key: "payments",
    name: "Payments Ledger MCP",
    url: "https://ledger.northwind.example",
    path: "/mcp",
    state: "ready",
    tools: 7,
    createdDaysAgo: 76,
    lastScanHoursAgo: 11,
    accessIssue: "Release Bot was denied payouts:approve 4 times in the last 24h",
    scopes: [
      { key: "ledger:read", label: "Read the ledger", description: "View balances, invoices and transactions", risk: "low" },
      { key: "invoices:create", label: "Create invoices", description: "Draft and send customer invoices", risk: "medium" },
      { key: "refunds:issue", label: "Issue refunds", description: "Refund a customer payment", risk: "high" },
      { key: "payouts:approve", label: "Approve payouts", description: "Release money to vendors and partners", risk: "critical" },
    ],
    roles: [
      { name: "finance-viewer", label: "Finance viewer", description: "Read-only access to the ledger", isDefault: true, scopes: ["ledger:read"] },
      { name: "billing-operator", label: "Billing operator", description: "Runs invoicing and handles refunds", isDefault: false, scopes: ["ledger:read", "invoices:create", "refunds:issue"] },
      { name: "treasury-approver", label: "Treasury approver", description: "Signs off on outgoing payouts", isDefault: false, scopes: ["ledger:read", "payouts:approve"] },
    ],
  },
  {
    key: "kb",
    name: "Knowledge Base MCP",
    url: "https://kb.northwind.example",
    path: "/mcp",
    state: "needs_setup",
    tools: 5,
    createdDaysAgo: 4,
    lastScanHoursAgo: 30,
    scopes: [
      { key: "docs:read", label: "Read articles", description: "Search and read internal articles", risk: "low" },
      { key: "docs:write", label: "Edit articles", description: "Create and edit internal articles", risk: "medium" },
    ],
    roles: [{ name: "reader", label: "Reader", description: "Can search and read articles", isDefault: false, scopes: ["docs:read"] }],
  },
  {
    key: "jira",
    name: "Jira Ops MCP",
    url: "https://jira-mcp.northwind.example",
    path: "/mcp",
    state: "scan_failed",
    tools: 0,
    createdDaysAgo: 2,
    lastScanHoursAgo: 1,
    scanError: "Tool inventory unavailable: GET /.well-known/mcp-manifest returned 503 Service Unavailable",
    scopes: [
      { key: "tickets:read", label: "Read tickets", description: "View tickets and their history", risk: "low" },
      { key: "tickets:write", label: "Update tickets", description: "Create, transition and comment on tickets", risk: "medium" },
    ],
    roles: [{ name: "ops-member", label: "Ops member", description: "Works the operations queue", isDefault: false, scopes: ["tickets:read", "tickets:write"] }],
  },
];

interface AdminDef {
  name: string;
  handle: string;
  role: string;
  status: "active" | "invited" | "inactive";
  provider: string;
  mfa: boolean;
  joinedDaysAgo: number;
  lastLoginHoursAgo: number | null;
}

export const ADMINS: AdminDef[] = [
  { name: "Priya Raman", handle: "priya.raman", role: "owner", status: "active", provider: "okta", mfa: true, joinedDaysAgo: 140, lastLoginHoursAgo: 1 },
  { name: "Marcus Chen", handle: "marcus.chen", role: "admin", status: "active", provider: "okta", mfa: true, joinedDaysAgo: 131, lastLoginHoursAgo: 5 },
  { name: "Elena Rossi", handle: "elena.rossi", role: "admin", status: "active", provider: "okta", mfa: true, joinedDaysAgo: 88, lastLoginHoursAgo: 26 },
  { name: "Daniel Okafor", handle: "daniel.okafor", role: "readonly_auditor", status: "active", provider: "password", mfa: true, joinedDaysAgo: 45, lastLoginHoursAgo: 73 },
  { name: "Kenji Watanabe", handle: "kenji.watanabe", role: "admin", status: "inactive", provider: "okta", mfa: false, joinedDaysAgo: 120, lastLoginHoursAgo: 900 },
  { name: "Sofia Martins", handle: "sofia.martins", role: "admin", status: "invited", provider: "password", mfa: false, joinedDaysAgo: 2, lastLoginHoursAgo: null },
];

interface EndUserDef {
  name: string;
  handle: string;
  domain?: string;
  status: "active" | "suspended";
  suspendedReason?: string;
  provider: string;
  mfa: boolean;
  plan: string;
  joinedDaysAgo: number;
  lastSeenHoursAgo: number | null;
}

export const END_USERS: EndUserDef[] = [
  { name: "Aisha Bello", handle: "aisha.bello", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 120, lastSeenHoursAgo: 0.2 },
  { name: "Tom Fischer", handle: "tom.fischer", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 118, lastSeenHoursAgo: 2 },
  { name: "Lucía Herrera", handle: "lucia.herrera", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 115, lastSeenHoursAgo: 4 },
  { name: "Ravi Iyer", handle: "ravi.iyer", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 110, lastSeenHoursAgo: 1 },
  { name: "Hannah Kim", handle: "hannah.kim", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 99, lastSeenHoursAgo: 8 },
  { name: "Omar Haddad", handle: "omar.haddad", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 97, lastSeenHoursAgo: 30 },
  { name: "Grace Liu", handle: "grace.liu", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 90, lastSeenHoursAgo: 3 },
  { name: "Mateo Silva", handle: "mateo.silva", status: "active", provider: "okta", mfa: false, plan: "enterprise", joinedDaysAgo: 86, lastSeenHoursAgo: 50 },
  { name: "Nora Lindqvist", handle: "nora.lindqvist", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 80, lastSeenHoursAgo: 6 },
  { name: "Samuel Adeyemi", handle: "samuel.adeyemi", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 74, lastSeenHoursAgo: 12 },
  { name: "Chloé Dubois", handle: "chloe.dubois", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 66, lastSeenHoursAgo: 0.5 },
  { name: "Arjun Mehta", handle: "arjun.mehta", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 60, lastSeenHoursAgo: 20 },
  { name: "Yuki Tanaka", handle: "yuki.tanaka", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 41, lastSeenHoursAgo: 9 },
  { name: "Ben Carter", handle: "ben.carter", status: "suspended", suspendedReason: "Left the company — offboarding in progress", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 112, lastSeenHoursAgo: 240 },
  { name: "Fatima Zahra", handle: "fatima.zahra", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 25, lastSeenHoursAgo: 15 },
  { name: "Leo Novak", handle: "leo.novak", status: "active", provider: "okta", mfa: true, plan: "enterprise", joinedDaysAgo: 12, lastSeenHoursAgo: 2 },
  { name: "Isabel Moreno", handle: "isabel.moreno", domain: PARTNER_DOMAIN, status: "active", provider: "entra", mfa: true, plan: "contractor", joinedDaysAgo: 54, lastSeenHoursAgo: 28 },
  { name: "Peter Walsh", handle: "peter.walsh", domain: PARTNER_DOMAIN, status: "active", provider: "entra", mfa: false, plan: "contractor", joinedDaysAgo: 33, lastSeenHoursAgo: 70 },
  { name: "Mei Chen", handle: "mei.chen", domain: PARTNER_DOMAIN, status: "active", provider: "entra", mfa: true, plan: "contractor", joinedDaysAgo: 9, lastSeenHoursAgo: 5 },
  { name: "Victor Petrov", handle: "victor.petrov", domain: PARTNER_DOMAIN, status: "suspended", suspendedReason: "Contract ended", provider: "entra", mfa: true, plan: "contractor", joinedDaysAgo: 140, lastSeenHoursAgo: 400 },
];

/** [end-user index, app, role, days ago] */
export const USER_GRANTS: Array<[number, string, string, number]> = [
  [0, "github", "release-manager", 100], [0, "crm", "support-agent", 90],
  [1, "github", "developer", 110], [1, "payments", "finance-viewer", 40],
  [2, "github", "developer", 105], [2, "crm", "account-manager", 70],
  [3, "github", "developer", 100], [3, "payments", "billing-operator", 60],
  [4, "crm", "account-manager", 95], [4, "github", "viewer", 95],
  [5, "crm", "data-steward", 80], [5, "github", "viewer", 80],
  [6, "payments", "treasury-approver", 75], [6, "payments", "billing-operator", 75],
  [7, "github", "developer", 70],
  [8, "crm", "support-agent", 66], [8, "github", "viewer", 66],
  [9, "github", "release-manager", 60], [9, "github", "developer", 60],
  [10, "crm", "account-manager", 50], [10, "payments", "finance-viewer", 50],
  [11, "github", "developer", 45],
  [12, "crm", "support-agent", 30], [12, "kb", "reader", 3],
  [13, "github", "developer", 100], [13, "crm", "account-manager", 100],
  [14, "github", "viewer", 20], [14, "crm", "support-agent", 20],
  [15, "github", "developer", 10],
  [16, "github", "developer", 50], [16, "jira", "ops-member", 1],
  [17, "crm", "support-agent", 30],
  [18, "github", "viewer", 8],
];

interface ClientDef {
  name: string;
  clientId: string;
  kind: "human_app" | "agent" | "m2m" | "cli";
  registration: "dcr" | "prereg" | "cimd";
  status: string;
  app: string;
  software?: string;
  version?: string;
  tags: string[];
  createdDaysAgo: number;
  lastTokenMinutesAgo: number | null;
  redirect?: string;
  foreign?: boolean;
}

export const CLIENTS: ClientDef[] = [
  { name: "Claude Desktop", clientId: "nw-claude-desktop-7f3a91", kind: "human_app", registration: "dcr", status: "approved", app: "github", software: "claude-desktop", version: "1.9.2", tags: ["ai-assistant"], createdDaysAgo: 120, lastTokenMinutesAgo: 3 },
  { name: "Cursor", clientId: "nw-cursor-2b8e40", kind: "human_app", registration: "dcr", status: "approved", app: "github", software: "cursor", version: "0.48.6", tags: ["ide"], createdDaysAgo: 98, lastTokenMinutesAgo: 14 },
  { name: "Support Copilot", clientId: "nw-support-copilot-a41c07", kind: "agent", registration: "prereg", status: "approved", app: "crm", software: "northwind-support-copilot", version: "2.3.0", tags: ["agent", "support"], createdDaysAgo: 88, lastTokenMinutesAgo: 1 },
  { name: "Release Bot", clientId: "nw-release-bot-5d22f9", kind: "agent", registration: "prereg", status: "approved", app: "github", software: "northwind-release-bot", version: "1.4.1", tags: ["agent", "ci"], createdDaysAgo: 70, lastTokenMinutesAgo: 22 },
  { name: "Finance Reconciler", clientId: "nw-finance-recon-c90b12", kind: "agent", registration: "prereg", status: "approved", app: "payments", software: "northwind-recon", version: "0.9.4", tags: ["agent", "finance"], createdDaysAgo: 58, lastTokenMinutesAgo: 47 },
  { name: "Code Review Agent", clientId: "nw-code-review-e7f3d8", kind: "agent", registration: "dcr", status: "approved", app: "github", software: "review-agent", version: "3.1.0", tags: ["agent"], createdDaysAgo: 35, lastTokenMinutesAgo: 9 },
  { name: "Sales Research Agent", clientId: "bp-sales-research-118aa0", kind: "agent", registration: "cimd", status: "pending_approval", app: "crm", software: "brightpath-research", version: "1.0.0", tags: ["agent", "partner"], createdDaysAgo: 1, lastTokenMinutesAgo: null, foreign: true },
  { name: "Nightly ETL", clientId: "nw-etl-nightly-3e6b55", kind: "m2m", registration: "prereg", status: "approved", app: "crm", tags: ["batch"], createdDaysAgo: 101, lastTokenMinutesAgo: 380 },
  { name: "Billing Sync", clientId: "nw-billing-sync-90d4ce", kind: "m2m", registration: "prereg", status: "approved", app: "payments", tags: ["batch", "finance"], createdDaysAgo: 72, lastTokenMinutesAgo: 31 },
  { name: "authsec CLI", clientId: "nw-authsec-cli-0a7b3f", kind: "cli", registration: "dcr", status: "approved", app: "github", software: "authsec-cli", version: "0.12.0", tags: ["cli"], createdDaysAgo: 64, lastTokenMinutesAgo: 190 },
  { name: "VS Code Copilot Chat", clientId: "nw-vscode-chat-61ad2e", kind: "human_app", registration: "dcr", status: "approved", app: "kb", software: "vscode", version: "1.96.0", tags: ["ide"], createdDaysAgo: 3, lastTokenMinutesAgo: 600 },
  { name: "Zapier Bridge (legacy)", clientId: "nw-zapier-legacy-44f0b1", kind: "human_app", registration: "dcr", status: "revoked", app: "crm", tags: ["deprecated"], createdDaysAgo: 160, lastTokenMinutesAgo: 30 * 24 * 60 },
];

interface ServiceAccountDef {
  name: string;
  description: string;
  status: "active" | "disabled";
  clientId?: string;
  spiffe?: string;
  owner: string;
  team: string;
  createdDaysAgo: number;
  lastSeenHoursAgo: number | null;
}

export const SERVICE_ACCOUNTS: ServiceAccountDef[] = [
  { name: "ci-deployer", description: "GitHub Actions runner that ships releases to production", status: "active", clientId: "nw-sa-ci-deployer-8c1e", owner: "elena.rossi", team: "Platform", createdDaysAgo: 110, lastSeenHoursAgo: 0.4 },
  { name: "billing-sync-worker", description: "Pushes settled invoices from the ledger to accounting every 30 minutes", status: "active", clientId: "nw-billing-sync-90d4ce", owner: "marcus.chen", team: "Finance Eng", createdDaysAgo: 72, lastSeenHoursAgo: 0.5 },
  { name: "etl-nightly", description: "Copies customer records into the Snowflake warehouse at 02:00 UTC", status: "active", clientId: "nw-etl-nightly-3e6b55", owner: "elena.rossi", team: "Data", createdDaysAgo: 101, lastSeenHoursAgo: 6 },
  { name: "support-copilot-runtime", description: "Runtime identity of the Support Copilot agent pods", status: "active", spiffe: "spiffe://northwind.example/ns/support/sa/copilot", owner: "priya.raman", team: "Support Eng", createdDaysAgo: 88, lastSeenHoursAgo: 0.1 },
  { name: "k8s-observability", description: "Reads deployment metadata for the metrics pipeline", status: "active", spiffe: "spiffe://northwind.example/ns/observability/sa/collector", owner: "elena.rossi", team: "Platform", createdDaysAgo: 64, lastSeenHoursAgo: 1 },
  { name: "legacy-cron", description: "Old reporting cron — replaced by etl-nightly, kept disabled for audit", status: "disabled", owner: "kenji.watanabe", team: "Data", createdDaysAgo: 300, lastSeenHoursAgo: 2000 },
];

/** [service-account index, app, role, days ago] */
export const SA_GRANTS: Array<[number, string, string, number]> = [
  [0, "github", "release-manager", 100],
  [1, "payments", "billing-operator", 70],
  [2, "crm", "data-steward", 100],
  [3, "crm", "support-agent", 85],
  [4, "github", "viewer", 60],
];
