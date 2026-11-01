import { ReactNode } from "react";
import Clock from "@/components/Clock";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function LayoutErp({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex min-h-0 min-w-0 flex-col overflow-hidden gap-1">
      <header className="min-h-12 sm:min-h-10 shrink-0 flex flex-wrap items-center gap-2 px-2 py-1 bg-base-100 rounded-md">
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Clock />
          <ThemeToggle />
        </div>
      </header>
      <main className="rounded-md flex-1 flex flex-col min-h-0 min-w-0 bg-base-100">{children}</main>
    </div>
  );
}
