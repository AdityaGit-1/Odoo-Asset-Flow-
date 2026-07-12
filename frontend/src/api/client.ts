// The single typed client every API call goes through. Points at the gateway
// (NEXT_PUBLIC_API_BASE) — never a service port. Owns tokens and the refresh
// dance so no component ever touches a raw token.

import type { TokenPair } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";
export const MOCKS_ENABLED = process.env.NEXT_PUBLIC_USE_MOCKS === "1";

/**
 * Carries the HTTP status AND the parsed response body — the 409 conflict
 * payloads (currentHolder / booking overlap) depend on reading it. Never
 * collapse errors to a string.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  static async from(res: Response): Promise<ApiError> {
    let body: unknown = null;
    let message = `Request failed (${res.status})`;
    const text = await res.text().catch(() => "");
    if (text) {
      try {
        body = JSON.parse(text);
        const b = body as { message?: unknown; error?: unknown };
        if (typeof b.message === "string" && b.message) message = b.message;
        else if (typeof b.error === "string" && b.error) message = b.error;
      } catch {
        body = text;
        if (text.length < 200) message = text;
      }
    }
    return new ApiError(res.status, message, body);
  }

  /** Directional fallback text for unexpected failures. */
  get direction(): string {
    if (this.status === 403) return "You don't have access to this action.";
    if (this.status === 401) return "Your session expired — sign in again.";
    if (this.status >= 500) return "The server couldn't complete this — try again in a moment.";
    return this.message;
  }
}

export function isApiError(e: unknown, status?: number): e is ApiError {
  return e instanceof ApiError && (status === undefined || e.status === status);
}

// ---- Token holding -----------------------------------------------------------
// Access token lives in memory only. The refresh token is persisted so a page
// reload can silently rehydrate the session (hackathon-pragmatic stand-in for an
// httpOnly cookie set by the gateway — swap when the gateway supports it).

const REFRESH_KEY = "assetflow.refresh";

let accessToken: string | null = null;

type SessionListener = (authed: boolean) => void;
const sessionListeners = new Set<SessionListener>();

export function onSessionChange(fn: SessionListener): () => void {
  sessionListeners.add(fn);
  return () => sessionListeners.delete(fn);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setSession(tokens: TokenPair): void {
  accessToken = tokens.access;
  try {
    window.localStorage.setItem(REFRESH_KEY, tokens.refresh);
  } catch {
    /* private mode — session just won't survive reload */
  }
  sessionListeners.forEach((fn) => fn(true));
}

export function clearSession(): void {
  accessToken = null;
  try {
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
  sessionListeners.forEach((fn) => fn(false));
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/login?next=${next}`);
}

// ---- Transport ----------------------------------------------------------------
// Real fetch or the in-browser mock — same Response interface, so everything
// above it (errors, refresh, typing) is identical in both modes.

async function transport(path: string, init: RequestInit): Promise<Response> {
  if (MOCKS_ENABLED) {
    const { mockFetch } = await import("./mock/router");
    return mockFetch(path, init);
  }
  const { remapPath } = await import("./adapter");
  return fetch(`${BASE}${remapPath(path)}`, init);
}

// ---- Refresh-once, shared in-flight promise -----------------------------------

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await transport("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    let payload: unknown = await res.json();
    if (!MOCKS_ENABLED) {
      const { unwrapEnvelope } = await import("./adapter");
      payload = unwrapEnvelope(res.status, payload);
    }
    const { normalizeTokens } = await import("./adapter");
    const tokens = normalizeTokens(payload);
    if (!tokens) return false;
    setSession(tokens);
    return true;
  } catch {
    return false;
  }
}

/** Concurrent 401s share one in-flight refresh — guards against refresh storms. */
export function tryRefreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ---- The request function ------------------------------------------------------

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip the auth header (public auth endpoints). */
  anonymous?: boolean;
  /** Response is a file, not JSON. */
  raw?: boolean;
}

async function execute(path: string, opts: RequestOptions): Promise<Response> {
  const { body, anonymous, headers, ...rest } = opts;
  let outBody = body;
  if (!MOCKS_ENABLED && body !== undefined) {
    const { adaptRequestBody } = await import("./adapter");
    outBody = adaptRequestBody(path, body);
  }
  return transport(path, {
    ...rest,
    headers: {
      ...(outBody !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(!anonymous && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: outBody !== undefined ? JSON.stringify(outBody) : undefined,
  });
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await execute(path, opts);

  // On 401 (outside the auth endpoints): refresh once, then replay once.
  if (res.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await tryRefreshOnce();
    if (refreshed) {
      res = await execute(path, opts);
    } else {
      clearSession();
      redirectToLogin();
      throw new ApiError(401, "Session expired");
    }
  }

  if (!res.ok) throw await ApiError.from(res);
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : undefined;
  if (MOCKS_ENABLED) return parsed as T;
  // Real backend: unwrap APIResponse<T> (success:false → ApiError) then fix shapes.
  const { unwrapEnvelope, adaptResponse } = await import("./adapter");
  return adaptResponse(path, unwrapEnvelope(res.status, parsed)) as T;
}

export const api = {
  get: <T>(path: string, opts: RequestOptions = {}) => request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts: RequestOptions = {}) => request<T>(path, { ...opts, method: "DELETE" }),
};

/** Download a file (report exports) through the same client + auth handling. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await request<Response>(path, { method: "GET", raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
