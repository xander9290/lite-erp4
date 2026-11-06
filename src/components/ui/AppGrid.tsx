import type { ReactNode } from "react";

type AppGridProps = {
  children: ReactNode;
};

export default function AppGrid({ children }: AppGridProps) {
  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden rounded-md p-2">
      <section className="grid grid-cols-[repeat(auto-fill,100px)] justify-center content-start gap-x-4 gap-y-2 sm:gap-x-6 lg:gap-x-8 p-2 w-full max-w-5xl mx-auto min-h-0 min-w-0 overflow-y-auto rounded-md">
        {children}
      </section>
    </div>
  );
}
