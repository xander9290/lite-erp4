import { Children, Fragment, Suspense, isValidElement, type ReactNode } from "react";
import ListViewClient, { type ListViewProps as ClientProps } from "./ListViewClient";
import ListViewSkeleton from "./ListViewSkeleton";
import { modelColumns, type PublishedFields } from "@/lib/orm/presentation";
import type { ListColumn } from "@/lib/list/types";

export type { ListColumn, ListModel, ListGroup, ListGroupValue, ListPage, ListResult, ListState } from "@/lib/list/types";
export type { ListBreadcrumb } from "./ListBreadcrumbs";
export type { ListDeleteTarget, ListDeleteResult } from "@/lib/list/selection";
type ColumnProps = Omit<Partial<ListColumn>, "field"> & { name: string };
function ListField(props: ColumnProps): null { void props; return null; }
export type ListViewProps = ClientProps | (Omit<ClientProps, "columns"> & { fields: PublishedFields; children: ReactNode; columns?: never });

/** Resolve declarations before crossing the client boundary; only plain columns reach ListViewClient. */
function ListView(props: ListViewProps) {
  let columns: readonly ListColumn[];
  const { fields, children, ...rest } = props as ListViewProps & { fields?: PublishedFields; children?: ReactNode };
  if (props.columns && children !== undefined) throw new Error("Usa columns o ListView.Field, no ambos.");
  if (props.columns) columns = props.columns;
  else {
    if (!fields) throw new Error("ListView.Field requiere fields del contrato cliente publicado.");
    const declarations: (Omit<Partial<ListColumn>, "field"> & { field: string })[] = [];
    const visit = (nodes: ReactNode) => Children.forEach(nodes, node => {
      if (node == null || typeof node === "boolean") return;
      if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) { visit(node.props.children); return; }
      if (!isValidElement<ColumnProps>(node) || node.type !== ListField) throw new Error("La lista sólo acepta hijos ListView.Field.");
      const { name, ...options } = node.props;
      if (declarations.some(column => column.field === name)) throw new Error(`Columna duplicada: ${name}.`);
      declarations.push({ field: name, ...options });
    });
    visit(children);
    if (!declarations.length || declarations.length > 12) throw new Error("Declara entre 1 y 12 columnas.");
    columns = modelColumns(fields, declarations);
  }
  return <Suspense fallback={<ListViewSkeleton breadcrumbs={props.breadcrumbs} className={props.className} />}><ListViewClient {...rest as ClientProps} columns={columns} /></Suspense>;
}
export default Object.assign(ListView, { Field: ListField });
