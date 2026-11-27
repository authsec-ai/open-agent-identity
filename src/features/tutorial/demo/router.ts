import type { DemoDb } from "./db";

export type DemoMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface DemoRequest {
  method: DemoMethod;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
  db: DemoDb;
}

export interface DemoResponse {
  status: number;
  data: unknown;
}

type Handler = (req: DemoRequest) => DemoResponse;

interface Route {
  method: DemoMethod;
  pattern: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];

function compile(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = pattern
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) {
        keys.push(part.slice(1));
        return "([^/]+)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${source}/?$`), keys };
}

/** Registers a demo endpoint. Path patterns use `:name` segments, e.g. `/authsec/applications/:id`. */
export function demoRoute(method: DemoMethod, pattern: string, handler: Handler): void {
  const { regex, keys } = compile(pattern);
  routes.push({ method, pattern, regex, keys, handler });
}

export const ok = (data: unknown): DemoResponse => ({ status: 200, data });
export const created = (data: unknown): DemoResponse => ({ status: 201, data });
export const notFound = (what = "Resource"): DemoResponse => ({
  status: 404,
  data: { error: `${what} not found in the tutorial workspace` },
});
export const badRequest = (message: string): DemoResponse => ({ status: 400, data: { error: message } });

export function normalizePath(url: string): { path: string; query: URLSearchParams } {
  const parsed = new URL(url.startsWith("/") ? url : `/${url}`, "http://demo.local");
  return { path: parsed.pathname.replace(/\/+$/, "") || "/", query: parsed.searchParams };
}

export function dispatchDemoRequest(
  method: DemoMethod,
  url: string,
  extraParams: Record<string, unknown> | undefined,
  body: unknown,
  db: DemoDb,
): DemoResponse {
  const { path, query } = normalizePath(url);
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined && value !== null) query.set(key, String(value));
    }
  }
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = route.regex.exec(path);
    if (!match) continue;
    const params: Record<string, string> = {};
    route.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match[i + 1]);
    });
    const parsedBody = typeof body === "string" ? safeJson(body) : body;
    const response = route.handler({
      method,
      path,
      params,
      query,
      body: (parsedBody && typeof parsedBody === "object" ? parsedBody : {}) as Record<string, unknown>,
      db,
    });
    return { status: response.status, data: structuredClone(response.data) };
  }
  return {
    status: 501,
    data: { error: "This part of the console has no tutorial data yet", path, method },
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
