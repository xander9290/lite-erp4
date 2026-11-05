"use client";

import { Moon, Sun } from "lucide-react";
import { useUserTheme } from "./UserTheme";

export default function ThemeToggle() {
  const { darkMode, saving, toggle } = useUserTheme();
  const label = darkMode ? "Activar modo claro" : "Activar modo oscuro";
  const Icon = darkMode ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-busy={saving}
      aria-pressed={darkMode}
      aria-label={label}
      title={saving ? "Guardando apariencia…" : label}
      className="btn btn-ghost btn-square size-10 sm:size-8 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 motion-reduce:transform-none"
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
