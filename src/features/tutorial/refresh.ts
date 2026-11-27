import { baseApi } from "@/app/api/baseApi";

// Every tag a demo-side change can affect. Changes made outside a mutation
// (a walkthrough's "Do it for me", the live feed) refresh the pages through these.
const DEMO_TAGS = [
  "ResourceServer",
  "ScopeMatrix",
  "OAuthScope",
  "ApplicationRole",
  "ApplicationAccess",
  "AccessAssignment",
  "AgentRequest",
  "AgentConnection",
  "MCPClient",
  "Log",
  "WorkspaceEndUserState",
  "EndUser",
  "AdminUser",
  "RoleBinding",
  "EffectiveAccess",
  "ConsentGrant",
  "UnifiedRBACRole",
  "Dashboard",
] as const;

export function refreshDemoQueries(dispatch: (action: unknown) => unknown): void {
  dispatch(baseApi.util.invalidateTags([...DEMO_TAGS]));
}
