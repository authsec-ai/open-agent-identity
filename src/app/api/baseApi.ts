import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import config from '../../config';
import { withLoginTicket } from "../../auth/loginTicket";
import { withUnauthorizedHandler } from "../../auth/unauthorized";
import { SessionManager } from "../../utils/sessionManager";

// Define base types for the API
export interface ApiResponse<T> {
  data: T;
  error?: string;
  count?: number;
}

export interface ApiError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface FilterParams {
  search?: string;
  status?: string;
  type?: string;
  [key: string]: string | number | boolean | undefined;
}

// Session data with the workspace and identity taken from the token
// (SessionManager prefers its claims over the stored copies).
const getSessionData = () => SessionManager.getSession();

// Standard AuthSec API query function (clean, no auto-injection)
const baseQuery = fetchBaseQuery({
  baseUrl: config.VITE_API_URL || "http://localhost:7468",
  timeout: 30000, // 30 second timeout
  credentials: "include", // Include cookies in requests
  prepareHeaders: (headers) => {
    const session = getSessionData();
    if (session?.token) {
      headers.set("Authorization", `Bearer ${session.token}`);
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  },
});

// Helper function to inject session data when needed
// Older endpoints still expect these in the body. They are filled from the
// session token, and the server rejects any workspace other than the token's.
export const withSessionData = (body: any) => {
  const session = getSessionData();
  return {
    ...body,
    workspace_id: session?.workspace_id || body.workspace_id || "",
    client_id: session?.client_id || body.client_id || "",
    project_id: session?.project_id || body.project_id || "",
  };
};

// Create the base API using the configured runtime origin.
export const baseApi = createApi({
  reducerPath: "baseApi",
  // Sign-in steps carry the login ticket from the first-factor response; a
  // 401 on a signed-in request ends the session (UI-011).
  baseQuery: withLoginTicket(withUnauthorizedHandler(baseQuery)),
  tagTypes: [
    "Auth",
    "AdminAuth",
    "MFAAuth",
    "AuthMethod",
    // Legacy RBAC tags (deprecated - use namespaced versions)
    "AuthSecRole",
    "AuthSecGroup",
    "AuthSecResource",
    "AuthSecScope",
    "AuthSecPermission",
    "AuthSecResourceMethod",
    // Admin RBAC tags (namespaced)
    "AdminRBACRole",
    "AdminRBACGroup",
    "AdminRBACResource",
    "AdminRBACScope",
    "AdminRBACPermission",
    // EndUser RBAC tags (namespaced)
    "EndUserRBACRole",
    "EndUserRBACGroup",
    "EndUserRBACResource",
    "EndUserRBACScope",
    "EndUserRBACPermission",
    // Unified RBAC tags (namespaced)
    "UnifiedRBACRole",
    "UnifiedRBACGroup",
    "UnifiedRBACResource",
    "UnifiedRBACScope",
    "UnifiedRBACPermission",
    // Non-RBAC tags
    "AuthSecClient",
    "Client",
    "OIDCProvider",
    "AuthMethodOIDCProvider",
    "SamlProvider",
    "SamlMetadata",
    "IdentityProvider",
    "ApplicationIDPPolicy",
    "ClientAuthMethods",
    "AuthSecWorkspace",
    "User",
    "Resource",
    "Scope",
    "Role",
    "Group",
    "RolePermission",
    "UserStats",
    "UserAnalytics",
    "RoleAnalytics",
    "ResourceAnalytics",
    "UserIdentity",
    "MFA",
    "WebAuthn",
    "TOTP",
    "ExternalService",
    "Workload",
    "Entry",
    "Agent",
    "DashboardEndUser",
    "DashboardStats",
    "Dashboard",
    "DashboardUserStats",
    "DashboardUserAnalytics",
    "AdminUser",
    "EndUser",
    "UnifiedUser",
    "UserAuth",
    "SyncConfig",
    "Log",
    "LogConfigurationStatus",
    "ScopeMatrix",
    "ApplicationRole",
    "ApplicationAccess",
    "ScopeCatalog",
    "EffectiveAccess",
    "OAuthScope",
    "MCPTool",
    "ConsentGrant",
    "CustomDomain",
    "DelegationPolicy",
    "Delegation",
    "DelegationLog",
    "ResourceServer",
    "ResourceServerClient",
    // Phase A: v2 membership + end-user state
    "WorkspaceMembership",
    "WorkspaceEndUserState",
    "RoleBinding",
    "MCPClient",
    // Agent Identity — Wave 1
    "AccessAssignment",
    "AgentRequest",
    "AgentConnection",
    // Agent Identity — Wave 2
    "TrustedIssuer",
    // Discovery (prototype — see app/api/discoveryApi.ts)
    "DiscoverySource",
    "DiscoveredAgent",
    "DiscoveredIdentity",
    "AgentCoverage",
    // The workspace GitHub App, and where it is installed. The installation
    // list is read live from GitHub, so it also changes when a source is
    // deleted here (freeing an organisation to be added again).
    "GitHubApp",
    "GitHubInstallation",
    // Scan runs, tagged by BOTH run id and source id: the poller holds one run,
    // the history holds a source's list, and finishing a run changes both.
  ],
  endpoints: () => ({}),
});

// Export types for use in other API slices
export type BaseQueryFn = typeof baseQuery;
