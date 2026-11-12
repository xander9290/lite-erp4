import type { ReactNode } from "react";
import type { ListColumn, ListRecord, ListResult, ListState, ListViewConfig } from "@/lib/list/types";
import type { ListBreadcrumb } from "../list/ListBreadcrumbs";

export type CollectionField = ListColumn;
export type CollectionProps = {
  model: string; title: string; description?: string; icon?: ReactNode;
  columns: readonly CollectionField[]; searchFields?: readonly string[];
  defaultSort?: ListViewConfig["defaultSort"]; pageSize?: number; paramPrefix?: string;
  titleField?: string; subtitleField?: string; recordHref?: string; createHref?: string; createLabel?: string;
  headerActions?: ReactNode; footer?: ReactNode; className?: string;
  breadcrumbs?: readonly ListBreadcrumb[];
  renderCard?: (record: ListRecord) => ReactNode;
};
export type CardViewProps = CollectionProps & { load: (state: ListState) => Promise<ListResult> };
