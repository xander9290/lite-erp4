"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { imageUrlSchema } from "@/lib/uploads/image-policy";
import type { ListColumn } from "@/lib/list/types";

const imageUrl = imageUrlSchema();
const sizeClasses = { sm: "size-8", md: "size-12", lg: "size-24" };

function Thumbnail({ src, label }: { src: string; label: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  if (state === "failed") return <Placeholder label={label} />;
  // Load directly: arbitrary public providers must not turn the server into an image-fetching proxy.
  // eslint-disable-next-line @next/next/no-img-element
  return <>{state === "loading" && <ImageOff className="size-4" aria-hidden="true" />}<img src={src} alt={label} width={96} height={96} loading="lazy" decoding="async" referrerPolicy="no-referrer"
    className="absolute inset-0 size-full object-cover" onLoad={() => setState("ready")} onError={() => setState("failed")} /></>;
}

function Placeholder({ label }: { label: string }) {
  return <span role="img" aria-label={`${label}: imagen no disponible`}><ImageOff className="size-4" aria-hidden="true" /></span>;
}

export default function CollectionImage({ value, label, size = "sm", shape = "rounded" }: {
  value: unknown; label: string; size?: ListColumn["imageSize"]; shape?: ListColumn["imageShape"];
}) {
  const parsed = imageUrl.safeParse(value);
  return <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-base-300 bg-base-200 text-base-content/40 align-middle ${sizeClasses[size]} ${shape === "squared" ? "rounded-none" : "rounded-lg"}`} data-collection-image data-image-shape={shape}>
    {parsed.success ? <Thumbnail key={parsed.data} src={parsed.data} label={label} /> : <Placeholder label={label} />}
  </span>;
}
