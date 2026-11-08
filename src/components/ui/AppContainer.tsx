"use client";

import type { MouseEventHandler, ReactNode } from "react";
import Link from "next/link";

type AppContainerProps = {
  name: string;
  icon: ReactNode;
} & ({ href: string; onClick?: never } | { href?: never; onClick?: MouseEventHandler<HTMLButtonElement> });

export default function AppContainer({ name, icon, onClick, href }: AppContainerProps) {
  const controlClassName = "group flex h-full min-h-36 w-full min-w-0 cursor-pointer flex-col items-center justify-start gap-3 rounded-2xl border border-base-300/70 bg-base-100 px-3 py-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 active:scale-95 active:border-primary/60 active:bg-base-200 active:shadow-inner motion-reduce:transform-none motion-reduce:transition-none";
  const contents = <>
    <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-content motion-reduce:transition-none">{icon}</span>
    <span className="min-h-10 w-full min-w-0 text-center text-[0.8125rem] leading-5 font-semibold text-balance wrap-anywhere text-base-content">{name}</span>
  </>;
  return (
    <article className="h-full min-w-0">
      {href ? <Link href={href} title={name} className={controlClassName}>{contents}</Link> : <button type="button" title={name} onClick={onClick} className={controlClassName}>{contents}</button>}
    </article>
  );
}
