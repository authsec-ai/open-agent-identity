const BASE = "https://docs.authsec.dev";

export type IdentityKind = "client_secret" | "private_key_jwt" | "kubernetes" | "agent";
export type SnippetLanguage = "python" | "typescript" | "go";

interface KindDocs {
  /** The step-by-step guide for this identity type. */
  guide: string;
  /** SDK reference per language; absent when that SDK doesn't support the type. */
  sdk: Partial<Record<SnippetLanguage, string>>;
  concept?: string;
}

/** The exact docs page for each identity type, so the console never links to a generic overview. */
export const IDENTITY_DOCS: Record<IdentityKind, KindDocs> = {
  client_secret: {
    guide: `${BASE}/connect/client-secret`,
    sdk: { python: `${BASE}/sdk/python/m2m/client-secret`, typescript: `${BASE}/sdk/typescript`, go: `${BASE}/sdk/go/m2m/client-secret` },
  },
  private_key_jwt: {
    guide: `${BASE}/connect/private-key-jwt`,
    sdk: { python: `${BASE}/sdk/python/m2m/private-key-jwt`, typescript: `${BASE}/sdk/typescript`, go: `${BASE}/sdk/go/m2m/private-key-jwt` },
  },
  kubernetes: {
    guide: `${BASE}/connect/kubernetes-spiffe`,
    concept: `${BASE}/concepts/workload-identity-and-spiffe`,
    sdk: { python: `${BASE}/sdk/python/m2m/spiffe`, go: `${BASE}/sdk/go/m2m/spiffe` },
  },
  agent: {
    guide: `${BASE}/connect/idjag-agents`,
    sdk: { python: `${BASE}/sdk/python/idjag-delegation`, typescript: `${BASE}/sdk/typescript`, go: `${BASE}/sdk/go/idjag-delegation` },
  },
};

export const CONNECT_OVERVIEW_DOCS = `${BASE}/connect`;
export const SCOPES_DOCS = `${BASE}/concepts/what-are-scopes`;
