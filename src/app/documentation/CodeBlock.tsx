"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

const languageLabels: Readonly<Record<string, string>> = {
  bash: "Terminal", powershell: "Terminal", sh: "Terminal",
  ts: "TypeScript", typescript: "TypeScript", tsx: "TSX",
  csv: "CSV", text: "Texto", json: "JSON",
};

export default function CodeBlock({ code, language }: { code: string; language: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="relative my-5 min-w-0 overflow-hidden rounded-xl border border-base-content/15 bg-base-200/60">
      <div className="flex items-center justify-between gap-3 border-b border-base-content/10 px-4 py-2">
        <span className="font-mono text-xs text-base-content/60">{languageLabels[language] ?? language.toUpperCase()}</span>
        <button type="button" className="btn btn-ghost btn-xs gap-1.5" aria-label={`Copiar código ${language}`} onClick={copy}>
          {status === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {status === "copied" ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre tabIndex={0} aria-label={`Código ${language}`} className="overflow-x-auto p-4 text-[13px] leading-6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:p-5">
        <code>{code}</code>
      </pre>
      <span role="status" className={status === "error" ? "block px-4 pb-3 text-xs text-error" : "sr-only"}>
        {status === "copied" ? "Código copiado." : status === "error" ? "No se pudo copiar. Selecciona y copia el código manualmente." : ""}
      </span>
    </div>
  );
}
