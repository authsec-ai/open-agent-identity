import type { IdentityKind, SnippetLanguage } from "./docs";

/** Values the wizard knows by the time it shows code; anything missing becomes a clear placeholder. */
export interface SnippetContext {
  issuer: string;
  clientId?: string;
  clientSecret?: string;
  mcpUrl?: string;
  scopes: string[];
  kid?: string;
  spiffeId?: string;
}

export interface Snippet {
  id: SnippetLanguage | "env" | "spire" | "keys";
  label: string;
  language: string;
  code: string;
  /** Shown instead of code when this SDK doesn't support the identity type. */
  unsupported?: string;
}

const or = (value: string | undefined, placeholder: string) => (value && value.trim() ? value : placeholder);
const MCP = (c: SnippetContext) => or(c.mcpUrl, "https://your-mcp-server.example.com/mcp");
const pyList = (scopes: string[]) => `[${(scopes.length ? scopes : ["your_scope:read"]).map((s) => `"${s}"`).join(", ")}]`;
const goArgs = (scopes: string[]) => (scopes.length ? scopes : ["your_scope:read"]).map((s) => `"${s}"`).join(", ");

function envBlock(kind: IdentityKind, c: SnippetContext): string {
  const issuer = `AUTHSEC_ISSUER=${c.issuer}`;
  const mcp = `MCP_URL=${MCP(c)}`;
  switch (kind) {
    case "client_secret":
      return [issuer, `SA_CLIENT_ID=${or(c.clientId, "<client id>")}`, `SA_CLIENT_SECRET=${or(c.clientSecret, "<client secret, shown once>")}`, mcp].join("\n");
    case "private_key_jwt":
      return [issuer, `PK_CLIENT_ID=${or(c.clientId, "<client id>")}`, "PK_PRIVATE_KEY_PATH=private_key.pem", `PK_KID=${or(c.kid, "key-1")}`, mcp].join("\n");
    case "kubernetes":
      return [issuer, `SPIFFE_CLIENT_ID=${or(c.clientId, "<client id>")}`, `SPIFFE_ID=${or(c.spiffeId, "spiffe://your-trust-domain/ns/default/sa/your-service-account")}`, mcp].join("\n");
    case "agent":
      return [issuer, `AGENT_CLIENT_ID=${or(c.clientId, "<client id>")}`, `AGENT_CLIENT_SECRET=${or(c.clientSecret, "<client secret, shown once>")}`, mcp].join("\n");
  }
}

const BEARER_NOTE_PY = "        # Send on every MCP request: Authorization: Bearer {token}";

function python(kind: IdentityKind, c: SnippetContext): string {
  const scopes = pyList(c.scopes);
  switch (kind) {
    case "client_secret":
      return `# pip install authsec-sdk python-dotenv
import asyncio
import os

from dotenv import load_dotenv
from authsec_sdk import AgentIdentity, ClientSecretAuth

load_dotenv()


async def main():
    agent = AgentIdentity(
        os.environ["AUTHSEC_ISSUER"],
        os.environ["SA_CLIENT_ID"],
        auth=ClientSecretAuth(os.environ["SA_CLIENT_SECRET"]),
    )
    async with agent:
        token = await agent.access_for(
            os.environ["MCP_URL"],
            requested_scopes=${scopes},
        )
${BEARER_NOTE_PY}


asyncio.run(main())`;
    case "private_key_jwt":
      return `# pip install authsec-sdk python-dotenv
import asyncio
import os

from dotenv import load_dotenv
from authsec_sdk import AgentIdentity, PrivateKeyJwtAuth

load_dotenv()


async def main():
    agent = AgentIdentity(
        os.environ["AUTHSEC_ISSUER"],
        os.environ["PK_CLIENT_ID"],
        auth=PrivateKeyJwtAuth(os.environ["PK_PRIVATE_KEY_PATH"], kid=os.environ["PK_KID"]),
    )
    async with agent:
        token = await agent.access_for(
            os.environ["MCP_URL"],
            requested_scopes=${scopes},
        )
${BEARER_NOTE_PY}


asyncio.run(main())`;
    case "kubernetes":
      return `# pip install authsec-sdk  (runs inside the pod, next to the SPIRE agent socket)
import asyncio
import os

from authsec_sdk import SpiffeWorkloadIdentity, SpiffeConfig


async def main():
    spiffe = SpiffeWorkloadIdentity(
        SpiffeConfig(
            mcp_server_url=os.environ["MCP_URL"],
            client_id=os.environ["SPIFFE_CLIENT_ID"],
            spiffe_id=os.environ["SPIFFE_ID"],
            scopes=${scopes},
            # agent_socket_path defaults to the SPIRE agent's workload API socket
        )
    )
    async with spiffe:
        token = await spiffe.access_for()
${BEARER_NOTE_PY}


asyncio.run(main())`;
    case "agent":
      return `# pip install authsec-sdk python-dotenv
import asyncio
import os

from dotenv import load_dotenv
from authsec_sdk import (
    AgentIdentity,
    ApprovalDeniedError,
    PendingApprovalError,
    browser_login,
    poll_until_approved,
)

load_dotenv()
ISSUER = os.environ["AUTHSEC_ISSUER"]
CLIENT_ID = os.environ["AGENT_CLIENT_ID"]
MCP_URL = os.environ["MCP_URL"]
SCOPES = ${scopes}


async def main():
    # 1. The person signs in; the agent will act for them.
    id_token = await browser_login(issuer=ISSUER, client_id=CLIENT_ID, resource=MCP_URL)
    session = {"subject_token": id_token}

    agent = AgentIdentity(
        issuer=ISSUER,
        client_id=CLIENT_ID,
        client_secret=os.environ["AGENT_CLIENT_SECRET"],
        idp_issuer=ISSUER,
    )
    async with agent:
        try:
            token = await agent.access_for(MCP_URL, user_session=session, requested_scopes=SCOPES)
        except PendingApprovalError as e:
            # 2. First contact: an admin approves the agent in AuthSec, then this returns.
            token = await poll_until_approved(agent, MCP_URL, e.status_url, user_session=session, requested_scopes=SCOPES)
        except ApprovalDeniedError:
            raise SystemExit("An admin denied this agent's access request.")
        # 3. Send on every MCP request: Authorization: Bearer {token}


asyncio.run(main())`;
  }
}

function typescript(kind: IdentityKind, c: SnippetContext): string | null {
  const scopes = pyList(c.scopes);
  switch (kind) {
    case "client_secret":
      return `// npm install @authsec/sdk
import { AgentIdentity } from "@authsec/sdk";

const identity = new AgentIdentity({
  issuer: process.env.AUTHSEC_ISSUER!,
  clientId: process.env.SA_CLIENT_ID!,
  clientSecret: process.env.SA_CLIENT_SECRET!,
});

const token = await identity.accessFor(process.env.MCP_URL!, {
  requestedScopes: ${scopes},
});
// Send on every MCP request: Authorization: Bearer \${token}`;
    case "private_key_jwt":
      return `// npm install @authsec/sdk
import { readFileSync } from "node:fs";
import { AgentIdentity } from "@authsec/sdk";

// The private key in PKCS#8 DER form:
//   openssl pkcs8 -topk8 -nocrypt -in private_key.pem -outform DER -out private_key.der
const pkcs8DerBytes = readFileSync("private_key.der");
const key = await crypto.subtle.importKey(
  "pkcs8",
  pkcs8DerBytes,
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  false,
  ["sign"],
);

const identity = new AgentIdentity({
  issuer: process.env.AUTHSEC_ISSUER!,
  clientId: process.env.PK_CLIENT_ID!,
  privateKey: { key, kid: process.env.PK_KID ?? "${or(c.kid, "key-1")}" },
});

const token = await identity.accessFor(process.env.MCP_URL!, {
  requestedScopes: ${scopes},
});
// Send on every MCP request: Authorization: Bearer \${token}`;
    case "kubernetes":
      return null;
    case "agent":
      return `// npm install @authsec/sdk
import { AgentIdentity, PendingApprovalError, pollUntilApproved } from "@authsec/sdk";

const resource = process.env.MCP_URL!;
const identity = new AgentIdentity({
  issuer: process.env.AUTHSEC_ISSUER!,
  clientId: process.env.AGENT_CLIENT_ID!,
  clientSecret: process.env.AGENT_CLIENT_SECRET!,
  idpIssuer: process.env.AUTHSEC_ISSUER!,
  preferredMode: "auto",
});

// userIdToken: the signed-in person's ID token, from your app's login.
const accessForOptions = {
  userSession: { subject_token: userIdToken },
  requestedScopes: ${scopes},
};

let token: string;
try {
  token = await identity.accessFor(resource, accessForOptions);
} catch (err) {
  if (!(err instanceof PendingApprovalError)) throw err;
  // First contact: an admin approves the agent in AuthSec, then this resolves.
  token = await pollUntilApproved(identity, resource, err.statusUrl, { accessForOptions });
}
// Send on every MCP request: Authorization: Bearer \${token}`;
  }
}

function go(kind: IdentityKind, c: SnippetContext): string {
  const scopes = goArgs(c.scopes);
  const header = (imports: string[]) => `// go get github.com/authsec-ai/sdk-authsec/packages/go-sdk
package main

import (
${imports.map((i) => `\t"${i}"`).join("\n")}

\tauthsec "github.com/authsec-ai/sdk-authsec/packages/go-sdk"
)
`;
  switch (kind) {
    case "client_secret":
      return `${header(["context", "log", "os"])}
func main() {
\tagent := authsec.NewAgentIdentity(authsec.AgentIdentityConfig{
\t\tIssuer:   os.Getenv("AUTHSEC_ISSUER"),
\t\tClientID: os.Getenv("SA_CLIENT_ID"),
\t\tAuth:     authsec.NewClientSecretAuth(os.Getenv("SA_CLIENT_SECRET")),
\t})

\ttoken, err := agent.AccessFor(context.Background(), os.Getenv("MCP_URL"),
\t\tauthsec.WithRequestedScopes(${scopes}))
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\t_ = token // Send on every MCP request: Authorization: Bearer <token>
}`;
    case "private_key_jwt":
      return `${header(["context", "log", "os"])}
func main() {
\tauth, err := authsec.NewPrivateKeyJwtAuth(os.Getenv("PK_PRIVATE_KEY_PATH"), os.Getenv("PK_KID"))
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\tagent := authsec.NewAgentIdentity(authsec.AgentIdentityConfig{
\t\tIssuer:   os.Getenv("AUTHSEC_ISSUER"),
\t\tClientID: os.Getenv("PK_CLIENT_ID"),
\t\tAuth:     auth,
\t})

\ttoken, err := agent.AccessFor(context.Background(), os.Getenv("MCP_URL"),
\t\tauthsec.WithRequestedScopes(${scopes}))
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\t_ = token // Send on every MCP request: Authorization: Bearer <token>
}`;
    case "kubernetes":
      return `${header(["context", "log", "os"])}
func main() {
\tworkload, err := authsec.NewSpiffeWorkloadIdentity(authsec.SpiffeConfig{
\t\tMCPServerURL: os.Getenv("MCP_URL"),
\t\tClientID:     os.Getenv("SPIFFE_CLIENT_ID"),
\t\tSpiffeID:     os.Getenv("SPIFFE_ID"),
\t\tScopes:       "${(c.scopes.length ? c.scopes : ["your_scope:read"]).join(" ")}",
\t\t// AgentSocketPath defaults to the SPIRE agent's workload API socket
\t})
\tif err != nil {
\t\tlog.Fatal(err)
\t}

\ttoken, err := workload.AccessFor(context.Background())
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\t_ = token // Send on every MCP request: Authorization: Bearer <token>
}`;
    case "agent":
      return `${header(["context", "errors", "log", "os"])}
func main() {
\tctx := context.Background()
\tissuer := os.Getenv("AUTHSEC_ISSUER")
\tclientID := os.Getenv("AGENT_CLIENT_ID")
\tresource := os.Getenv("MCP_URL")

\t// 1. The person signs in; the agent will act for them.
\tidToken, err := authsec.BrowserLogin(ctx, issuer, clientID, &authsec.BrowserLoginOptions{Resource: resource})
\tif err != nil {
\t\tlog.Fatal(err)
\t}

\tagent := authsec.NewAgentIdentity(authsec.AgentIdentityConfig{
\t\tIssuer:    issuer,
\t\tClientID:  clientID,
\t\tAuth:      authsec.NewClientSecretAuth(os.Getenv("AGENT_CLIENT_SECRET")),
\t\tIDPIssuer: issuer,
\t})
\topts := []authsec.AccessForOption{
\t\tauthsec.WithUserSession(idToken),
\t\tauthsec.WithRequestedScopes(${scopes}),
\t}

\ttoken, err := agent.AccessFor(ctx, resource, opts...)
\tvar pending *authsec.PendingApprovalError
\tif errors.As(err, &pending) {
\t\t// 2. First contact: an admin approves the agent in AuthSec, then this returns.
\t\ttoken, err = authsec.PollUntilApproved(ctx, agent, resource, pending.StatusURL, nil, opts...)
\t}
\tvar denied *authsec.ApprovalDeniedError
\tif errors.As(err, &denied) {
\t\tlog.Fatal("an admin denied this agent's access request")
\t}
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\t_ = token // 3. Send on every MCP request: Authorization: Bearer <token>
}`;
  }
}

function spireEntry(spiffeId: string | undefined): string {
  const id = or(spiffeId, "spiffe://your-trust-domain/ns/default/sa/your-service-account");
  const m = /^spiffe:\/\/([^/]+)\/ns\/([^/]+)\/sa\/([^/]+)$/.exec(id);
  const [domain, ns, sa] = m ? [m[1], m[2], m[3]] : ["your-trust-domain", "default", "your-service-account"];
  return `# 1. Register the workload with SPIRE (run against your SPIRE server)
spire-server entry create \\
  -spiffeID ${id} \\
  -parentID spiffe://${domain}/spire-agent \\
  -selector k8s:ns:${ns} \\
  -selector k8s:sa:${sa}

# 2. Mount the SPIRE agent socket into the pod
volumes:
  - name: spire-agent-socket
    hostPath:
      path: /run/spire/sockets
      type: Directory
containers:
  - name: app
    volumeMounts:
      - name: spire-agent-socket
        mountPath: /run/spire/sockets
        readOnly: true`;
}

const KEY_GEN = `# Generate a key pair; keep private_key.pem secret
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Publish the public key as a JWKS at a URL that returns raw JSON:
# { "keys": [ { "kty": "RSA", "use": "sig", "alg": "RS256", "kid": "key-1", "n": "…", "e": "AQAB" } ] }`;

/** Every snippet for one identity type, in the order the wizard shows them. */
export function snippetsFor(kind: IdentityKind, c: SnippetContext): Snippet[] {
  const out: Snippet[] = [{ id: "env", label: ".env", language: "bash", code: envBlock(kind, c) }];
  if (kind === "kubernetes") out.push({ id: "spire", label: "SPIRE + pod", language: "yaml", code: spireEntry(c.spiffeId) });
  if (kind === "private_key_jwt") out.push({ id: "keys", label: "Keys", language: "bash", code: KEY_GEN });
  out.push({ id: "python", label: "Python", language: "python", code: python(kind, c) });
  const ts = typescript(kind, c);
  out.push(
    ts
      ? { id: "typescript", label: "TypeScript", language: "typescript", code: ts }
      : { id: "typescript", label: "TypeScript", language: "typescript", code: "", unsupported: "The TypeScript SDK doesn't support SPIFFE workload identity yet. Use the Python or Go SDK inside the pod." },
  );
  out.push({ id: "go", label: "Go", language: "go", code: go(kind, c) });
  return out;
}

export { KEY_GEN };
