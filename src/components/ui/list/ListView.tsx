import { Suspense } from "react";
import ListViewClient, { type ListViewProps } from "./ListViewClient";
import ListViewSkeleton from "./ListViewSkeleton";

export type { ListViewProps } from "./ListViewClient";
export type { ListColumn, ListModel } from "@/lib/list/types";
export type { ListBreadcrumb } from "./ListBreadcrumbs";

/** Own the URL hook's Suspense boundary so callers only need the declarative props. */
export default function ListView(props: ListViewProps) {
  return <Suspense fallback={<ListViewSkeleton breadcrumbs={props.breadcrumbs} className={props.className} />}><ListViewClient {...props} /></Suspense>;
}
