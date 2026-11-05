export default function ListViewSkeleton() {
  return <div role="status" aria-label="Cargando lista" className="card flex w-full min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-base-300 bg-base-100 shadow-sm">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-base-300 p-4 sm:p-6"><div className="skeleton h-10 w-48 motion-reduce:animate-none" /><div className="skeleton h-8 w-24 motion-reduce:animate-none" /></header>
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-0"><div className="min-h-56 space-y-3"><div className="skeleton mb-5 h-7 w-full motion-reduce:animate-none" />{[1, 2, 3].map(row => <div key={row} className="skeleton h-9 w-full motion-reduce:animate-none" />)}</div></div>
    <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-base-300 p-4 sm:px-6"><div className="skeleton h-5 w-32 motion-reduce:animate-none" /><div className="skeleton h-7 w-24 motion-reduce:animate-none" /></footer>
    <span className="sr-only">Cargando registros…</span>
  </div>;
}
