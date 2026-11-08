import { Suspense } from "react";
import CardViewClient from "./CardViewClient";
import type { CardViewProps } from "../collection/types";
export type { CardViewProps, CollectionField } from "../collection/types";

export default function CardView(props: CardViewProps) {
  return <Suspense fallback={<div role="status" className="skeleton min-h-64 rounded-2xl motion-reduce:animate-none"><span className="sr-only">Cargando tarjetas…</span></div>}><CardViewClient {...props} /></Suspense>;
}
