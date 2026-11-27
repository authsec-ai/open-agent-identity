import { SessionManager } from "@/utils/sessionManager";
import { createSeed, type DemoDb } from "./db";

let current: DemoDb | null = null;

/** Discards every change made in the tutorial and rebuilds the original dataset. */
export function resetDemoDb(): DemoDb {
  const session = SessionManager.getSession();
  const email =
    (session?.user as { email?: string } | undefined)?.email ??
    (session?.jwtPayload as { email_id?: string } | undefined)?.email_id ??
    "you@northwind.example";
  current = createSeed({
    workspaceId: session?.workspace_id || "demo-workspace",
    actorEmail: email,
    now: Date.now(),
  });
  return current;
}

export function getDemoDb(): DemoDb {
  return current ?? resetDemoDb();
}
