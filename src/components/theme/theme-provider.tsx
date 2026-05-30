"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

type ThemeMode = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  systemTheme: ResolvedTheme;
  theme: ThemeMode;
  themes: ThemeMode[];
};

const themeStorageKey = "theme";
const defaultTheme: ThemeMode = "system";
const themeModes: ThemeMode[] = ["light", "dark", "system"];
const systemQuery = "(prefers-color-scheme: dark)";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(systemQuery).matches ? "dark" : "light";
}

function resolveTheme(theme: ThemeMode, systemTheme: ResolvedTheme) {
  return theme === "system" ? systemTheme : theme;
}

function applyTheme(resolvedTheme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextSystemTheme = getSystemTheme();
      const savedTheme = window.localStorage.getItem(themeStorageKey);
      const nextTheme = isThemeMode(savedTheme) ? savedTheme : defaultTheme;

      setSystemTheme(nextSystemTheme);
      setThemeState(nextTheme);
      applyTheme(resolveTheme(nextTheme, nextSystemTheme));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(systemQuery);
    const onChange = () => {
      const nextSystemTheme = getSystemTheme();
      setSystemTheme(nextSystemTheme);
      setThemeState((currentTheme) => {
        if (currentTheme === "system") {
          applyTheme(nextSystemTheme);
        }

        return currentTheme;
      });
    };

    mediaQuery.addEventListener("change", onChange);

    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback(
    (nextTheme: ThemeMode) => {
      setThemeState(nextTheme);
      window.localStorage.setItem(themeStorageKey, nextTheme);
      applyTheme(resolveTheme(nextTheme, systemTheme));
    },
    [systemTheme]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      resolvedTheme: resolveTheme(theme, systemTheme),
      setTheme,
      systemTheme,
      theme,
      themes: themeModes
    }),
    [setTheme, systemTheme, theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}

export type { ThemeMode };
