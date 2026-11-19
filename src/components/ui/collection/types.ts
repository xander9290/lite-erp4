import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import type { ReactNode } from "react";
import type { ListColumn, ListRecord, ListResult, ListState, ListViewConfig } from "@/lib/list/types";
import type { ListBreadcrumb } from "../list/ListBreadcrumbs";

export type CollectionField = ListColumn;
/** Extension rows of the default card, by zone (`card:title|body|footer`), already projected. */
export type CardZone = { readonly before: readonly CollectionField[]; readonly inside: readonly CollectionField[]; readonly after: readonly CollectionField[] };
export type CardInsertions = Readonly<Partial<Record<"title" | "body" | "footer", CardZone>>>;
export type CollectionProps = {
  filterLookups?: Readonly<Record<string, Many2OneLoader>>;
  model: string; title: string; description?: string; icon?: ReactNode;
  columns: readonly CollectionField[]; searchFields?: readonly string[];
  queryColumns?: readonly CollectionField[];
  defaultSort?: ListViewConfig["defaultSort"]; pageSize?: number; paramPrefix?: string;
  titleField?: string; subtitleField?: string; recordHref?: string; createHref?: string; createLabel?: string;
  headerActions?: ReactNode; footer?: ReactNode; className?: string;
  breadcrumbs?: readonly ListBreadcrumb[];
  renderCard?: (record: ListRecord) => ReactNode;
  /** Rows inserted by extensions (ModelCollection); with renderCard they go after its content. */
  cardInsertions?: CardInsertions;
};
export type CardViewProps = CollectionProps & { load: (state: ListState) => Promise<ListResult> };
