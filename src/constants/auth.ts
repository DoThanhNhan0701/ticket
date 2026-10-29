import { APP_ROUTES } from "@/constants/routes";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
export const COOKIE_TOKEN_KEY = "rainscales_ticket_access";
export const COOKIE_REFRESH_KEY = "rainscales_ticket_refresh";
export const STORAGE_USERNAME_KEY = "rainscales_ticket_username";
export const STORAGE_USER_PERMISSION_KEY = "rainscales_ticket_user_permission";
export const STORAGE_AUTH_ENVIRONMENT_KEY = "rainscales_ticket_auth_environment";
export const LOGIN_PATH = APP_ROUTES.login;
export const HOME_PATH = APP_ROUTES.requests.list;
export const AUTH_SESSION_CHANGED_EVENT = "ticket:auth-session-changed";
export const AUTH_ACCESS_DENIED_EVENT = "ticket:access-denied";
export const PUBLIC_ENDPOINTS: readonly string[] = [
  API_ENDPOINTS.auth.login,
  API_ENDPOINTS.auth.loginWithoutSlash,
];
