import { createInstance, type i18n as I18nInstance } from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";

export type Locale = "vi" | "en";
type Catalog = Record<string, string>;
const modules = import.meta.glob<{ default: Catalog }>("../locales/*/*.json", {
  eager: true,
});
const catalogs: Record<string, Catalog> = {};
for (const [path, module] of Object.entries(modules)) {
  const match = /\/locales\/(vi|en)\/([^/]+)\.json$/.exec(path);
  if (match) catalogs[`${match[1]}/${match[2]}`] = module.default;
}

export const localeStorageKey = "ticket.locale";
function readLocale(): Locale {
  try {
    return localStorage.getItem(localeStorageKey) === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
}
const resources: Record<Locale, Record<string, Catalog>> = { vi: {}, en: {} };
for (const [key, catalog] of Object.entries(catalogs)) {
  const [language, namespace] = key.split("/");
  resources[language as Locale][namespace] = catalog;
}

export const i18n: I18nInstance = createInstance();
void i18n.use(initReactI18next).init({
  resources,
  lng: readLocale(),
  fallbackLng: "vi",
  supportedLngs: ["vi", "en"],
  ns: Object.keys(resources.vi),
  defaultNS: "common",
  fallbackNS: "common",
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
  react: { useSuspense: false },
});

export function getLocale(): Locale {
  return i18n.resolvedLanguage === "en" ? "en" : "vi";
}

function persistLocale() {
  const locale = getLocale();
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  try {
    localStorage.setItem(localeStorageKey, locale);
  } catch {
    // Keep language switching usable when browser storage is blocked.
  }
}
i18n.on("languageChanged", persistLocale);

export function setLocale(next: Locale) {
  if (next !== "vi" && next !== "en") return;
  if (getLocale() !== next) void i18n.changeLanguage(next);
  else persistLocale();
}

export function useLocale(): Locale {
  const { i18n: instance } = useTranslation("common", { i18n });
  return instance.resolvedLanguage === "en" ? "en" : "vi";
}

if (typeof window !== "undefined") {
  document.documentElement.lang = getLocale();
  window.addEventListener("storage", (event) => {
    if (event.key === localeStorageKey || event.key === null) {
      const next = readLocale();
      if (next !== getLocale()) void i18n.changeLanguage(next);
    }
  });
}

/** Compatibility helper for UI messages; API values must stay untranslated. */
export function t(
  namespace: string,
  source: string,
  params: readonly unknown[] = [],
  language = getLocale(),
): string {
  return i18n.t(source, {
    ns: namespace,
    lng: language,
    defaultValue: source,
    ...Object.fromEntries(params.map((value, index) => [index, String(value)])),
  });
}

const messageKeys = new Map<string, { namespace: string; source: string }>();
const fieldMessageKeys = new Map<
  string,
  { namespace: string; source: string }
>();
const messagePatterns: {
  namespace: string;
  source: string;
  pattern: RegExp;
  indexes: number[];
}[] = [];
for (const [key, catalog] of Object.entries(catalogs)) {
  const namespace = key.slice(key.indexOf("/") + 1);
  for (const [source, text] of Object.entries(catalog)) {
    messageKeys.set(source, { namespace, source });
    messageKeys.set(text, { namespace, source });
    fieldMessageKeys.set(text.toLocaleLowerCase(), { namespace, source });
    // Match full sentences only, never generic labels such as "Enter {0}".
    if (
      !text.includes("{0}") ||
      !/[.!]$/.test(source) ||
      (source !== "Vui lòng {0} {1}." &&
        source.replace(/\{\d+\}/g, "").length < 15)
    )
      continue;
    const indexes: number[] = [];
    const pattern = text
      .split(/(\{\d+\})/)
      .map((part) => {
        const placeholder = /^\{(\d+)\}$/.exec(part);
        if (placeholder) {
          indexes.push(Number(placeholder[1]));
          return "(.+?)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    messagePatterns.push({
      namespace,
      source,
      pattern: new RegExp(`^${pattern}$`, "s"),
      indexes,
    });
  }
}

// Prefer the structured field-validation sentence over its single-parameter variants.
messagePatterns.sort(
  (a, b) =>
    Number(b.source === "Vui lòng {0} {1}.") -
    Number(a.source === "Vui lòng {0} {1}."),
);

/** Validation messages may be produced before the user changes language. */
export function translateMessage(message: string): string {
  const exact = messageKeys.get(message);
  if (exact) return t(exact.namespace, exact.source);
  for (const { namespace, source, pattern, indexes } of messagePatterns) {
    const match = pattern.exec(message);
    if (match) {
      const params: string[] = [];
      indexes.forEach((index, position) => {
        params[index] = match[position + 1];
      });
      // These parameters are static settings/recruitment field labels, not user input.
      if (source === "Vui lòng {0} {1}.") {
        params.forEach((value, index) => {
          const key = fieldMessageKeys.get(value.toLocaleLowerCase());
          if (key)
            params[index] = t(key.namespace, key.source).toLocaleLowerCase();
        });
      }
      return t(namespace, source, params);
    }
  }
  return message;
}
