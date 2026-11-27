import type { BaseQueryFn, FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta } from "@reduxjs/toolkit/query/react";
import { dispatchDemoRequest, normalizePath, type DemoMethod } from "./demo/router";
import { getDemoDb } from "./demo/state";
import "./demo/handlers";

type Fetcher = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, object, FetchBaseQueryMeta>;

const LATENCY_MS = 140;

/** Session actions that stay real in the tutorial: they act on who is signed in, not on workspace data. */
const SESSION_PATHS = [/^\/authsec\/auth\/logout$/, /^\/authsec\/workspaces$/, /^\/authsec\/workspaces\/[^/]+\/switch$/];

/**
 * While Tutorial mode is on, every console request is answered by the
 * in-browser demo backend and never reaches the network, so nothing a user does
 * in the tutorial can touch real data. Only signing in (before there is a
 * session), signing out and switching workspace still reach the real backend.
 */
export function withTutorialMode(baseQuery: Fetcher): Fetcher {
  return async (args, api, extraOptions) => {
    const state = api.getState() as { ui?: { tutorialMode?: boolean }; auth?: { isAuthenticated?: boolean } };
    const url = typeof args === "string" ? args : args.url;
    if (state.ui?.tutorialMode !== true || state.auth?.isAuthenticated !== true) return baseQuery(args, api, extraOptions);
    if (SESSION_PATHS.some((re) => re.test(normalizePath(url).path))) return baseQuery(args, api, extraOptions);

    const method = ((typeof args === "string" ? "GET" : args.method) ?? "GET").toUpperCase() as DemoMethod;
    const params = typeof args === "string" ? undefined : (args.params as Record<string, unknown> | undefined);
    const body = typeof args === "string" ? undefined : args.body;
    const result = dispatchDemoRequest(method, url, params, body, getDemoDb());

    if (result.status === 501 && import.meta.env.DEV) {
      console.warn(`[tutorial] no demo handler for ${method} ${url}`);
    }
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
    if (result.status >= 400) {
      return { error: { status: result.status, data: result.data } as FetchBaseQueryError };
    }
    return { data: result.data };
  };
}
