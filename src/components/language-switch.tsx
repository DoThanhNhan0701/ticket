import { Select } from "@base-ui/react/select";
import { setLocale, useLocale, type Locale } from "@/i18n";

function LanguageFlag({ locale }: { locale: Locale }) {
  return (
    <svg
      viewBox="0 0 60 60"
      className="block size-full shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      {locale === "vi" ? (
        <>
          <path fill="#da251d" d="M0 0h60v60H0z" />
          <path
            fill="#ff0"
            transform="translate(-6 6) scale(1.2)"
            d="m30 8 2.7 8.3h8.7l-7 5.1 2.7 8.3-7.1-5.1-7.1 5.1 2.7-8.3-7-5.1h8.7z"
          />
        </>
      ) : (
        <>
          <path fill="#012169" d="M0 0h60v60H0z" />
          <path stroke="#fff" strokeWidth="10" d="m0 0 60 60M60 0 0 60" />
          <path
            fill="#c8102e"
            d="M0 0h4l26 26v4L0 0zm60 0v4L34 30h-4L60 0zM0 60v-4l26-26h4L0 60zm60 0h-4L30 34v-4l30 30z"
          />
          <path stroke="#fff" strokeWidth="16" d="M30 0v60M0 30h60" />
          <path stroke="#c8102e" strokeWidth="9" d="M30 0v60M0 30h60" />
        </>
      )}
    </svg>
  );
}

const languages = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
] as const;

export function LanguageSwitch() {
  const locale = useLocale();
  return (
    <Select.Root
      value={locale}
      onValueChange={(value) => {
        if (value === "vi" || value === "en") setLocale(value);
      }}
    >
      <Select.Trigger
        aria-label={locale === "vi" ? "Ngôn ngữ" : "Language"}
        title={locale === "vi" ? "Tiếng Việt" : "English"}
        className="m-0 block size-11 shrink-0 cursor-pointer overflow-hidden rounded-md border-0 bg-card p-0 outline-none sm:size-9 sm:pointer-coarse:size-11"
      >
        <LanguageFlag locale={locale} />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          sideOffset={6}
          align="end"
          alignItemWithTrigger={false}
          className="z-50"
        >
          <Select.Popup className="m-0 min-w-32 overflow-hidden rounded-md border border-border bg-popover p-0 text-popover-foreground shadow-md outline-none">
            <Select.List className="m-0 flex flex-col gap-0 p-0">
              {languages.map((language) => (
                <Select.Item
                  key={language.value}
                  value={language.value}
                  aria-label={language.label}
                  title={language.label}
                  className="m-0 flex min-h-9 w-full cursor-pointer items-center border-0 px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground pointer-coarse:min-h-11"
                >
                  <Select.ItemText lang={language.value}>
                    {language.label}
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
