import type { BaseQueryFn, FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta } from "@reduxjs/toolkit/query/react";
import { isSignInRequest } from "@/auth/unauthorized";
import { dispatchDemoRequest, type DemoMethod } from "./demo/router";
import { getDemoDb } from "./demo/state";
import "./demo/handlers";

type Fetcher = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, object, FetchBaseQueryMeta>;

const LATENCY_MS = 140;

/**
 * While Tutorial mode is on, every console request is answered by the
 * in-browser demo backend and never reaches the network, so nothing a user does
 * in the tutorial can touch real data. Signing in and out still go to the real
 * backend: they belong to the session, not to the workspace's data.
 */
export function withTutorialMode(baseQuery: Fetcher): Fetcher {
  return async (args, api, extraOptions) => {
    const tutorial = (api.getState() as { ui?: { tutorialMode?: boolean } }).ui?.tutorialMode === true;
    const url = typeof args === "string" ? args : args.url;
    if (!tutorial || isSignInRequest(url)) return baseQuery(args, api, extraOptions);

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
