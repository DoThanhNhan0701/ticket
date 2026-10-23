import {
  AUTH_SESSION_CHANGED_EVENT,
  COOKIE_REFRESH_KEY,
  COOKIE_TOKEN_KEY,
  STORAGE_USERNAME_KEY,
  STORAGE_USER_PERMISSION_KEY,
  STORAGE_AUTH_ENVIRONMENT_KEY,
} from "@/constants/auth";
import { deleteCookie, setCookie } from "./cookies";
import { deleteStorageItem, setStorageItem } from "./storage";
import { getAuthEnvironment } from "./auth-environment";

let sessionVersion = 0;

export function getAuthSessionVersion(): number {
  return sessionVersion;
}

function writeAuthTokens(tokens: { access: string; refresh?: string }): void {
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  if (tokens.refresh) setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

export function startAuthSession(tokens: {
  access: string;
  refresh: string;
}): number {
  sessionVersion += 1;
  setStorageItem(STORAGE_AUTH_ENVIRONMENT_KEY, getAuthEnvironment());
  writeAuthTokens(tokens);
  return sessionVersion;
}

export function updateAuthTokens(
  tokens: { access: string; refresh?: string },
  expectedVersion: number,
): boolean {
  if (sessionVersion !== expectedVersion) return false;
  writeAuthTokens(tokens);
  return true;
}

export function clearAuthSession(): void {
  sessionVersion += 1;
  deleteCookie(COOKIE_TOKEN_KEY);
  deleteCookie(COOKIE_REFRESH_KEY);
  deleteStorageItem(STORAGE_USERNAME_KEY);
  deleteStorageItem(STORAGE_USER_PERMISSION_KEY);
  deleteStorageItem(STORAGE_AUTH_ENVIRONMENT_KEY);
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}
