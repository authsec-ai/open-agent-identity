export interface HoverInfo {
  title: string;
  body: string;
  facts?: Array<[label: string, value: string]>;
}

/**
 * Fixed words the console shows: statuses, badges, column headers, log
 * fields and buttons. Keys are matched case-insensitively against the
 * hovered element's text.
 */
const ENTRIES: Array<[keys: string[], info: HoverInfo]> = [
  // ── Statuses ─────────────────────────────────────────────────────────
  [["approved", "• approved"], { title: "Approved", body: "This client is allowed to connect and can get tokens. It still only gets what its role grants." }],
  [["pending approval", "• pending approval", "pending"], { title: "Pending approval", body: "Waiting for an admin to decide. Until then the client or request gets nothing." }],
  [["revoked", "• revoked"], { title: "Revoked", body: "Access was withdrawn. The client can no longer get tokens; its history stays for the audit trail." }],
  [["launched"], { title: "Launched", body: "Setup is complete and AuthSec is enforcing access: every tool call needs a valid token with the right scope." }],
  [["in setup", "not launched"], { title: "In setup", body: "Registered but not live yet. Open its Overview to see which launch gates are still open." }],
  [["blocked", "scan failed"], { title: "Blocked", body: "AuthSec couldn't read this server's tool list, so it can't know what to protect. A rescan fixes it once the server answers." }],
  [["discovered"], { title: "Discovered", body: "AuthSec has received this server's tool inventory from the SDK or a scan." }],
  [["needs review"], { title: "Needs review", body: "Something here hasn't been checked by an admin yet, such as a new tool or an unreviewed high-risk scope." }],
  [["active", "• active"], { title: "Active", body: "In use and allowed to sign in or get tokens." }],
  [["suspended", "• suspended"], { title: "Suspended", body: "Blocked from signing in. Every token held is refused on its next use, but the history is kept for audits." }],
  [["invited", "• invited"], { title: "Invited", body: "An invitation was sent but hasn't been accepted, so this person can't sign in yet." }],
  [["inactive", "• inactive", "disabled"], { title: "Inactive", body: "Turned off. Nothing is deleted, so it can be switched back on." }],
  [["enabled"], { title: "Enabled", body: "This rule is in force." }],
  [["verified"], { title: "Verified", body: "Ownership of the domain was proven with a DNS TXT record." }],
  [["primary"], { title: "Primary domain", body: "The address people see on the sign-in page." }],
  [["configured"], { title: "Configured", body: "This part of the setup exists and is working." }],
  [["not set up"], { title: "Not set up", body: "Nothing configured yet. The card's link takes you to set it up." }],
  [["passed"], { title: "Passed", body: "The live check succeeded just now." }],

  // ── Access and risk ─────────────────────────────────────────────────
  [["low", "low risk"], { title: "Low risk", body: "Read-only or harmless if misused, e.g. reading a repository." }],
  [["medium", "medium risk"], { title: "Medium risk", body: "Changes data, but mistakes are recoverable, e.g. pushing to a branch." }],
  [["high", "high risk"], { title: "High risk", body: "Can cause real damage or expose sensitive data, e.g. refunds or bulk exports. Grant sparingly." }],
  [["critical", "critical risk"], { title: "Critical risk", body: "Irreversible or company-wide impact, e.g. approving payouts. Few roles, very few people." }],
  [["role-gated"], { title: "Role-gated", body: "The tool needs a scope. Only people and agents whose role grants that scope can call it." }],
  [["public"], { title: "Public tool", body: "Callable without a token. Only safe for harmless tools like health checks." }],
  [["denied"], { title: "Denied", body: "This tool has no scope yet, so it is refused for everyone until an admin maps it. Safe by default." }],
  [["default"], { title: "Default role", body: "Given automatically to anyone who signs in to this application for the first time." }],
  [["manual"], { title: "Manual", body: "Granted by an admin, rather than automatically." }],
  [["generated"], { title: "Generated", body: "Created by AuthSec from the server's scopes, rather than by an admin." }],
  [["manifest"], { title: "From the manifest", body: "This scope came from the server's SDK manifest, so it matches what the code actually checks." }],

  // ── Client kinds and registration ───────────────────────────────────
  [["agent"], { title: "Agent", body: "AI software acting on someone's behalf, such as a support copilot." }],
  [["human app"], { title: "Human app", body: "An app a person uses directly, like Claude Desktop or an IDE." }],
  [["m2m"], { title: "Machine to machine", body: "A job or service that calls the application on its own, with no person involved." }],
  [["cli"], { title: "CLI", body: "A command-line tool a developer runs." }],
  [["dcr"], { title: "Dynamic registration", body: "The client registered itself the first time it connected (OAuth DCR)." }],
  [["pre-reg", "prereg"], { title: "Pre-registered", body: "An admin registered this client in advance and handed over its credentials." }],
  [["cimd"], { title: "Client metadata document", body: "The client is described by a document at its own URL, so its identity is tied to a domain it controls." }],
  [["cross-app assertion"], { title: "Cross-app assertion", body: "An agent exchanging a signed-in person's identity for a token on this application (ID-JAG)." }],
  [["machine credential"], { title: "Machine credential", body: "A client secret or signed key used by a service account." }],
  [["machine identity"], { title: "Machine identity", body: "A service account: an identity for software, not a person." }],

  // ── Decision log ────────────────────────────────────────────────────
  [["permit"], { title: "Permit", body: "The token was issued." }],
  [["deny"], { title: "Deny", body: "The token was refused. Repeated denials from one client are worth investigating." }],
  [["pdp: permit"], { title: "Policy engine: permit", body: "The policy engine (PDP) evaluated the request and allowed it." }],
  [["pdp: deny"], { title: "Policy engine: deny", body: "The policy engine (PDP) found no rule allowing this request." }],
  [["pdp: no_policy"], { title: "No policy matched", body: "No policy covered this request, so the gate fell back to its default. Worth writing a policy for." }],
  [["gate: permit"], { title: "Gate: permit", body: "The enforcement gate issued the token. This is the decision that actually counts." }],
  [["gate: deny"], { title: "Gate: deny", body: "The enforcement gate refused the token." }],
  [["success"], { title: "Success", body: "The sign-in step worked." }],
  [["failure"], { title: "Failure", body: "The sign-in step failed. Bursts of failures from one IP or against one account suggest an attack." }],
  [["admin.login"], { title: "Admin sign-in", body: "Someone signed in to this console." }],
  [["enduser.login"], { title: "User sign-in", body: "A person signed in to use a protected application." }],
  [["mfa.verify"], { title: "MFA check", body: "The person proved a second factor, such as an authenticator code or passkey." }],
  [["token.refresh"], { title: "Token refresh", body: "An app quietly renewed its access without asking the person to sign in again." }],
  [["invalid_credentials"], { title: "Wrong password", body: "The password didn't match." }],
  [["account_temporarily_locked"], { title: "Account locked", body: "Too many failed attempts, so AuthSec locked the account for a while." }],
  [["user_suspended"], { title: "User suspended", body: "A suspended person tried to sign in and was refused." }],

  // ── Column headers ──────────────────────────────────────────────────
  [["readiness"], { title: "Readiness", body: "Where the application is in its journey to launch." }],
  [["risk"], { title: "Risk", body: "How much damage misuse could cause. Driven by the riskiest scope involved." }],
  [["status"], { title: "Status", body: "Whether this is currently in force, waiting or withdrawn." }],
  [["kind"], { title: "Kind", body: "What sort of client this is: an app a person uses, an agent, a background job or a CLI." }],
  [["registration"], { title: "Registration", body: "How the client got its identity: registered itself, registered by an admin, or described by a metadata document." }],
  [["decision"], { title: "Decision", body: "Approve or deny clients that are waiting." }],
  [["auth method"], { title: "Auth method", body: "How the service account proves who it is: a secret, a signed key or a Kubernetes identity." }],
  [["owner"], { title: "Owner", body: "The person accountable for this identity. They should be asked before it changes." }],
  [["last active", "last seen", "last token"], { title: "Last activity", body: "When this was last used. Long-unused access is a good candidate for removal." }],
  [["apps"], { title: "Applications", body: "How many protected applications this person can use." }],
  [["scopes"], { title: "Scopes", body: "Permissions. Each one unlocks specific tools on an application." }],
  [["assignments"], { title: "Assignments", body: "How many people or services hold this role." }],
  [["tools unlocked"], { title: "Tools unlocked", body: "How many actions this scope opens up." }],
  [["roles using it"], { title: "Roles using it", body: "How many roles include this scope, i.e. how widely it is handed out." }],
  [["runtime access"], { title: "Runtime access", body: "What happens when an agent calls this tool: public, gated by a role, or denied." }],
  [["authority"], { title: "Authority", body: "Whose permissions the connection acts with: a person or a service account." }],
  [["granted through"], { title: "Granted through", body: "The role that gives this connection its access." }],
  [["requested scopes"], { title: "Requested scopes", body: "What the agent is asking for. Compare it with what its job actually needs." }],
  [["acting user"], { title: "Acting user", body: "The person the agent says it is working for. \"Not mapped\" means that person isn't known in this workspace." }],
  [["capabilities"], { title: "Capabilities", body: "The scopes this consent covers." }],
  [["principal"], { title: "Principal", body: "Who gave the consent." }],
  [["max duration"], { title: "Max duration", body: "The longest a delegated token may live. Shorter is safer." }],

  // ── Buttons ─────────────────────────────────────────────────────────
  [["approve"], { title: "Approve", body: "Let this client connect. It still only gets what a role grants." }],
  [["revoke"], { title: "Revoke", body: "Withdraw access immediately. The record stays for the audit trail." }],
  [["refresh tools"], { title: "Refresh tools", body: "Ask the server for its tool list again. New tools arrive denied until mapped." }],
  [["launch application"], { title: "Launch", body: "Switch from observing to enforcing. Only possible once every launch gate passes." }],
  [["run test login"], { title: "Test login", body: "Prove the full sign-in flow works before real users try it." }],
];

export const GLOSSARY: Map<string, HoverInfo> = new Map(
  ENTRIES.flatMap(([keys, info]) => keys.map((k) => [k, info] as const)),
);
