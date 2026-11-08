import type { ReactNode } from "react";

type AppGridProps = {
  children: ReactNode;
};

export default function AppGrid({ children }: AppGridProps) {
  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden rounded-md p-2">
      <section className="mx-auto grid min-h-0 w-full min-w-0 max-w-5xl grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),8rem))] content-start justify-center gap-x-4 gap-y-4 overflow-y-auto rounded-md p-2 sm:grid-cols-[repeat(auto-fit,9rem)] sm:gap-x-6 sm:gap-y-6 lg:gap-x-8">
        {children}
      </section>
    </div>
  );
}
