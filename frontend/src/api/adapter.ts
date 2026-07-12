// Real-backend adapter — the one place the live Spring API's differences from
// the frontend's canonical contract are reconciled. Only used when
// NEXT_PUBLIC_USE_MOCKS=0; mock mode bypasses all of this.
//
// The real backend: wraps every success in APIResponse<T> ({success,message,data})
// and returns business errors as HTTP 200 with success:false; mounts auth under
// /api/auth with register/verify-email/forgot-password names; and calls the
// transfer queue /api/transfers.

import { ApiError } from "./client";
import type { TokenPair } from "./types";

const AUTH_PATHS: Record<string, string> = {
  "/auth/login": "/api/auth/login",
  "/auth/refresh": "/api/auth/refresh",
  "/auth/logout": "/api/auth/logout",
  "/auth/me": "/api/auth/me",
  "/auth/signup": "/api/auth/register",
  "/auth/forgot": "/api/auth/forgot-password",
  "/auth/reset": "/api/auth/reset-password",
};

/** Frontend canonical path → real backend path. */
export function remapPath(path: string): string {
  const [base, query] = path.split("?");
  const mappedBase =
    AUTH_PATHS[base!] ??
    (base!.startsWith("/api/transfer-requests") ? base!.replace("/api/transfer-requests", "/api/transfers") : base!);
  return query ? `${mappedBase}?${query}` : mappedBase;
}

/** Transform request bodies the real backend expects in a different shape. */
export function adaptRequestBody(path: string, body: unknown): unknown {
  if (path === "/auth/signup" && body && typeof body === "object") {
    const b = body as { name?: string; email: string; password: string; departmentId: number };
    const parts = (b.name ?? "").trim().split(/\s+/);
    return {
      firstName: parts[0] ?? b.name ?? "",
      lastName: parts.slice(1).join(" ") || null,
      email: b.email,
      password: b.password,
      departmentId: b.departmentId,
    };
  }
  return body;
}

/** {accessToken,refreshToken} (real) or {access,refresh} (mock) → TokenPair. */
export function normalizeTokens(raw: unknown): TokenPair | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const access = (r.access ?? r.accessToken) as string | undefined;
  const refresh = (r.refresh ?? r.refreshToken) as string | undefined;
  return access && refresh ? { access, refresh } : null;
}

/**
 * Unwrap APIResponse<T>. Business errors come back HTTP 200 with success:false —
 * turn those into ApiError so screens' error handling fires. Non-envelope bodies
 * pass through unchanged.
 */
export function unwrapEnvelope(status: number, body: unknown): unknown {
  if (body && typeof body === "object" && "success" in body) {
    const env = body as { success: boolean; message?: string; data?: unknown };
    if (env.success === false) {
      throw new ApiError(status >= 400 ? status : 422, env.message ?? "Request failed", body);
    }
    return env.data;
  }
  return body;
}

/** Per-path shape fixes after unwrapping. */
export function adaptResponse(path: string, data: unknown): unknown {
  // The asset directory expects Spring's Page<T>; the backend returns a raw list.
  if (/^\/api\/assets(\?|$)/.test(path) && Array.isArray(data)) {
    return { content: data, totalElements: data.length, totalPages: 1, number: 0, size: data.length };
  }
  // Jackson serializes the entity's isRead() getter as "read"; the UI reads isRead.
  if (/^\/api\/notifications(\?|$)/.test(path) && Array.isArray(data)) {
    return data.map((n) => {
      const item = n as Record<string, unknown>;
      return { ...item, isRead: item.isRead ?? item.read ?? false };
    });
  }
  return data;
}
