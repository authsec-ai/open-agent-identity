import { SessionManager } from "@/utils/sessionManager";
import { createSeed, type DemoDb } from "./db";

let current: DemoDb | null = null;
let version = 0;
const listeners = new Set<() => void>();

/** Tells walkthroughs (and anything else watching) that the demo data changed. */
export function notifyDemoChange(): void {
  version += 1;
  for (const l of listeners) l();
}

export function subscribeDemo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function demoVersion(): number {
  return version;
}

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
  notifyDemoChange();
  return current;
}

export function getDemoDb(): DemoDb {
  return current ?? resetDemoDb();
}
