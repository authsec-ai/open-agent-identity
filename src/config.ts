// src/config.ts
declare global {
  interface Window {
    ENV?: {
      VITE_API_URL?: string;
      VITE_OAUTH_BASE_URL?: string;
      VITE_CODESPACES_STARTER_REPO?: string;
    };
  }
}

const config = {
  VITE_API_URL:
    window.ENV?.VITE_API_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:7468",
  VITE_OAUTH_BASE_URL:
    window.ENV?.VITE_OAUTH_BASE_URL ||
    window.ENV?.VITE_API_URL ||
    import.meta.env.VITE_OAUTH_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:4444",
  /** GitHub "owner/repo" of the starter project the console opens in Codespaces. */
  VITE_CODESPACES_STARTER_REPO:
    window.ENV?.VITE_CODESPACES_STARTER_REPO ||
    import.meta.env.VITE_CODESPACES_STARTER_REPO ||
    "authsec-ai/authsec-starters",
};

export default config;
