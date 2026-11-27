import { recordAudit, refreshCounts, demoId, KIND, type DemoDb } from "../demo/db";
import { blockTitled, css, withText, type Walkthrough } from "./model";

const app = (n: number) => demoId(KIND.app, n);
const GITHUB = app(1);
const CRM = app(2);
const PAYMENTS = app(3);
const JIRA = app(5);
const appPage = (id: string, tab: string) => `/applications/${id}/${tab}`;

// Log console lines start with the timestamp in brackets.
const FIRST_M2M = withText("[data-main-content-area] div", /^\[20\S+\]\s+(PERMIT|DENY)\s+client=/);
const RELEASE_BOT_DENY = withText("[data-main-content-area] div", /^\[20\S+\]\s+DENY\s+client=nw-release-bot/);
const LATEST_AUDIT = withText("[data-main-content-area] div", /^\[20\S+\]\s+(LOW|MEDIUM|HIGH|CRITICAL)\s/);

const releaseBotPayoutRequest = (db: DemoDb) =>
  db.requests.find((r) => r.application_id === PAYMENTS && r.requester_name === "Release Bot");
const partnerClient = (db: DemoDb) =>
  db.clients.find((c) => c.client_name === "Sales Research Agent" && c.resource_server_id === CRM);
const jiraTools = (db: DemoDb) => db.tools.filter((t) => t.application_id === JIRA);
const jiraApp = (db: DemoDb) => db.applications.find((a) => a.id === JIRA);
const mateo = (db: DemoDb) => db.endUsers.find((u) => u.username === "mateo.silva");

/** Maps every unmapped Jira tool to the scope its SDK suggested. */
function applyJiraSuggestions(db: DemoDb) {
  for (const tool of jiraTools(db)) {
    if (tool.scope_ids.length) continue;
    const ids = tool.suggested
      .map((key) => db.scopes.find((s) => s.application_id === JIRA && s.scope_string === key)?.id)
      .filter((x): x is string => Boolean(x));
    tool.scope_ids = ids;
    tool.suggested = [];
  }
  recordAudit(db, { action: "tool.map_scopes", resource: "resource", resourceId: JIRA, method: "PUT", path: "/authsec/applications/:id/tool-scope-map" });
}

export const WALKTHROUGHS: Walkthrough[] = [
  {
    id: "welcome",
    title: "What AuthSec does",
    summary: "A five-minute tour of the console: what is protected, who connects, and how every decision is recorded.",
    level: "Beginner",
    minutes: 4,
    steps: [
      {
        id: "dashboard",
        title: "Your workspace at a glance",
        body: "Northwind AI lets AI agents work with GitHub, its customer database and its payment ledger. AuthSec sits in front of each of those systems and checks every request an agent makes. These numbers summarise what it protects.",
        route: "/dashboard",
        target: css('[aria-label="Hero metrics"]'),
      },
      {
        id: "applications",
        title: "Applications are the doors",
        body: "Each application is a server an agent can call. Three are launched and enforcing access. One is still being set up, and one is blocked because AuthSec couldn't read its list of tools.",
        route: "/applications",
        target: css("[data-main-content-area] table"),
      },
      {
        id: "tools",
        title: "Every action needs a permission",
        body: "GitHub offers 15 actions to agents, from reading code to deleting a repository. Each action is tied to a permission (a scope). An action with no permission is blocked for everyone until an admin decides — like the new delete_repository here.",
        route: appPage(GITHUB, "tools"),
        target: css("[data-main-content-area] table"),
      },
      {
        id: "clients",
        title: "Who is knocking",
        body: "These are the apps and agents that have connected: Claude Desktop, Cursor, Northwind's own agents and batch jobs. One belongs to a partner company and is waiting for your approval.",
        route: "/clients",
        target: withText("tr", /Sales Research Agent/),
      },
      {
        id: "decisions",
        title: "Every decision is on record",
        body: "Each time an agent asks for access, AuthSec records what it asked for, what it got and why. Permit means allowed; deny means blocked. This is how you spot an agent trying to do too much.",
        route: "/logs/m2m",
        target: FIRST_M2M,
      },
      {
        id: "explain",
        title: "Help is built in",
        body: "Look for the ⓘ icons next to page titles and numbers. They explain what you're looking at in plain language, with more depth if you switch to Intermediate or Advanced.",
        route: "/dashboard",
        target: css('[data-main-content-area] button[aria-label^="Explain"]'),
      },
    ],
    value: "AuthSec gives AI agents access to real systems without giving them the keys to everything: each action needs a permission, each agent is known, and every decision is recorded.",
  },
  {
    id: "overreach",
    title: "An agent overreaches",
    summary: "Release Bot is trying to approve payments. Investigate the denials, refuse its request and watch the next attempt get blocked.",
    level: "Intermediate",
    minutes: 4,
    steps: [
      {
        id: "spot",
        title: "Something keeps getting denied",
        body: "Release Bot ships code to production. In the last day it has asked the Payments Ledger for payouts:approve — the permission to send money — four times, and was denied each time. A release bot has no reason to move money.",
        route: "/logs/m2m",
        target: RELEASE_BOT_DENY,
      },
      {
        id: "request",
        title: "It also asked for the permission outright",
        body: "Besides trying, Release Bot filed an access request on the Payments Ledger asking for payouts:approve. If someone approved it without thinking, a compromised CI pipeline could pay out money.",
        route: appPage(PAYMENTS, "connections"),
        target: blockTitled(/^Access requests$/),
      },
      {
        id: "deny",
        title: "Refuse the request",
        body: "Denying the request keeps Release Bot's access exactly as it is today. Nothing it legitimately does is affected.",
        route: appPage(PAYMENTS, "connections"),
        target: withText("tr", /Release Bot/),
        task: {
          hint: "Open the ⋯ menu on Release Bot's request, choose Deny, and confirm.",
          done: (db) => releaseBotPayoutRequest(db)?.status === "denied",
          doItForMe: (db) => {
            const r = releaseBotPayoutRequest(db);
            if (r) r.status = "denied";
            recordAudit(db, { action: "request.deny", resource: "client", resourceId: r?.requester_client_id ?? "", method: "POST", path: "/authsec/applications/:id/requests/:rid/deny" });
          },
          outcome: "Denied. Release Bot keeps its current access, and the decision is recorded with your name on it.",
        },
      },
      {
        id: "audit",
        title: "Your decision is on record",
        body: "The audit log now starts with your denial: who made it, when and from where. When someone asks \"who decided this?\", this is the answer.",
        route: "/logs/audit",
        target: LATEST_AUDIT,
      },
      {
        id: "retry",
        title: "Watch the next attempt",
        body: "Agents retry. AuthSec keeps saying no — every attempt is checked against the policy, not against a decision made once.",
        route: "/logs/m2m",
        target: RELEASE_BOT_DENY,
        task: {
          hint: "Wait a few seconds for Release Bot's next attempt to appear at the top of the log.",
          done: (db) => db.m2mLogs.some((l) => l.pdpReason?.includes("request was denied")),
          outcome: "Release Bot tried again and was blocked: its request was denied, so the policy still refuses payouts:approve.",
        },
      },
    ],
    value: "You found an agent reaching for a dangerous permission, refused it in one click, and saw enforcement hold on the next attempt — with the whole story in the logs for anyone who asks.",
  },
  {
    id: "jira",
    title: "Bring a broken server online",
    summary: "The Jira server's tool scan failed. Rescan it, give every tool a permission, choose what new users get, and launch.",
    level: "Intermediate",
    minutes: 6,
    steps: [
      {
        id: "blocked",
        title: "A server that can't launch",
        body: "Jira Ops MCP was registered two days ago, but AuthSec couldn't read its list of tools — the server answered 503. Without that list AuthSec can't know what to protect, so it refuses to launch the server.",
        route: appPage(JIRA, "overview"),
        target: blockTitled(/^Launch gates$/),
      },
      {
        id: "rescan",
        title: "Ask for the tool list again",
        body: "The Jira team fixed their server this morning. A rescan asks it for its tools again.",
        route: appPage(JIRA, "tools"),
        target: withText("button", /^Refresh Tools$/),
        task: {
          hint: "Click Refresh Tools.",
          done: (db) => jiraTools(db).length > 0,
          outcome: "Six tools found. All six are denied for now: AuthSec never lets an action through until someone decides which permission it needs.",
        },
      },
      {
        id: "map",
        title: "Give each tool a permission",
        body: "The SDK suggests a scope for each tool: tickets:read for searching, tickets:write for changes. Accepting a suggestion turns it into an enforced rule.",
        route: appPage(JIRA, "tools"),
        target: css("[data-main-content-area] table"),
        task: {
          hint: "Open a denied tool and apply its suggested scope. Map them all, or use Do it for me.",
          done: (db) => jiraTools(db).length > 0 && jiraTools(db).every((t) => t.is_public || t.scope_ids.length > 0),
          doItForMe: applyJiraSuggestions,
          outcome: "Every tool now needs a permission. Searching needs tickets:read; changing or paging anyone needs tickets:write.",
        },
      },
      {
        id: "default",
        title: "Decide what new users get",
        body: "The default role is handed to anyone who signs in for the first time. For an ops tool, the Ops member role is a sensible default.",
        route: appPage(JIRA, "access-assignments"),
        task: {
          hint: "Mark the Ops member role as default.",
          done: (db) => db.roles.some((r) => r.application_id === JIRA && r.is_default),
          doItForMe: (db) => {
            const role = db.roles.find((r) => r.application_id === JIRA);
            if (!role) return;
            role.is_default = true;
            const jira = jiraApp(db);
            if (jira) {
              jira.access_policy_enabled = true;
              jira.access_policy_role_name = role.name;
              jira.default_role_name = role.name;
            }
            refreshCounts(db);
          },
          outcome: "New users now get Ops member on their first sign-in.",
        },
      },
      {
        id: "launch",
        title: "Launch it",
        body: "Every gate is green: tools are known, each has a permission, and new users have a default. Launching switches the server from observing to enforcing.",
        route: appPage(JIRA, "overview"),
        target: blockTitled(/^Launch gates$/),
        task: {
          hint: "Click Launch on the overview page.",
          done: (db) => jiraApp(db)?.state === "ready",
          doItForMe: (db) => {
            const jira = jiraApp(db);
            if (!jira) return;
            jira.state = "ready";
            jira.active = true;
            jira.setup_completed_at = new Date().toISOString();
            jira.last_validation_status = "passed";
            recordAudit(db, { action: "application.activate", resource: "application", resourceId: JIRA, method: "POST", path: "/authsec/applications/:id/activate" });
          },
          outcome: "Jira Ops MCP is live. The dashboard now shows four healthy applications.",
        },
      },
    ],
    value: "You took a server from \"blocked\" to \"enforcing\" without writing code: AuthSec learned its tools, you decided what each one needs, and nothing went live until every gate passed.",
  },
  {
    id: "partner",
    title: "Let a partner's agent in",
    summary: "A consulting partner's research agent wants to read customer records. Review who it is and approve it.",
    level: "Beginner",
    minutes: 3,
    steps: [
      {
        id: "who",
        title: "A stranger at the door",
        body: "BrightPath Consulting's Sales Research Agent registered from their own AuthSec workspace and wants to read Northwind's customer data. Clients from another company always wait for your approval.",
        route: "/clients",
        target: withText("tr", /Sales Research Agent/),
      },
      {
        id: "approve",
        title: "Approve the connection",
        body: "Approving lets the agent connect. It still only gets what a role allows — approval is not a blank cheque.",
        route: "/clients",
        target: withText("tr", /Sales Research Agent/),
        task: {
          hint: "Click Approve on the Sales Research Agent row.",
          done: (db) => partnerClient(db)?.status === "approved",
          doItForMe: (db) => {
            const c = partnerClient(db);
            if (c) c.status = "approved";
            refreshCounts(db);
            recordAudit(db, { action: "client.approve", resource: "client", resourceId: c?.id ?? "", method: "PUT", path: "/authsec/applications/:id/connections/:cid/approve" });
          },
          outcome: "Approved. The agent appears as a connection on the Customer Data API.",
        },
      },
      {
        id: "recorded",
        title: "And it's recorded",
        body: "The approval is at the top of the audit log. If the partnership ends, revoking the client from the Clients page cuts the agent off immediately.",
        route: "/logs/audit",
        target: LATEST_AUDIT,
      },
    ],
    value: "Partners can bring their own agents without you creating accounts for them, and every cross-company connection needs a person to say yes first.",
  },
  {
    id: "offboard",
    title: "Someone leaves the company",
    summary: "Mateo Silva left yesterday. Cut off his access everywhere in one step.",
    level: "Beginner",
    minutes: 2,
    steps: [
      {
        id: "find",
        title: "Find the person",
        body: "Mateo had developer access to GitHub through Claude Desktop. He also never set up MFA — one more reason to act quickly.",
        route: "/end-users",
        target: withText("tr", /mateo\.silva/),
      },
      {
        id: "suspend",
        title: "Suspend the account",
        body: "Suspending keeps Mateo's history for audits but stops every token he holds, in every application, at once.",
        route: "/end-users",
        target: withText("tr", /mateo\.silva/),
        task: {
          hint: "Open Mateo's ⋯ menu and choose Suspend.",
          done: (db) => mateo(db)?.status === "suspended",
          doItForMe: (db) => {
            const u = mateo(db);
            if (!u) return;
            u.status = "suspended";
            u.active = false;
            u.suspended_reason = "Left the company";
            recordAudit(db, { action: "user.suspend", resource: "end_user", resourceId: u.id, method: "POST", path: "/authsec/uflow/v2/tenants/:ws/end-users/:id/suspend" });
          },
          outcome: "Suspended. Any agent acting for Mateo is refused on its next call.",
        },
      },
      {
        id: "recorded",
        title: "Proof for the auditors",
        body: "The audit log shows who suspended Mateo and when — the evidence an access review asks for.",
        route: "/logs/audit",
        target: LATEST_AUDIT,
      },
    ],
    value: "One action removes a leaver's access from every protected application and every agent acting for them, with a record that satisfies an audit.",
  },
];
