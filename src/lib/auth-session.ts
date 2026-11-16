import {
  AUTH_SESSION_CHANGED_EVENT,
  COOKIE_REFRESH_KEY,
  COOKIE_TOKEN_KEY,
  STORAGE_USERNAME_KEY,
  STORAGE_USER_PERMISSION_KEY,
  STORAGE_AUTH_ENVIRONMENT_KEY,
} from "@/constants/auth";
import { deleteCookie, getCookie, setCookie } from "./cookies";
import { deleteStorageItem, setStorageItem } from "./storage";
import { getAuthEnvironment } from "./auth-environment";

let sessionVersion = 0;
let observedCookies: string | undefined;
export const EXTERNAL_AUTH_SESSION_CHANGED = "ticket:external-session-changed";
function cookieSnapshot(): string {
  return JSON.stringify([
    getCookie(COOKIE_TOKEN_KEY) ?? null,
    getCookie(COOKIE_REFRESH_KEY) ?? null,
  ]);
}
function acknowledgeCookies(): void {
  observedCookies = cookieSnapshot();
}

export function getAuthSessionVersion(): number {
  const current = cookieSnapshot();
  if (observedCookies !== undefined && current !== observedCookies) {
    observedCookies = current;
    sessionVersion += 1;
    window.dispatchEvent(new Event(EXTERNAL_AUTH_SESSION_CHANGED));
  } else observedCookies = current;
  return sessionVersion;
}

// Shared cookies may be replaced by Homepage while this tab is in the background.
export function adoptExternalAuthSession(): number {
  sessionVersion += 1;
  acknowledgeCookies();
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
  return sessionVersion;
}

function writeAuthTokens(tokens: { access: string; refresh?: string }): void {
  setCookie(COOKIE_TOKEN_KEY, tokens.access);
  if (tokens.refresh) setCookie(COOKIE_REFRESH_KEY, tokens.refresh);
  acknowledgeCookies();
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
  if (getAuthSessionVersion() !== expectedVersion) return false;
  writeAuthTokens(tokens);
  return true;
}

export function clearAuthSession(): void {
  sessionVersion += 1;
  deleteCookie(COOKIE_TOKEN_KEY);
  deleteCookie(COOKIE_REFRESH_KEY);
  acknowledgeCookies();
  deleteStorageItem(STORAGE_USERNAME_KEY);
  deleteStorageItem(STORAGE_USER_PERMISSION_KEY);
  deleteStorageItem(STORAGE_AUTH_ENVIRONMENT_KEY);
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}
