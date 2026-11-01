import { ReactNode } from "react";

export default function LayoutErp({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-1">
      <header className="h-10 shrink-0 flex items-center gap-2 p-2 p-1 bg-base-100 rounded-md">
        <div>item 1</div>
        <div className="ml-auto">item 2</div>
      </header>
      <main className="rounded-md flex-1 flex flex-col min-h-0 min-w-0 bg-base-100">{children}</main>
    </div>
  );
}
