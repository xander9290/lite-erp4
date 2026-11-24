import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowUpRight, Layers, ArrowRight } from "lucide-react";
import Markdown from "react-markdown";
import CodeBlock from "./CodeBlock";
import "./documentation.css";

export const metadata: Metadata = {
  title: "Crear módulos · Documentación · Lite ERP",
  description: "Aprende a crear módulos de Lite ERP: Fields.Selection, Fields.Image, relaciones, permisos, acciones tipadas y formularios desde TSX paso a paso.",
};

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

export default async function DocumentationPage() {
  "use cache";

  const source = await readFile(path.join(process.cwd(), "docs", "crear-modulos.md"), "utf8");
  const contents = sections(source);

  const sectionLinks = contents.map(section => (
    <a key={section.id} href={`#${section.id}`} className="block rounded-lg px-3 py-2 text-sm text-base-content/70 transition-colors hover:bg-base-200 hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary">
      {section.title}
    </a>
  ));

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-base-100">
      <a href="#crear-modulos" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-content focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Ir al contenido</a>
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
            <p className="px-3 text-xs font-semibold tracking-wider text-base-content/50 uppercase">Desarrollo de aplicaciones</p>
            <a href="#crear-modulos" aria-current="page" className="mt-4 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary"><Layers size={16} aria-hidden="true" />Crear módulos</a>
            <nav aria-label="En esta guía" className="mt-3 space-y-1 border-l border-base-300 pl-3">{sectionLinks}</nav>
            <p className="mt-8 px-3 text-xs leading-5 text-base-content/50">Ejemplos de modelos, Fields.Selection, Fields.Image, acciones tipadas y formularios desde TSX.</p>
          </aside>

          <main className="min-w-0 max-w-3xl pb-12">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-base-content/55"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />Guía de desarrollo<span aria-hidden="true">/</span>Primeros pasos</div>
            <details className="mb-6 rounded-xl border border-base-300 p-3 lg:hidden">
              <summary className="cursor-pointer text-sm font-medium">En esta guía</summary>
              <nav aria-label="En esta guía, móvil" className="mt-3 space-y-1">{sectionLinks}</nav>
            </details>
            <article className="documentation-article">
              <Markdown skipHtml components={{
                h1: ({ children }) => <h1 id="crear-modulos" tabIndex={-1}>{children}</h1>,
                h2: ({ children }) => <h2 id={headingId(String(children))}>{children}</h2>,
                pre: ({ children }) => <>{children}</>,
                code: ({ children, className }) => className?.startsWith("language-")
                  ? <CodeBlock code={String(children).replace(/\n$/, "")} language={className.slice("language-".length)} />
                  : <code>{children}</code>,
              }}>{source}</Markdown>
            </article>
            <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-5 text-xs text-base-content/55">
              <span>Fuente: docs/crear-modulos.md</span>
              <a href="#crear-modulos" className="rounded underline underline-offset-4 hover:text-primary">Volver al inicio ↑</a>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
