/**
 * The one centralized HTTP client configuration point — every Kubb-generated
 * hook/client call in `./api/generated` runs through the shared `client`
 * instance this module configures (base URL, the current user's bearer
 * token), plus the shared helpers for decoding the backend's
 * `{error:{code,message}}` envelope out of a thrown `ResponseError`, and for
 * validating a response against its Kubb-generated zod schema.
 */
import { client, ResponseError } from "@/lib/api/generated/.kubb/client";
import type { z } from "zod";

const STORAGE_KEY = "drop.auth";
const REFRESH_MARGIN_SECONDS = 30;

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
}

interface BackendErrorBody {
  error?: { code?: string; message?: string };
}

/** A thrown `ResponseError`'s `.message` is a generic "Request failed with
 * status 4xx" string — the backend's actual message lives in `.data`. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ResponseError) {
    const body = error.data as BackendErrorBody | undefined;
    return body?.error?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

/** The backend's error code (e.g. `"APPOINTMENT_SLOT_UNAVAILABLE"`), for
 * call sites that branch on a specific failure rather than just displaying
 * the message — e.g. `getErrorCode(error) === "APPOINTMENT_SLOT_UNAVAILABLE"`. */
export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof ResponseError) {
    const body = error.data as BackendErrorBody | undefined;
    return body?.error?.code;
  }
  return undefined;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Kubb's client has no global validator hook (`ClientConfig` carries no
 * `validator` field — only a per-request `RequestConfig` does), so response
 * validation is applied at each hook/mapper call site instead, using this
 * helper against the matching Kubb-generated zod schema. Parses a raw
 * backend response and throws `ValidationError` (surfacing as a normal
 * query error, not a page crash) on a schema mismatch — catches a
 * backend/frontend contract drift immediately instead of silently
 * mistyping data. */
export function validated<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Response failed schema validation: ${result.error.message}`,
    );
  }
  return result.data;
}

export function loadTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export function storeTokens(tokens: StoredTokens): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // localStorage unavailable (private mode, etc.) — the session just won't persist across reloads.
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

let refreshPromise: Promise<string | undefined> | null = null;

async function refreshTokens(
  refreshToken: string,
): Promise<string | undefined> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string;
  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
      clearTokens();
      return undefined;
    }
    const body = await response.json();
    const session = body.data as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };
    storeTokens(session);
    return session.access_token;
  } catch {
    return undefined;
  }
}

/** Resolves the current access token, proactively refreshing it if it's
 * expired or close to expiring — a request is never sent with a token we
 * already know is stale. */
async function getValidAccessToken(): Promise<string | undefined> {
  const tokens = loadTokens();
  if (!tokens) return undefined;

  const nowSeconds = Date.now() / 1000;
  if (tokens.expires_at - nowSeconds > REFRESH_MARGIN_SECONDS) {
    return tokens.access_token;
  }

  if (!refreshPromise) {
    refreshPromise = refreshTokens(tokens.refresh_token).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// No `/api/v1` suffix here: every Kubb-generated call's own `url` field
// already carries the full path from the OpenAPI spec (routes are mounted
// under /api/v1 in the backend), so appending it again here would double it
// (`/api/v1/api/v1/...`).
client.setConfig({
  baseURL: import.meta.env.VITE_API_BASE_URL as string,
  auth: getValidAccessToken,
});
