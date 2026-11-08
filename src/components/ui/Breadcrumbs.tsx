import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Breadcrumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items?: readonly Breadcrumb[] }) {
  if (!items?.length) return null;
  return <nav aria-label="Ruta de navegación" className="w-full min-w-0 text-xs text-base-content/60">
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {items.map((item, index) => <li key={index} className="flex min-w-0 items-center gap-1.5">
        {index > 0 && <ChevronRight size={13} className="shrink-0" aria-hidden="true" />}
        {item.href && index < items.length - 1
          ? <Link href={item.href} className="rounded-sm wrap-anywhere hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{item.label}</Link>
          : <span aria-current={index === items.length - 1 ? "page" : undefined} className="wrap-anywhere">{item.label}</span>}
      </li>)}
    </ol>
  </nav>;
}
