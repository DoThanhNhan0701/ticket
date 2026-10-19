import {
  COOKIE_TOKEN_KEY,
  LOGIN_PATH,
  PUBLIC_ENDPOINTS,
} from "@/constants/auth";
import { clearAuthSession } from "@/lib/auth-session";
import { getCookie } from "@/lib/cookies";
import { queryClient } from "@/lib/query-client";
import { ApiError } from "./api-error";
import { getApiBaseUrl } from "./api-base-url";

const API_BASE_URL = getApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

type HttpMethod = "GET" | "POST" | "PUT";

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

function clearAuthAndRedirect(): void {
  clearAuthSession();
  queryClient.clear();
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.href = LOGIN_PATH;
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

function hasInvalidToken(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    data.code === "token_not_valid"
  );
}

async function handleResponse<T>(
  response: Response,
  endpoint: string,
): Promise<T> {
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const data: unknown =
    response.status !== 204 && isJson ? await response.json() : null;
  const message = getErrorMessage(
    data,
    `HTTP Error! Status: ${response.status}`,
  );
  const isAuthError =
    response.status === 401 ||
    response.status === 403 ||
    hasInvalidToken(data) ||
    (!response.ok && message.toLowerCase().includes("token"));

  if (!PUBLIC_ENDPOINTS.includes(endpoint) && isAuthError) {
    clearAuthAndRedirect();
    throw new ApiError(
      getErrorMessage(
        data,
        "Session expired or invalid token. Please sign in again.",
      ),
      response.status,
    );
  }
  if (!response.ok) throw new ApiError(message, response.status);
  return data as T;
}

function getHeaders(
  endpoint: string,
  customHeaders?: Record<string, string>,
): Headers {
  const headers = new Headers(customHeaders);
  if (!headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");

  if (PUBLIC_ENDPOINTS.includes(endpoint)) return headers;

  const token = getCookie(COOKIE_TOKEN_KEY);
  if (!token) {
    clearAuthAndRedirect();
    throw new ApiError(
      "Authentication token not found. Please sign in again.",
      401,
    );
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function request<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`, window.location.origin);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method,
    headers: getHeaders(endpoint, options.headers),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  return handleResponse<T>(response, endpoint);
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
