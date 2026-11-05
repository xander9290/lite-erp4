"use client";

import { createContext, useContext, useLayoutEffect, useState, useTransition, type ReactNode } from "react";
import { saveMyTheme } from "@/lib/auth/theme-actions";
import { useAlerts } from "./alerts/AlertProvider";

const ThemeContext = createContext<{ darkMode: boolean; saving: boolean; toggle: () => void } | null>(null);

export function useUserTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("ThemeToggle debe colocarse dentro de UserTheme.");
  return theme;
}

export default function UserTheme({ initialDarkMode, children }: { initialDarkMode: boolean; children: ReactNode }) {
  const [preference, setPreference] = useState({ initialDarkMode, darkMode: initialDarkMode });
  const [saving, startTransition] = useTransition();
  const alerts = useAlerts();
  // Accept a refreshed server preference without remounting forms or losing drafts.
  if (preference.initialDarkMode !== initialDarkMode) setPreference({ initialDarkMode, darkMode: initialDarkMode });
  const { darkMode } = preference;
  const theme = darkMode ? "dark" : "corporate";

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = theme;
    return () => { root.dataset.theme = previous ?? "corporate"; };
  }, [theme]);

  function toggle() {
    if (saving) return;
    const next = !darkMode;
    setPreference({ initialDarkMode, darkMode: next });
    startTransition(async () => {
      try {
        const result = await saveMyTheme(next);
        if (result.ok) return;
        setPreference({ initialDarkMode, darkMode });
        await alerts.error({ title: "No se pudo guardar la apariencia", message: result.error });
      } catch {
        setPreference({ initialDarkMode, darkMode });
        await alerts.error({ title: "No se pudo guardar la apariencia", message: "Revisa tu conexión e intenta nuevamente." });
      }
    });
  }

  return (
    <ThemeContext.Provider value={{ darkMode, saving, toggle }}>
      <div data-theme={theme} className="flex-1 flex min-h-0 min-w-0 flex-col overflow-hidden gap-1">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
