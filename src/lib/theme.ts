import { useCallback, useEffect, useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

export type Theme = "light" | "dark";

// "light" is Poké-Center Light, "dark" is Silph Co. Dark.
const KEY = THEME_KEY;
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

const applyTheme = (theme: Theme) => document.documentElement.classList.toggle("dark", theme === "dark");

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "light");

  // Keeps the <html> class in step with the stored theme, including changes made in another tab.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the theme applies for this session only
    }
    applyTheme(next);
    listeners.forEach((l) => l());
  }, []);

  return { theme, toggleTheme };
}
