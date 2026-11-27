import config from "@/config";
import type { IdentityKind } from "./docs";

/**
 * "Open in Codespaces" for the AuthSec starter project. The link names only the
 * repository; credentials go in through Codespaces secrets or the codespace's own
 * .env, never through the URL.
 */

/** Identity types the starter can run. SPIFFE needs a SPIRE agent; agents need a user sign-in. */
export const CODESPACES_KINDS: ReadonlySet<IdentityKind> = new Set(["client_secret", "private_key_jwt"]);

export function starterRepo(): string {
  return config.VITE_CODESPACES_STARTER_REPO;
}

export function codespacesUrl(repo: string = starterRepo()): string {
  return `https://codespaces.new/${repo}`;
}

export function starterRepoUrl(repo: string = starterRepo()): string {
  return `https://github.com/${repo}`;
}

export interface StarterEnvContext {
  issuer: string;
  clientId?: string;
  mcpUrl?: string;
  scopes: string[];
  kid?: string;
}

/**
 * The starter's .env, with what the console already knows filled in. The client
 * secret is left as a placeholder on purpose: it was shown once on this screen,
 * and it should be typed into the codespace, not carried around in a clipboard blob.
 */
export function starterEnv(kind: IdentityKind, c: StarterEnvContext): string {
  const lines = [
    `AUTHSEC_ISSUER=${c.issuer}`,
    `AUTHSEC_CLIENT_ID=${c.clientId || "<client id>"}`,
    `MCP_URL=${c.mcpUrl || "<MCP server URL>"}`,
    `AUTHSEC_SCOPES="${c.scopes.join(" ")}"`,
  ];
  if (kind === "private_key_jwt") {
    lines.push(`AUTHSEC_KID=${c.kid || "key-1"}`, "AUTHSEC_PRIVATE_KEY_PATH=private_key.pem");
  } else {
    lines.push("AUTHSEC_CLIENT_SECRET=<paste the client secret here>");
  }
  return lines.join("\n");
}
