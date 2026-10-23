import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  COOKIE_REFRESH_KEY,
  COOKIE_TOKEN_KEY,
  LOGIN_PATH,
  PUBLIC_ENDPOINTS,
  AUTH_ACCESS_DENIED_EVENT,
} from "@/constants/auth";
import { APP_ROUTES } from "@/constants/routes";
import {
  clearAuthSession,
  getAuthSessionVersion,
  updateAuthTokens,
} from "@/lib/auth-session";
import { getCookie } from "@/lib/cookies";
import { queryClient } from "@/lib/query-client";
import { ApiError } from "./api-error";
import { getApiBaseUrl } from "./api-base-url";
import {
  tokenRefreshResponseSchema,
  type TokenRefreshRequest,
} from "./auth-tokens";

const API_BASE_URL = getApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  responseType?: "json" | "blob" | "file";
}

function sessionChangedError(): ApiError {
  return new ApiError("Session changed. Please retry your request.", 409);
}

function clearAuthAndRedirect(expectedVersion: number): void {
  if (getAuthSessionVersion() !== expectedVersion) return;
  clearAuthSession();
  queryClient.clear();
  window.dispatchEvent(new Event(AUTH_ACCESS_DENIED_EVENT));
  if (
    window.location.pathname !== LOGIN_PATH &&
    window.location.pathname !== APP_ROUTES.forbidden
  ) {
    window.location.href = APP_ROUTES.forbidden;
  }
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (typeof data !== "object" || data === null) return fallback;
  if ("detail" in data && typeof data.detail === "string" && data.detail)
    return data.detail;
  if ("message" in data && typeof data.message === "string" && data.message)
    return data.message;
  return fallback;
}

function assertResponseOk(response: Response, data: unknown): void {
  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(data, `HTTP Error! Status: ${response.status}`),
      response.status,
    );
  }
}

function hasInvalidToken(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    data.code === "token_not_valid"
  );
}

function isAuthenticationFailure(response: Response, data: unknown): boolean {
  return response.status === 401 || (!response.ok && hasInvalidToken(data));
}

function assertAccessAllowed(
  response: Response,
  data: unknown,
  version: number,
): void {
  if (getAuthSessionVersion() !== version) return;
  const legacyDenied =
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    data.message === "You do not have access";
  if (response.status !== 403 && !legacyDenied) return;
  window.dispatchEvent(new Event(AUTH_ACCESS_DENIED_EVENT));
  throw new ApiError(
    legacyDenied
      ? "Bạn không có quyền thực hiện thao tác này."
      : getErrorMessage(data, "Bạn không có quyền thực hiện thao tác này."),
    403,
  );
}

async function readResponse(
  response: Response,
  responseType: RequestOptions["responseType"] = "json",
): Promise<unknown> {
  if (response.status === 204) return null;
  // File endpoints can serve JSON attachments without exposing download headers
  // through CORS. Failed downloads still use the JSON error handling below.
  if (response.ok && responseType === "file") return response.blob();
  if (response.headers.get("content-type")?.includes("application/json")) {
    try {
      return await response.json();
    } catch (error) {
      // Empty/malformed error bodies must still reach HTTP status handling.
      if (!response.ok) return null;
      throw error;
    }
  }
  return response.ok && responseType === "blob" ? response.blob() : null;
}

let refreshInFlight: { version: number; promise: Promise<string> } | null =
  null;

function refreshAccessToken(version: number): Promise<string> {
  if (getAuthSessionVersion() !== version)
    return Promise.reject(sessionChangedError());
  if (refreshInFlight?.version === version) return refreshInFlight.promise;

  const refresh = getCookie(COOKIE_REFRESH_KEY);
  if (!refresh) {
    clearAuthAndRedirect(version);
    return Promise.reject(
      new ApiError("Session expired. Please sign in again.", 401),
    );
  }

  const refreshTokens = async (): Promise<string> => {
    const body: TokenRefreshRequest = { refresh };
    // A shared refresh must not be cancelled by one caller's AbortSignal.
    const response = await fetch(
      new URL(
        `${API_BASE_URL}${API_ENDPOINTS.auth.refresh}`,
        window.location.origin,
      ),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await readResponse(response);
    if (
      getAuthSessionVersion() !== version ||
      getCookie(COOKIE_REFRESH_KEY) !== refresh
    ) {
      throw sessionChangedError();
    }

    if (!response.ok) {
      if (
        response.status === 401 ||
        response.status === 403 ||
        hasInvalidToken(data)
      ) {
        clearAuthAndRedirect(version);
      }
      throw new ApiError(
        getErrorMessage(data, `HTTP Error! Status: ${response.status}`),
        response.status,
      );
    }
    const parsedTokens = tokenRefreshResponseSchema.safeParse(data);
    if (!parsedTokens.success) {
      throw new ApiError(
        "Invalid token refresh response from the server.",
        502,
      );
    }

    const tokens = parsedTokens.data;
    if (!updateAuthTokens(tokens, version)) throw sessionChangedError();
    return tokens.access;
  };

  const flight = {
    version,
    promise: refreshTokens().finally(() => {
      if (refreshInFlight === flight) refreshInFlight = null;
    }),
  };
  refreshInFlight = flight;
  return flight.promise;
}

function getHeaders(
  customHeaders: RequestOptions["headers"],
  token?: string,
  body?: unknown,
): Headers {
  const headers = new Headers(customHeaders);
  if (!headers.has("Content-Type") && !(body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization"))
    headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function request<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions,
): Promise<T> {
  const version = getAuthSessionVersion();
  const isPublic = PUBLIC_ENDPOINTS.includes(endpoint);
  const url = new URL(`${API_BASE_URL}${endpoint}`, window.location.origin);
  for (const [key, value] of Object.entries(options.params ?? {}))
    url.searchParams.set(key, value);
  options.signal?.throwIfAborted();

  let token = isPublic ? undefined : getCookie(COOKIE_TOKEN_KEY);
  if (!isPublic && !token) token = await refreshAccessToken(version);

  const send = (access?: string) => {
    options.signal?.throwIfAborted();
    if (!isPublic && getAuthSessionVersion() !== version)
      throw sessionChangedError();
    return fetch(url, {
      method,
      headers: getHeaders(options.headers, access, options.body),
      body:
        options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
      signal: options.signal,
    });
  };

  let response = await send(token);
  let data = await readResponse(response, options.responseType);
  if (!isPublic && isAuthenticationFailure(response, data)) {
    if (getAuthSessionVersion() !== version) throw sessionChangedError();
    const currentToken = getCookie(COOKIE_TOKEN_KEY);
    token =
      currentToken && currentToken !== token
        ? currentToken
        : await refreshAccessToken(version);
    response = await send(token);
    data = await readResponse(response, options.responseType);
    if (isAuthenticationFailure(response, data)) clearAuthAndRedirect(version);
  }
  if (!isPublic && getAuthSessionVersion() !== version && response.ok) {
    // Do not expose an old account's response after logout or another login.
    throw sessionChangedError();
  }
  if (!isPublic) assertAccessAllowed(response, data, version);
  assertResponseOk(response, data);
  return data as T;
}

export function getRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>("GET", endpoint, options);
}

export function postRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>("POST", endpoint, options);
}

export function putRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>("PUT", endpoint, options);
}

export function deleteRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>("DELETE", endpoint, options);
}

export async function postWithSlashFallback<T>(
  endpoint: string,
  options: RequestOptions,
): Promise<T> {
  try {
    return await postRequest<T>(endpoint, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    return postRequest<T>(endpoint.replace(/\/$/, ""), options);
  }
}
