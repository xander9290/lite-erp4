"use client";

import type { MouseEventHandler, ReactNode } from "react";
import Link from "next/link";

type AppContainerProps = {
  name: string;
  icon: ReactNode;
} & ({ href: string; onClick?: never } | { href?: never; onClick?: MouseEventHandler<HTMLButtonElement> });

export default function AppContainer({ name, icon, onClick, href }: AppContainerProps) {
  const controlClassName = "group flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-base-300/70 bg-base-100 p-3 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 active:scale-95 active:border-primary/60 active:bg-base-200 active:shadow-inner motion-reduce:transform-none motion-reduce:transition-none";
  const contents = <>
    <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-content motion-reduce:transition-none">{icon}</span>
    <span className="w-full truncate text-center text-xs font-semibold text-base-content">{name}</span>
  </>;
  return (
    <article className="h-[100px] w-[100px]">
      {href ? <Link href={href} className={controlClassName}>{contents}</Link> : <button type="button" onClick={onClick} className={controlClassName}>{contents}</button>}
    </article>
  );
}
