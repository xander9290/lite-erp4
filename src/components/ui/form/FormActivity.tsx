"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MessageSquareText, RefreshCw } from "lucide-react";
import type { ActivityChange, ActivityResult, FormActivity as ActivitySource } from "@/lib/orm/activity";
import { useFormLeaveGuard } from "./FormNavigationProvider";
import PartnerAvatar from "../PartnerAvatar";

function ActivityValue({ change, side }: { change: ActivityChange; side: "before" | "after" }) {
  const value = change[side], label = change[side === "before" ? "beforeLabel" : "afterLabel"];
  if (value === null) return <span className="italic text-base-content/45">Sin valor</span>;
  if (typeof value === "boolean") return <>{value ? "Sí" : "No"}</>;
  if (change.type === "datetime" && typeof value === "string") return <time dateTime={value}>{new Date(value).toLocaleString("es-MX")}</time>;
  return <>{label ?? String(value)}</>;
}

/** This composer has its own draft/guard. It never submits or resets the record form. */
export default function FormActivity({ source, refreshToken, readOnly }: { source: ActivitySource; refreshToken: number; readOnly: boolean }) {
  const { recordId, load, addNote } = source;
  const noteId = useId();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false), [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0), [noteError, setNoteError] = useState<string | null>(null);
  const request = useRef<{ body: string; id: string } | null>(null);
  const postingRef = useRef(false), moreRef = useRef(false), mounted = useRef(true);
  const key = JSON.stringify({ recordId, refreshToken, attempt });
  const keyRef = useRef(key);
  useEffect(() => { keyRef.current = key; }, [key]);
  const resetDraft = useCallback(() => { setDraft(""); request.current = null; }, []);
  const markClean = useFormLeaveGuard(draft.length > 0 || posting, resetDraft);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [response, setResponse] = useState<{ key: string; load: typeof load; result: ActivityResult } | null>(null);
  const current = response?.key === key && response.load === load ? response : null;
  const data = current?.result.ok ? current.result.data : null;

  useEffect(() => {
    if (!recordId) return;
    let active = true;
    Promise.resolve().then(() => load({ id: recordId }))
      .catch((): ActivityResult => ({ ok: false, error: "No pudimos cargar la actividad. Intenta nuevamente." }))
      .then(result => { if (active) setResponse({ key, load, result }); });
    return () => { active = false; };
  }, [key, recordId, load]);

  async function postNote() {
    const body = draft.trim();
    if (!recordId || !addNote || readOnly || postingRef.current || !body) return;
    postingRef.current = true; setPosting(true); setNoteError(null);
    if (request.current?.body !== body) request.current = { body, id: crypto.randomUUID() };
    try {
      const result = await addNote({ id: recordId, body, requestId: request.current.id });
      if (!mounted.current) return;
      if (!result.ok) { setNoteError(result.error); return; }
      resetDraft(); markClean(); setAttempt(value => value + 1);
    } catch {
      if (mounted.current) setNoteError("No pudimos confirmar la nota. Puedes reintentar sin duplicarla; tu texto se conserva.");
    } finally { postingRef.current = false; if (mounted.current) setPosting(false); }
  }

  async function more() {
    if (!recordId || !data?.nextCursor || moreRef.current) return;
    moreRef.current = true; setLoadingMore(true);
    const snapshot = key;
    try {
      const result = await load({ id: recordId, cursor: data.nextCursor });
      if (!mounted.current || keyRef.current !== snapshot) return;
      if (!result.ok) { setNoteError(result.error); return; }
      setResponse(value => value?.key === snapshot && value.result.ok ? { ...value, result: { ok: true, data: { entries: [...value.result.data.entries, ...result.data.entries], nextCursor: result.data.nextCursor } } } : value);
    } catch { if (mounted.current && keyRef.current === snapshot) setNoteError("No pudimos cargar más actividad. Intenta nuevamente."); }
    finally { moreRef.current = false; if (mounted.current) setLoadingMore(false); }
  }

  if (!recordId) return <p className="text-sm text-base-content/55">Guarda el registro para consultar su actividad y dejar notas.</p>;
  return <div className="min-w-0 space-y-5">
    <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText size={16} aria-hidden="true" />Historial y notas</h3>
      <button type="button" className="btn btn-ghost btn-xs" aria-label="Actualizar actividad" disabled={posting || loadingMore} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={14} aria-hidden="true" /></button>
    </div>
    {!readOnly && addNote && <div className="space-y-2">
      <label htmlFor={noteId} className="text-xs font-medium">Nota interna</label>
      <textarea id={noteId} value={draft} onChange={event => setDraft(event.target.value)} autoComplete="off" maxLength={4000} rows={3} disabled={posting} placeholder="Escribe una nota sobre este registro…" className="textarea w-full resize-y border-base-300 bg-base-100 text-sm" />
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-base-content/45">{draft.length}/4000</span><button type="button" className="btn btn-primary btn-sm" disabled={posting || !draft.trim()} onClick={() => void postNote()}>{posting ? "Publicando…" : "Publicar nota"}</button></div>
    </div>}
    {noteError && <p role="alert" className="text-sm text-error">{noteError}</p>}
    {!current ? <p role="status" className="text-sm text-base-content/55">Cargando actividad…</p> : !current.result.ok ? <div role="alert" className="space-y-2 text-sm"><p>{current.result.error}</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAttempt(value => value + 1)}>Reintentar actividad</button></div> : <>
      {!data?.entries.length && <p className="text-sm text-base-content/55">No hay actividad visible en esta página.</p>}
      <ol className="space-y-4" aria-label="Actividad del registro">{data?.entries.map(entry => <li key={entry.id} className="flex min-w-0 items-start gap-3 border-t border-base-300 pt-4">
        <div className="shrink-0 self-start"><PartnerAvatar name={entry.author.name} avatarUrl={entry.author.avatarUrl} /></div>
        <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-1 text-xs"><span className="font-semibold wrap-anywhere">[{entry.author.login}] {entry.author.name}</span><time dateTime={entry.createdAt} className="text-base-content/50">{new Date(entry.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</time></div>
        <p className="mt-1 text-xs text-base-content/55">{entry.kind === "create" ? "Registro creado" : entry.kind === "update" ? "Campos actualizados" : "Nota interna"}</p>
        {entry.kind === "note" && <p className="mt-2 whitespace-pre-wrap text-sm wrap-anywhere">{entry.body}</p>}
        {entry.kind === "update" && !!entry.changes.length && <ul className="mt-2 space-y-2 text-sm">{entry.changes.map(change => <li key={change.field} className="min-w-0"><span className="font-medium">{change.label}: </span><span className="whitespace-pre-wrap wrap-anywhere text-base-content/55"><ActivityValue change={change} side="before" /></span><span aria-label="cambió a"> → </span><span className="whitespace-pre-wrap wrap-anywhere"><ActivityValue change={change} side="after" /></span></li>)}</ul>}
        </div>
      </li>)}</ol>
      {data?.nextCursor && <button type="button" className="btn btn-ghost btn-sm w-full" disabled={loadingMore || posting} onClick={() => void more()}>{loadingMore ? "Cargando…" : "Cargar actividad anterior"}</button>}
    </>}
  </div>;
}
