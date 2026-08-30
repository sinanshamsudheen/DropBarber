import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { SessionUser } from "./types";

const STORAGE_KEY = "drop.session";

/** Demo accounts — replaced by real auth (JWT/session) later. */
export const DEMO_USERS: Record<string, SessionUser> = {
  "john@example.com": {
    id: "cus-you",
    name: "John Fernandes",
    email: "john@example.com",
    memberships: [],
  },
  "owner@fadeandco.com": {
    id: "usr-owner",
    name: "Deepa Iyer",
    email: "owner@fadeandco.com",
    memberships: [
      { shopId: "shop-fade", role: "owner" },
      { shopId: "shop-neon", role: "manager" },
    ],
  },
  "raj@fadeandco.com": {
    id: "usr-raj",
    name: "Raj Menon",
    email: "raj@fadeandco.com",
    memberships: [{ shopId: "shop-fade", role: "barber", barberId: "brb-raj" }],
  },
};

export type Permission =
  | "appointments:view_all"
  | "appointments:complete"
  | "customers:view"
  | "barbers:manage"
  | "services:manage"
  | "schedule:manage"
  | "reviews:view"
  | "settings:manage"
  | "points:view_all";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [
    "appointments:view_all",
    "appointments:complete",
    "customers:view",
    "barbers:manage",
    "services:manage",
    "schedule:manage",
    "reviews:view",
    "settings:manage",
    "points:view_all",
  ],
  manager: [
    "appointments:view_all",
    "appointments:complete",
    "customers:view",
    "barbers:manage",
    "services:manage",
    "schedule:manage",
    "reviews:view",
    "points:view_all",
  ],
  barber: ["appointments:complete", "customers:view", "schedule:manage", "reviews:view"],
};

interface SessionContextValue {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string) => SessionUser | null;
  signup: (name: string, email: string) => SessionUser;
  logout: () => void;
  membershipFor: (shopId: string) => SessionUser["memberships"][number] | undefined;
  can: (shopId: string, permission: Permission) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as SessionUser);
    } catch {
      /* ignore corrupt session */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: SessionUser | null) => {
    setUser(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      ready,
      login: (email) => {
        const found = DEMO_USERS[email.trim().toLowerCase()];
        if (!found) return null;
        persist(found);
        return found;
      },
      signup: (name, email) => {
        const created: SessionUser = {
          id: "cus-you",
          name,
          email: email.trim().toLowerCase(),
          memberships: [],
        };
        persist(created);
        return created;
      },
      logout: () => persist(null),
      membershipFor: (shopId) => user?.memberships.find((m) => m.shopId === shopId),
      can: (shopId, permission) => {
        const m = user?.memberships.find((x) => x.shopId === shopId);
        if (!m) return false;
        return (ROLE_PERMISSIONS[m.role] ?? []).includes(permission);
      },
    }),
    [user, ready, persist],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
