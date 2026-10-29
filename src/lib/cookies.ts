import Cookies from "js-cookie";

function getSharedDomain(): string | undefined {
  const hostname = window.location.hostname;
  return import.meta.env.VITE_COOKIE_DOMAIN?.split(",")
    .map((domain: string) => domain.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean)
    .find(
      (domain: string) =>
        hostname === domain || hostname.endsWith(`.${domain}`),
    );
}

function removeLegacyCookie(name: string, domain: string): void {
  if (window.location.hostname === domain) return;
  Cookies.remove(name, { path: "/" });
  Cookies.remove(name, { path: "/", domain: window.location.hostname });
}

export const setCookie = (name: string, value: string, days = 7) => {
  const domain = getSharedDomain();
  if (domain) removeLegacyCookie(name, domain);
  Cookies.set(name, value, {
    expires: days,
    path: "/",
    sameSite: "Lax",
    secure: window.location.protocol === "https:",
    ...(domain ? { domain } : {}),
  });
};

export const getCookie = (name: string): string | undefined => {
  const domain = getSharedDomain();
  if (domain && window.location.hostname !== domain) {
    const legacyValue = Cookies.get(name);
    removeLegacyCookie(name, domain);
    // Prefer the shared cookie from Homepage when both scopes exist.
    const sharedValue = Cookies.get(name);
    if (sharedValue !== undefined) return sharedValue;
    if (legacyValue !== undefined) {
      setCookie(name, legacyValue);
      return legacyValue;
    }
    return undefined;
  }
  return Cookies.get(name);
};

export const deleteCookie = (name: string) => {
  Cookies.remove(name, { path: "/" });
  const domain = getSharedDomain();
  if (domain) {
    Cookies.remove(name, { path: "/", domain: window.location.hostname });
    Cookies.remove(name, { path: "/", domain });
  }
};
