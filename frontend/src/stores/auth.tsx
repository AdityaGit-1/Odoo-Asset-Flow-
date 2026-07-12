"use client";

import { auth } from "@/api/auth";
import { clearSession, getRefreshToken, onSessionChange, setSession, tryRefreshOnce } from "@/api/client";
import type { Role, SessionUser } from "@/api/types";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Status = "loading" | "authed" | "anon";

interface AuthCtx {
  user: SessionUser | null;
  status: Status;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Silent rehydrate on load: refresh → /auth/me. A reload never logs you out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getRefreshToken()) {
        if (!cancelled) setStatus("anon");
        return;
      }
      const refreshed = await tryRefreshOnce();
      if (!refreshed) {
        clearSession();
        if (!cancelled) setStatus("anon");
        return;
      }
      try {
        const me = await auth.me();
        if (!cancelled) {
          setUser(me);
          setStatus("authed");
        }
      } catch {
        clearSession();
        if (!cancelled) setStatus("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The api client clears the session when a refresh ultimately fails.
  useEffect(
    () =>
      onSessionChange((authed) => {
        if (!authed) {
          setUser(null);
          setStatus("anon");
        }
      }),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await auth.login(email, password);
    setSession(tokens);
    const me = await auth.me();
    setUser(me);
    setStatus("authed");
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      /* revoking is best-effort — clear locally regardless */
    }
    clearSession();
    setUser(null);
    setStatus("anon");
  }, []);

  const hasRole = useCallback((...roles: Role[]) => (user ? roles.includes(user.role) : false), [user]);

  return <Ctx.Provider value={{ user, status, login, logout, hasRole }}>{children}</Ctx.Provider>;
}
