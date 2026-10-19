const API_PREFIX = "/api";

export function getApiBaseUrl(configuredUrl: string | undefined): string {
  const configuredBase = configuredUrl?.trim() || API_PREFIX;
  let end = configuredBase.length;
  while (end > 0 && configuredBase[end - 1] === "/") end -= 1;
  const baseUrl = configuredBase.slice(0, end);
  return baseUrl.endsWith(API_PREFIX) ? baseUrl : `${baseUrl}${API_PREFIX}`;
}
