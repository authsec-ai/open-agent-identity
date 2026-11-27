import { useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { useTutorialMode } from "@/hooks/useTutorialMode";
import type { DemoDb } from "./demo/db";
import { getDemoDb, notifyDemoChange } from "./demo/state";
import { baseApi } from "@/app/api/baseApi";

const TICK_MS = 5_000;
const ROUTINE_EVERY = 3;

/** A fixed rotation, so every demo shows the same kind of traffic. */
const ROUTINE: Array<{ client: string; app: string; subject: string; scopes: string; userEmail?: string }> = [
  { client: "Support Copilot", app: "Customer Data API", subject: "agent", scopes: "customers:read" },
  { client: "Claude Desktop", app: "GitHub MCP Server", subject: "user", scopes: "repo:read", userEmail: "aisha.bello@northwind.example" },
  { client: "Billing Sync", app: "Payments Ledger MCP", subject: "service_account", scopes: "ledger:read invoices:create" },
  { client: "Code Review Agent", app: "GitHub MCP Server", subject: "agent", scopes: "repo:read pull_requests:write" },
  { client: "Cursor", app: "GitHub MCP Server", subject: "user", scopes: "repo:read repo:write", userEmail: "ravi.iyer@northwind.example" },
  { client: "Finance Reconciler", app: "Payments Ledger MCP", subject: "agent", scopes: "ledger:read" },
];

let tick = 0;
let cursor = 0;

function addM2M(db: DemoDb, row: Omit<DemoDb["m2mLogs"][number], "id" | "createdAt" | "workspaceId" | "tokenFamily">) {
  const next = Math.max(0, ...db.m2mLogs.map((l) => Number(l.id.replace(/\D/g, "")) || 0)) + 1;
  db.m2mLogs.unshift({
    id: `m2m-${String(next).padStart(5, "0")}`,
    createdAt: new Date().toISOString(),
    workspaceId: db.workspaceId,
    tokenFamily: `tf-live-${next}`,
    ...row,
  });
}

function addAuth(db: DemoDb, userId: string, action: string) {
  const next = (db.authLogs[0]?.id ?? 0) + 1;
  db.authLogs.unshift({
    id: next,
    timestamp: new Date().toISOString(),
    requestId: `req-live-${next}`,
    workspaceId: db.workspaceId,
    actorRealm: "enduser",
    userId,
    action,
    status: "success",
    ipAddress: "198.51.100.27",
    userAgent: "Claude-Desktop/1.9.2 (darwin)",
  });
}

/** One step of the simulated workspace. Returns true when anything changed. */
function step(db: DemoDb): boolean {
  tick += 1;
  let changed = false;

  // Scenario reaction: once the payout request is denied, Release Bot's next try is blocked.
  const denied = db.requests.find((r) => r.requester_name === "Release Bot" && r.status === "denied");
  if (denied && !db.m2mLogs.some((l) => l.pdpReason?.includes("request was denied"))) {
    const bot = db.clients.find((c) => c.client_name === "Release Bot");
    const ledger = db.applications.find((a) => a.name === "Payments Ledger MCP");
    if (bot && ledger) {
      addM2M(db, {
        clientId: bot.client_id,
        subjectType: "agent",
        resourceServerId: ledger.id,
        pdpEffect: "deny",
        gateEffect: "deny",
        pdpAgrees: true,
        scopesRequested: "ledger:read payouts:approve",
        scopesGranted: "",
        pdpReason: "access request was denied by an admin; payouts:approve is not granted",
      });
      changed = true;
    }
  }

  if (tick % ROUTINE_EVERY === 0) {
    const r = ROUTINE[cursor % ROUTINE.length];
    cursor += 1;
    const client = db.clients.find((c) => c.client_name === r.client && c.status === "approved");
    const target = db.applications.find((a) => a.name === r.app);
    if (client && target) {
      addM2M(db, { clientId: client.client_id, subjectType: r.subject, resourceServerId: target.id, pdpEffect: "permit", gateEffect: "permit", pdpAgrees: true, scopesRequested: r.scopes, scopesGranted: r.scopes });
      if (r.userEmail) addAuth(db, r.userEmail, "token.refresh");
      changed = true;
    }
  }
  return changed;
}

/** Keeps the demo workspace moving while Tutorial mode is on. */
export function useTutorialLiveFeed(): void {
  const enabled = useTutorialMode();
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (step(getDemoDb())) {
        notifyDemoChange();
        dispatch(baseApi.util.invalidateTags(["Log"]));
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled, dispatch]);
}
