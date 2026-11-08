"use client";

import type { MouseEventHandler, ReactNode } from "react";
import Link from "next/link";

type AppContainerProps = {
  name: string;
  icon: ReactNode;
} & ({ href: string; onClick?: never } | { href?: never; onClick?: MouseEventHandler<HTMLButtonElement> });

export default function AppContainer({ name, icon, onClick, href }: AppContainerProps) {
  const controlClassName = "group flex h-full min-h-36 w-full min-w-0 cursor-pointer flex-col items-center justify-start gap-3 rounded-2xl px-2 py-3 focus-visible:outline-none";
  const contents = <>
    <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-base-300/70 bg-primary/10 text-primary shadow-sm transition duration-150 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-content group-hover:shadow-md group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-primary group-active:translate-y-0 group-active:scale-95 group-active:border-primary/60 group-active:shadow-inner motion-reduce:transform-none motion-reduce:transition-none">{icon}</span>
    {/* Two-line minimum aligns short labels; longer names expand the grid row. */}
    <span className="min-h-10 w-full min-w-0 text-center text-[0.8125rem] leading-5 font-semibold text-balance wrap-anywhere hyphens-auto text-base-content">{name}</span>
  </>;
  return (
    <article className="h-full min-w-0">
      {href ? <Link href={href} title={name} className={controlClassName}>{contents}</Link> : <button type="button" title={name} onClick={onClick} className={controlClassName}>{contents}</button>}
    </article>
  );
}
