"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

type Theme = "corporate" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme;
    const isDark =
      currentTheme === "dark" ||
      (!currentTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const nextTheme = isDark ? "corporate" : "dark";

    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }

  const label =
    theme === "dark"
      ? "Activar modo claro"
      : theme === "corporate"
        ? "Activar modo oscuro"
        : "Cambiar entre modo claro y oscuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="btn btn-ghost btn-square size-10 sm:size-8 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 motion-reduce:transform-none"
    >
      <Sun
        size={18}
        aria-hidden="true"
        className={theme === null ? "hidden dark:block" : theme === "dark" ? "block" : "hidden"}
      />
      <Moon
        size={18}
        aria-hidden="true"
        className={theme === null ? "block dark:hidden" : theme === "corporate" ? "block" : "hidden"}
      />
    </button>
  );
}
