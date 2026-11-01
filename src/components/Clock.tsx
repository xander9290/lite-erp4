"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

export default function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: number;

    function tick() {
      setNow(new Date());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    }

    timer = window.setTimeout(tick, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const hours = now ? String(now.getHours() % 12 || 12).padStart(2, "0") : "--";
  const minutes = now ? String(now.getMinutes()).padStart(2, "0") : "--";
  const period = now ? (now.getHours() >= 12 ? "p. m." : "a. m.") : "";

  return (
    <time
      dateTime={now ? `${String(now.getHours()).padStart(2, "0")}:${minutes}` : undefined}
      aria-label={now ? `${hours}:${minutes} ${period}` : "Hora local"}
      className="inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-base-300 bg-base-200/70 px-2.5 text-base-content shadow-sm"
    >
      <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Clock3 size={14} strokeWidth={1.8} />
      </span>
      <span className="inline-flex items-baseline font-mono text-sm font-semibold tabular-nums">
        {hours}
        <span
          aria-hidden="true"
          className={`text-primary ${now && now.getSeconds() % 2 !== 0 ? "opacity-0 motion-reduce:opacity-100" : ""}`}
        >
          :
        </span>
        {minutes}
      </span>
      <span className="badge badge-soft badge-primary badge-xs min-w-10 text-[10px] font-medium">{period || "--"}</span>
    </time>
  );
}
