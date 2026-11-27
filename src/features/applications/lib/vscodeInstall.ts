/**
 * One-click "Install in VS Code" links for a protected MCP server.
 *
 * The link only carries the server's name and URL. VS Code finds AuthSec as the
 * authorization server from the server's 401 response, registers itself as a
 * client, and signs the user in through the AuthSec login and consent pages, so
 * no credential ever goes into the link.
 */

/** VS Code's web redirect page, which hands the install request to the desktop app. */
const VSCODE_INSTALL_REDIRECT = "https://insiders.vscode.dev/redirect/mcp/install";

export type VsCodeQuality = "stable" | "insiders";

export interface McpHttpServerConfig {
  type: "http";
  url: string;
}

/** A server name VS Code accepts as a config key: lowercase letters, digits and dashes. */
export function mcpServerName(applicationName: string): string {
  const slug = applicationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "authsec-mcp";
}

export function mcpServerConfig(resourceUri: string): McpHttpServerConfig {
  return { type: "http", url: resourceUri };
}

/** The https link that opens VS Code (or VS Code Insiders) with the install prompt. */
export function vscodeInstallUrl(
  name: string,
  resourceUri: string,
  quality: VsCodeQuality = "stable",
): string {
  const params = new URLSearchParams({
    name,
    config: JSON.stringify(mcpServerConfig(resourceUri)),
  });
  if (quality === "insiders") params.set("quality", "insiders");
  return `${VSCODE_INSTALL_REDIRECT}?${params.toString()}`;
}

/** The same server as a `.vscode/mcp.json` file, for adding it by hand. */
export function vscodeMcpJson(name: string, resourceUri: string): string {
  return JSON.stringify({ servers: { [name]: mcpServerConfig(resourceUri) } }, null, 2);
}

/** True when the URL can be reached by VS Code at all (https, or http on this machine). */
export function isInstallableResourceUri(resourceUri: string | undefined): resourceUri is string {
  if (!resourceUri) return false;
  try {
    const u = new URL(resourceUri);
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}
