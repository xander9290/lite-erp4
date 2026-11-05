"use client";

import { useEffect, useId, useRef } from "react";
import { ChevronDown, KeyRound, UserRound } from "lucide-react";
import { NavigationGuardLink } from "nextjs-nav-guard";
import PartnerAvatar from "../ui/PartnerAvatar";
import LogoutButton from "./LogoutButton";

type MenuUser = { login: string; name?: string | null; image?: string | null; isAdmin: boolean };

export default function UserMenu({ user }: { user: MenuUser }) {
  const root = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const id = useId();
  const name = user.name || user.login;
  function close() {
    if (!root.current?.open) return;
    root.current.open = false;
    trigger.current?.focus();
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && root.current) root.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <details ref={root} className="dropdown dropdown-end col-start-2 row-start-1 shrink-0 justify-self-end" onKeyDown={event => {
    if (event.key === "Escape" && root.current?.open) { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <summary ref={trigger} aria-label={`Menú de usuario: ${user.login}`} aria-controls={id} className="btn btn-ghost h-10 min-h-10 gap-2 rounded-xl px-2 font-normal focus-visible:outline-2 focus-visible:outline-primary">
      <PartnerAvatar name={name} avatarUrl={user.image} />
      <span className="max-w-24 truncate text-sm font-medium sm:max-w-36">{user.login}</span>
      <ChevronDown size={14} aria-hidden="true" className="text-base-content/50" />
    </summary>
    <ul id={id} aria-label="Opciones de cuenta" className="menu dropdown-content z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] gap-1 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl">
      <li className="mb-1 border-b border-base-300 px-3 py-3">
        <span className="block cursor-default p-0 hover:bg-transparent"><span className="block truncate text-sm font-semibold">{name}</span><span className="mt-1 block truncate text-xs text-base-content/55">@{user.login} · {user.isAdmin ? "Administrador" : "Usuario"}</span></span>
      </li>
      <li><NavigationGuardLink href="/erp/perfil" onClick={close}><UserRound size={16} aria-hidden="true" />Ver perfil</NavigationGuardLink></li>
      <li><NavigationGuardLink href="/erp/perfil/contrasena" onClick={close}><KeyRound size={16} aria-hidden="true" />Cambiar contraseña</NavigationGuardLink></li>
      <li className="mt-1 border-t border-base-300 pt-1"><LogoutButton variant="menu" onSelect={close} /></li>
    </ul>
  </details>;
}
