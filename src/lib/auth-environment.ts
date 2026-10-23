import { getApiBaseUrl } from "./api/api-base-url";

export function getAuthEnvironment(): string {
  const api = new URL(
    getApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
    window.location.origin,
  );
  return `${import.meta.env.MODE}:${api.href}`;
}
