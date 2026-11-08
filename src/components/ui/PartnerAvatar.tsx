"use client";

import { useState } from "react";
import { partnerAvatarSource, partnerInitials } from "./partnerAvatarValues";

function Picture({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // Public providers are configurable; load small avatars directly without a server image proxy.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={32} height={32} loading="lazy" decoding="async" referrerPolicy="no-referrer"
    className="absolute inset-0 size-full object-cover" onError={() => setFailed(true)} />;
}

export default function PartnerAvatar({ name, avatarUrl, size = "sm" }: { name: string; avatarUrl?: string | null; size?: "sm" | "lg" }) {
  const src = partnerAvatarSource(avatarUrl);
  return <span aria-hidden="true" className="avatar avatar-placeholder inline-flex shrink-0">
    <span className={`relative flex items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary ring-1 ring-base-content/10 ${size === "lg" ? "size-24 text-2xl" : "size-8 text-xs"}`}>
      <span>{partnerInitials(name)}</span>
      {src && <Picture key={src} src={src} />}
    </span>
  </span>;
}

export function PartnerIdentity({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return <span className="inline-flex max-w-full min-w-0 items-center gap-2.5 align-middle">
    <PartnerAvatar name={name} avatarUrl={avatarUrl} />
    <span className="min-w-0 whitespace-normal wrap-anywhere">{name}</span>
  </span>;
}
