import { Suspense } from "react";
import ListViewClient, { type ListViewProps } from "./ListViewClient";
import ListViewSkeleton from "./ListViewSkeleton";

export type { ListViewProps } from "./ListViewClient";
export type { ListColumn, ListModel } from "@/lib/list/types";

/** Own the URL hook's Suspense boundary so callers only need the declarative props. */
export default function ListView(props: ListViewProps) {
  return <Suspense fallback={<ListViewSkeleton />}><ListViewClient {...props} /></Suspense>;
}
