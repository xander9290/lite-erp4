import { Suspense } from "react";
import CardViewClient from "./CardViewClient";
import type { CardViewProps } from "../collection/types";
import { CollectionSkeleton } from "../collection/CollectionShell";
export type { CardViewProps, CollectionField } from "../collection/types";

export default function CardView(props: CardViewProps) {
  return <Suspense fallback={<CollectionSkeleton title={props.title} breadcrumbs={props.breadcrumbs} className={props.className} />}><CardViewClient {...props} /></Suspense>;
}
