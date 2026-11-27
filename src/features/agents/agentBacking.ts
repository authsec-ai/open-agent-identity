import type { WorkspaceServiceAccount } from "@/app/api/agentIdentityApi";
import type { WorkspaceClientItem } from "@/app/api/mcpClientsApi";

/**
 * Registering an agent also creates a service account behind its client, so
 * the agent can later hold service-account role bindings. The backend marks
 * that account with this description; it belongs to the agent, not to the
 * Service Accounts inventory.
 */
export const AGENT_BACKING_DESCRIPTION = "Service account backing agent client";

/** Ids of the agent clients this workspace knows about, both the row id and the OAuth client_id. */
export function agentClientIds(clients: WorkspaceClientItem[] | undefined): Set<string> {
  return new Set((clients ?? []).filter((c) => c.client_kind === "agent").flatMap((c) => [c.id, c.client_id]));
}

export function isAgentBackingAccount(sa: WorkspaceServiceAccount, agentIds: Set<string>): boolean {
  return sa.description === AGENT_BACKING_DESCRIPTION || (Boolean(sa.oauth_client_id) && agentIds.has(sa.oauth_client_id!));
}

/**
 * Agents that are registered but haven't connected to an application yet. The
 * clients list only includes agents with a connection, so these come from their
 * backing service accounts instead.
 */
export function unconnectedAgents(accounts: WorkspaceServiceAccount[] | undefined, agentIds: Set<string>): WorkspaceClientItem[] {
  return (accounts ?? [])
    .filter((sa) => sa.description === AGENT_BACKING_DESCRIPTION && sa.oauth_client_id && !agentIds.has(sa.oauth_client_id))
    .map((sa) => ({
      id: sa.oauth_client_id!,
      client_id: sa.oauth_client_id!,
      client_name: sa.name,
      client_kind: "agent",
      registration_type: "dcr",
      status: "registered",
      sync_status: "active",
      resource_server_id: "",
      resource_server_name: "",
      redirect_uris: [],
      tags: [],
      adopted_elsewhere: false,
      created_at: sa.created_at,
    }));
}
