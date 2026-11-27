/**
 * Definitions for the console's core vocabulary, shown by <TermTooltip> in
 * Tutorial mode. Each says what the thing really is, then why it matters.
 */
export interface TermDefinition {
  title: string;
  description: string;
  why?: string;
}

export const TERMS = {
  // ── Application readiness ─────────────────────────────────────────────
  "column.readiness": {
    title: "Readiness",
    description: "How far the application is from being protected: registered, set up, then launched.",
    why: "Only launched applications enforce access on every tool call.",
  },
  "readiness.launched": {
    title: "Launched",
    description: "AuthSec is enforcing access on this server. Every tool call needs a valid token that carries the scope the tool requires.",
  },
  "readiness.ready": {
    title: "Ready to launch",
    description: "Every launch gate passes. The server is still observing, not enforcing, until an admin launches it.",
  },
  "readiness.setup": {
    title: "In setup",
    description: "Registered, but not every launch gate passes yet. Open the application's Overview to see what is missing.",
  },
  "readiness.blocked": {
    title: "Blocked",
    description: "AuthSec can't verify this server — usually its tool scan or protection check failed. It cannot launch until that is fixed.",
  },
  "readiness.review": {
    title: "Needs review",
    description: "Part of the setup exists but an admin still has to review it, such as tools that aren't mapped to scopes or access with no default role.",
  },

  // ── Risk ──────────────────────────────────────────────────────────────
  "column.risk": {
    title: "Risk",
    description: "How much damage misuse could cause, driven by the most dangerous permission involved.",
    why: "High and critical items should be granted to few roles and reviewed often.",
  },
  "risk.low": {
    title: "Low risk",
    description: "Read-only or easily reversed, such as reading a repository or a customer record.",
  },
  "risk.medium": {
    title: "Medium risk",
    description: "Changes data, but mistakes can be undone, such as pushing to a branch or editing a contact.",
  },
  "risk.high": {
    title: "High risk",
    description: "Can cause real damage or expose sensitive data, such as issuing refunds or exporting every customer.",
    why: "Grant only to the roles that genuinely need it.",
  },
  "risk.critical": {
    title: "Critical risk",
    description: "Irreversible or organisation-wide, such as approving payouts or administering the GitHub organisation.",
    why: "Keep to one narrowly held role and review who has it.",
  },

  // ── Clients ───────────────────────────────────────────────────────────
  "column.kind": {
    title: "Client kind",
    description: "What is connecting: an app a person uses, an AI agent, a background job or a command-line tool.",
    why: "Agents and jobs act without a person clicking, so their access deserves the closest look.",
  },
  "kind.human_app": {
    title: "Human app",
    description: "An application a person uses directly, such as Claude Desktop or an IDE. It acts only while that person is signed in.",
  },
  "kind.agent": {
    title: "Agent",
    description: "AI software that acts on a person's behalf. Its tokens carry both the agent's and the person's identity, so it can never exceed that person's access.",
  },
  "kind.m2m": {
    title: "Machine to machine",
    description: "A background service that calls the application on its own, with no person involved. It authenticates with its own credential.",
  },
  "kind.cli": {
    title: "CLI",
    description: "A command-line tool a developer runs, signing in through the browser once and then using a token.",
  },
  "column.registration": {
    title: "Registration",
    description: "How the client got its identity in this workspace.",
  },
  "registration.dcr": {
    title: "Dynamic registration",
    description: "The client registered itself the first time it connected (OAuth Dynamic Client Registration). Common for desktop AI apps.",
  },
  "registration.prereg": {
    title: "Pre-registered",
    description: "An admin created this client ahead of time and handed over its credentials. Used for your own agents and services.",
  },
  "registration.cimd": {
    title: "Client metadata document",
    description: "The client is described by a document hosted at its own URL, so its identity is tied to a domain its owner controls.",
  },
  "column.clientStatus": {
    title: "Status",
    description: "Whether this client may currently obtain tokens.",
  },
  "clientStatus.approved": {
    title: "Approved",
    description: "Allowed to connect and obtain tokens. It still only receives the scopes its role grants.",
  },
  "clientStatus.pending_approval": {
    title: "Pending approval",
    description: "Registered from another workspace and waiting for an admin. Until approved it receives no tokens at all.",
  },
  "clientStatus.revoked": {
    title: "Revoked",
    description: "No longer allowed to obtain tokens. Its history is kept for the audit trail.",
  },

  // ── Tools ─────────────────────────────────────────────────────────────
  "column.runtimeAccess": {
    title: "Runtime access",
    description: "What happens when an agent calls this tool after launch.",
    why: "Every tool needs a decision; there is no implicit access.",
  },
  "access.public": {
    title: "Public",
    description: "Callable without a token. Reserved for harmless tools such as health checks.",
  },
  "access.gated": {
    title: "Role-gated",
    description: "The caller's token must carry the tool's scope, which only roles granting that scope provide.",
  },
  "access.denied": {
    title: "Denied",
    description: "No scope is mapped yet, so every call is refused. New tools always start here until an admin decides.",
  },

  // ── People ────────────────────────────────────────────────────────────
  "userStatus.active": {
    title: "Active",
    description: "Can sign in, and agents can act on this person's behalf within their roles.",
  },
  "userStatus.suspended": {
    title: "Suspended",
    description: "Cannot sign in, and every token issued to them or to agents acting for them is refused. History is kept for audits.",
  },

  // ── Decisions ─────────────────────────────────────────────────────────
  "decision.pdp": {
    title: "Policy decision (PDP)",
    description: "What the policy engine concluded when it evaluated the request, with its reason.",
  },
  "decision.gate": {
    title: "Gate decision",
    description: "Whether the token was actually issued. This is the decision that takes effect.",
    why: "When the PDP and gate disagree, a policy didn't cover the case and the gate used its default — worth a policy.",
  },

  // ── Machine identities and connections ─────────────────────────────────
  "column.authMethod": {
    title: "Auth method",
    description: "How the service account proves its identity: a client secret, a signed JWT from its own key, or its Kubernetes workload identity.",
    why: "Keys and workload identities can't be copied out of a config file the way a secret can.",
  },
  "column.authority": {
    title: "Authority",
    description: "Whose permissions this connection acts with — a person or a service account.",
  },
  "column.grantedThrough": {
    title: "Granted through",
    description: "The role that gives this connection its scopes. Change the role to change what the connection can do.",
  },
} satisfies Record<string, TermDefinition>;

export type TermKey = keyof typeof TERMS;

/** The risk term for a backend risk level, if it is one AuthSec defines. */
export function riskTerm(level: string | undefined): TermKey | undefined {
  return level === "low" || level === "medium" || level === "high" || level === "critical" ? `risk.${level}` : undefined;
}
