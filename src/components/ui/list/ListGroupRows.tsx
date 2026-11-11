"use client";
import { Fragment, useEffect, useState, type ComponentProps } from "react";
import type { ListGroupValue, ListPage, ListResult, ListState } from "@/lib/list/types";
import { groupDisplayLabel } from "@/lib/list/grouping";
import { listDeleteSelectionSchema, type ListDeleteResult, type ListDeleteTarget } from "@/lib/list/selection";
import ListRecordRows from "./ListRecordRows";
import { emptyListSelection, selectedPageIds, togglePageRecord, toggleWholePage } from "./listSelection";
import SelectionCheckbox from "./SelectionCheckbox";
import { useListDeletion } from "./useListDeletion";
import ListViewActionMenu from "./ListViewActionMenu";

type Props = Pick<ComponentProps<typeof ListRecordRows>, "recordHref" | "currentUrl" | "renderCell" | "openRecord"> & {
  data: ListPage; state: ListState; load: (state: ListState) => Promise<ListResult>;
  columns: ComponentProps<typeof ListRecordRows>["displayColumns"];
  deleteAction?: (targets: readonly ListDeleteTarget[]) => Promise<ListDeleteResult>;
  refresh: () => void;
};

/** Each expanded branch owns a bounded request and independent page; closing unmounts it. */
function Branch({ path, ...props }: Omit<Props, "data"> & { path: ListGroupValue[] }) {
  const [page, setPage] = useState(1), [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{ key: string; result: ListResult } | null>(null);
  const key = JSON.stringify({ state: props.state, path, page, attempt });
  const load = props.load;
  useEffect(() => {
    let current = true;
    const request = JSON.parse(key);
    Promise.resolve().then(() => load({ ...request.state, groupPath: request.path, page: request.page }))
      .catch((): ListResult => ({ ok: false, error: "No pudimos cargar el grupo." }))
      .then(result => { if (current) setResponse({ key, result }); });
    return () => { current = false; };
  }, [key, load]);
  const result = response?.key === key ? response.result : null;
  const span = props.columns.length + 2;
  if (!result) return <tr><td colSpan={span} role="status">Cargando grupo…</td></tr>;
  if (!result.ok) return <tr><td colSpan={span}><p role="alert">{result.error}</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAttempt(value => value + 1)}>Reintentar grupo</button></td></tr>;
  const data = result.data;
  const hasNext = data.groups ? data.hasMoreGroups : data.page * data.pageSize < data.total;
  return <>
    <tr><td colSpan={span}><div className="flex flex-wrap items-center gap-3 text-xs" style={{ paddingLeft: `${path.length}rem` }}>
      <span>{data.total} registros · Página {data.page} de {data.groups ? "grupos" : "registros"}</span>
      <button type="button" className="btn btn-ghost btn-xs" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)} aria-label="Página anterior del grupo">Anterior</button>
      <button type="button" className="btn btn-ghost btn-xs" disabled={!hasNext} onClick={() => setPage(data.page + 1)} aria-label="Página siguiente del grupo">Siguiente</button>
    </div></td></tr>
    {data.groups ? <ListGroupRows {...props} state={{ ...props.state, groupPath: path }} data={data} /> : <Leaf key={key} {...props} data={data} />}
  </>;
}

function Leaf(props: Omit<Props, "state" | "load">) {
  const [selection, setSelection] = useState(emptyListSelection);
  const ids = selectedPageIds(selection, props.data);
  const deletion = useListDeletion(props.data);
  const parsed = listDeleteSelectionSchema.safeParse(props.data.rows.filter(row => ids.includes(row.id)).map(row => ({ id: row.id, revision: row.revision })));
  return <>
    <tr><td colSpan={props.columns.length + 2}><div className="flex items-center gap-3">
      <SelectionCheckbox label="Seleccionar la página de este grupo" checked={!!props.data.rows.length && ids.length === props.data.rows.length} mixed={ids.length > 0 && ids.length < props.data.rows.length} disabled={deletion.busy || !props.data.rows.length} onChange={() => setSelection(value => toggleWholePage(value, props.data))} />
      <span className="text-xs">{ids.length} seleccionados en esta página del grupo</span>
      {!!ids.length && props.deleteAction && <ListViewActionMenu disabled={deletion.busy} deleteDisabled={!parsed.success} deleteUnavailable={false} onDelete={() => { if (parsed.success) void deletion.run(parsed.data, props.deleteAction!, props.refresh); }} />}
    </div></td></tr>
    {!props.data.rows.length && <tr><td colSpan={props.columns.length + 2}>Sin registros en este grupo.</td></tr>}
    <ListRecordRows {...props} displayColumns={props.columns} selectedIds={ids} busy={deletion.busy} toggle={id => setSelection(value => togglePageRecord(value, props.data, id))} />
  </>;
}

export default function ListGroupRows(props: Props) {
  const [open, setOpen] = useState<string[]>([]);
  const path = props.state.groupPath ?? [];
  const field = props.state.groupBy?.[path.length];
  const column = props.columns.find(column => column.field === field);
  const label = column?.label ?? field;
  if (!props.data.groups?.length) return <tr><td colSpan={props.columns.length + 2}>Sin grupos para esta consulta.</td></tr>;
  return <>{props.data.groups.map(group => {
    const id = JSON.stringify(group.value), expanded = open.includes(id);
    const { data: _data, ...branchProps } = props;
    void _data;
    return <Fragment key={id}>
      <tr className="bg-base-200/60"><td colSpan={props.columns.length + 2}>
        <button type="button" className="flex w-full items-center gap-2 rounded py-2 text-left font-medium focus-visible:outline-2 focus-visible:outline-primary" style={{ paddingLeft: `${path.length}rem` }} aria-expanded={expanded} onClick={() => setOpen(value => expanded ? value.filter(key => key !== id) : [...value, id])}>
          <span aria-hidden="true">{expanded ? "▾" : "▸"}</span><span>{label}: {groupDisplayLabel(group, column)}</span><span className="badge badge-sm badge-ghost">{group.count}</span>
        </button>
      </td></tr>
      {expanded && <Branch {...branchProps} path={[...path, group.value]} />}
    </Fragment>;
  })}</>;
}
