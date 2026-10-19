import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

export function AppThemeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <ThemeProvider
      attribute="class"
      storageKey="homepage-theme"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
