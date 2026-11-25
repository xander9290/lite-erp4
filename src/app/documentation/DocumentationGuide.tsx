import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { BookOpen, ArrowUpRight, Layers, ArrowRight, Server, FileSpreadsheet } from "lucide-react";
import Markdown from "react-markdown";
import CodeBlock from "./CodeBlock";
import "./documentation.css";

/** Guides published under /documentation, each read from a single Markdown source in docs/. */
export const guides = {
  modulos: { title: "Crear módulos", href: "/documentation", source: "crear-modulos.md", group: "Desarrollo de aplicaciones", icon: Layers, crumb: "Primeros pasos",
    summary: "Ejemplos de modelos, Fields.Selection, Fields.Image, Notebook y NotebookPage, acciones tipadas y formularios desde TSX." },
  backend: { title: "Backend", href: "/documentation/backend", source: "backend.md", group: "Backend", icon: Server, crumb: "Servidor",
    summary: "Manifest, pantallas por modelo, dominios con el usuario de la sesión, reglas de registro y valores propuestos." },
  transfer: { title: "Importar y exportar", href: "/documentation/importar-exportar", source: "importar-exportar.md", group: "Backend", icon: FileSpreadsheet, crumb: "Excel y CSV",
    summary: "Claves de negocio, Many2one de uno a tres saltos, Many2many en una celda y documentos con líneas y sublíneas, paso a paso." },
} as const;
export type GuideId = keyof typeof guides;

function headingId(text: string) {
  return text.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Only top-level sections belong in the navigation; ignore headings inside code.
function sections(source: string) {
  let fenced = false;
  return source.split(/\r?\n/).flatMap(line => {
    if (line.startsWith("```")) fenced = !fenced;
    const title = !fenced && /^## (.+)$/.exec(line)?.[1];
    return title ? [{ title, id: headingId(title) }] : [];
  });
}

export default async function DocumentationGuide({ guide: current }: { guide: GuideId }) {
  const guide = guides[current];
  const source = await readFile(path.join(process.cwd(), "docs", guide.source), "utf8");
  const top = headingId(guide.title);
  const contents = sections(source);

  const sectionLinks = contents.map(section => (
    <a key={section.id} href={`#${section.id}`} className="block rounded-lg px-3 py-2 text-sm text-base-content/70 transition-colors hover:bg-base-200 hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary">
      {section.title}
    </a>
  ));
  const ids = Object.keys(guides) as GuideId[];
  const guideLinks = ids.map((id, index) => {
    const item = guides[id];
    const Icon = item.icon;
    const active = id === current;
    // Consecutive guides of the same group share one heading.
    const opensGroup = index === 0 || guides[ids[index - 1]].group !== item.group;
    return (
      <div key={id} className={opensGroup ? "mt-6 first:mt-0" : "mt-1"}>
        {opensGroup && <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-base-content/50 uppercase">{item.group}</p>}
        <Link href={active ? `#${top}` : item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${active ? "bg-primary/10 font-semibold text-primary" : "text-base-content/70 hover:bg-base-200 hover:text-base-content"}`}>
          <Icon size={16} aria-hidden="true" />{item.title}
        </Link>
        {active && <nav aria-label="En esta guía" className="mt-3 space-y-1 border-l border-base-300 pl-3">{sectionLinks}</nav>}
      </div>
    );
  });

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-base-100">
      <a href={`#${top}`} className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-content focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Ir al contenido</a>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 px-4 py-3 sm:px-8">
        <Link href="/documentation" aria-label="Documentación de Lite ERP" className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-content"><BookOpen size={19} aria-hidden="true" /></span>
          <span className="font-semibold tracking-tight">Lite ERP <span className="ml-1 font-normal text-base-content/50">/ Docs</span></span>
        </Link>
        <nav aria-label="Enlaces del proyecto" className="flex items-center gap-1">
          <Link href="/sample" className="btn btn-ghost btn-sm">Componentes <ArrowUpRight size={14} aria-hidden="true" /></Link>
          <Link href="/erp" className="btn btn-ghost btn-sm">Abrir ERP <ArrowRight size={14} aria-hidden="true" /></Link>
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto [scroll-behavior:smooth] motion-reduce:[scroll-behavior:auto]">
        <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:py-10">
          <aside className="hidden self-start lg:sticky lg:top-8 lg:block" aria-label="Navegación de documentación">
            {guideLinks}
            <p className="mt-8 px-3 text-xs leading-5 text-base-content/50">{guide.summary}</p>
          </aside>

          <main className="min-w-0 max-w-3xl pb-12">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-base-content/55"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />{guide.group}<span aria-hidden="true">/</span>{guide.crumb}</div>
            <details className="mb-6 rounded-xl border border-base-300 p-3 lg:hidden">
              <summary className="cursor-pointer text-sm font-medium">Guías y secciones</summary>
              <nav aria-label="Guías" className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(guides) as GuideId[]).map(id => <Link key={id} href={guides[id].href} aria-current={id === current ? "page" : undefined} className={`btn btn-sm ${id === current ? "btn-primary" : "btn-ghost"}`}>{guides[id].title}</Link>)}
              </nav>
              <nav aria-label="En esta guía, móvil" className="mt-3 space-y-1">{sectionLinks}</nav>
            </details>
            <article className="documentation-article">
              <Markdown skipHtml components={{
                h1: ({ children }) => <h1 id={top} tabIndex={-1}>{children}</h1>,
                h2: ({ children }) => <h2 id={headingId(String(children))}>{children}</h2>,
                pre: ({ children }) => <>{children}</>,
                code: ({ children, className }) => className?.startsWith("language-")
                  ? <CodeBlock code={String(children).replace(/\n$/, "")} language={className.slice("language-".length)} />
                  : <code>{children}</code>,
              }}>{source}</Markdown>
            </article>
            <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-5 text-xs text-base-content/55">
              <span>Fuente: docs/{guide.source}</span>
              <a href={`#${top}`} className="rounded underline underline-offset-4 hover:text-primary">Volver al inicio ↑</a>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
