const API_PREFIX = "/api";

export function getApiBaseUrl(configuredUrl: string | undefined): string {
  const baseUrl = (configuredUrl?.trim() || API_PREFIX).replace(/\/+$/, "");
  return baseUrl.endsWith(API_PREFIX) ? baseUrl : `${baseUrl}${API_PREFIX}`;
}
