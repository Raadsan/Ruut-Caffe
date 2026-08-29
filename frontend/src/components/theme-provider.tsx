"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: "class";
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme === "dark" ? "dark" : "light";
}

function applyThemeClass(resolved: "light" | "dark", attribute: "class") {
  if (attribute !== "class" || typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "restaurant-theme",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(
    defaultTheme === "dark" ? "dark" : "light"
  );

  React.useLayoutEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null;
    const initial =
      stored && (stored === "light" || stored === "dark" || (enableSystem && stored === "system"))
        ? stored
        : defaultTheme;
    const resolved = resolveTheme(initial);
    setThemeState(initial);
    setResolvedTheme(resolved);
    applyThemeClass(resolved, attribute);
  }, [defaultTheme, storageKey, attribute, enableSystem]);

  React.useEffect(() => {
    if (!enableSystem || theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = resolveTheme("system");
      setResolvedTheme(resolved);
      applyThemeClass(resolved, attribute);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme, enableSystem, attribute]);

  const setTheme = React.useCallback(
    (next: Theme) => {
      const resolved = resolveTheme(next);
      if (disableTransitionOnChange) {
        document.documentElement.classList.add("disable-transitions");
        requestAnimationFrame(() => {
          document.documentElement.classList.remove("disable-transitions");
        });
      }
      setThemeState(next);
      setResolvedTheme(resolved);
      localStorage.setItem(storageKey, next);
      applyThemeClass(resolved, attribute);
    },
    [attribute, disableTransitionOnChange, storageKey]
  );

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
