import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { getMeApiV1AuthMeGet } from "./api/generated/clients/getMeApiV1AuthMeGet";
import { loginApiV1AuthLoginPost } from "./api/generated/clients/loginApiV1AuthLoginPost";
import { logoutApiV1AuthLogoutPost } from "./api/generated/clients/logoutApiV1AuthLogoutPost";
import { registerApiV1AuthRegisterPost } from "./api/generated/clients/registerApiV1AuthRegisterPost";
import type { MeOut } from "./api/generated/types/MeOut";
import type { MembershipOut } from "./api/generated/types/MembershipOut";
import { meOutSchema } from "./api/generated/zod/meOutSchema";
import { sessionOutSchema } from "./api/generated/zod/sessionOutSchema";
import { clearTokens, loadTokens, storeTokens, validated } from "./api-client";
import type { Membership, SessionUser } from "./types";

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
  barber: [
    "appointments:complete",
    "customers:view",
    "schedule:manage",
    "reviews:view",
  ],
};

const KNOWN_MEMBERSHIP_ROLES = new Set<Membership["role"]>([
  "owner",
  "manager",
  "barber",
]);

function mapMembership(m: MembershipOut): Membership | null {
  if (!KNOWN_MEMBERSHIP_ROLES.has(m.role as Membership["role"])) return null;
  return {
    shopId: m.shop_id,
    role: m.role as Membership["role"],
    ...(m.barber_id ? { barberId: m.barber_id } : {}),
  };
}

function mapMeToSessionUser(me: MeOut): SessionUser {
  return {
    id: me.id,
    name: me.display_name ?? "",
    email: me.email ?? "",
    ...(me.avatar_url ? { photo: me.avatar_url } : {}),
    memberships: me.memberships
      .map(mapMembership)
      .filter((m): m is Membership => m !== null),
  };
}

interface SessionContextValue {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  signup: (
    name: string,
    email: string,
    password: string,
  ) => Promise<SessionUser>;
  logout: () => void;
  refreshUser: () => Promise<SessionUser>;
  membershipFor: (shopId: string) => Membership | undefined;
  can: (shopId: string, permission: Permission) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchSessionUser(): Promise<SessionUser> {
  const { data } = await getMeApiV1AuthMeGet();
  return mapMeToSessionUser(validated(meOutSchema, data.data));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!loadTokens()) {
        setReady(true);
        return;
      }
      try {
        const restored = await fetchSessionUser();
        if (!cancelled) setUser(restored);
      } catch {
        // Token invalid/expired even after getValidAccessToken's own
        // refresh attempt — there's no session to restore.
        clearTokens();
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(() => {
    // Clears local state immediately regardless of whether the network
    // call succeeds — matching the backend's own idempotent-either-way
    // logout semantics — so no caller needs to await this.
    setUser(null);
    clearTokens();
    void logoutApiV1AuthLogoutPost().catch(() => {
      // Best-effort: the caller's intent (be logged out) is already satisfied locally.
    });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      ready,
      login: async (email, password) => {
        const { data } = await loginApiV1AuthLoginPost({
          body: { email, password },
        });
        storeTokens(validated(sessionOutSchema, data.data));
        const restored = await fetchSessionUser();
        setUser(restored);
        return restored;
      },
      signup: async (name, email, password) => {
        const { data } = await registerApiV1AuthRegisterPost({
          body: { email, password, display_name: name || null },
        });
        storeTokens(validated(sessionOutSchema, data.data));
        const restored = await fetchSessionUser();
        setUser(restored);
        return restored;
      },
      logout,
      refreshUser: async () => {
        const restored = await fetchSessionUser();
        setUser(restored);
        return restored;
      },
      membershipFor: (shopId) =>
        user?.memberships.find((m) => m.shopId === shopId),
      can: (shopId, permission) => {
        const m = user?.memberships.find((x) => x.shopId === shopId);
        if (!m) return false;
        return (ROLE_PERMISSIONS[m.role] ?? []).includes(permission);
      },
    }),
    [user, ready, logout],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
