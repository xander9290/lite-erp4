import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Notebook from "./Notebook";
import NotebookPage from "./NotebookPage";
import { NotebookPolicyContext } from "./notebookContext";

const declared = new Set(["extra/ventas", "extra/compras", "extra/notas"]);
function render(hidden: readonly string[], { id = "extra", defaultPage }: { id?: string; defaultPage?: string } = {}) {
  return renderToStaticMarkup(<NotebookPolicyContext.Provider value={{ declared, hidden: new Set(hidden) }}>
    <Notebook id={id} defaultPage={defaultPage}>
      <NotebookPage name="ventas" label="Ventas">VALOR VENTAS</NotebookPage>
      <NotebookPage name="compras" label="Compras">VALOR COMPRAS</NotebookPage>
      <NotebookPage name="notas" label="Notas">VALOR NOTAS</NotebookPage>
    </Notebook>
  </NotebookPolicyContext.Provider>);
}
const tabs = (html: string) => [...html.matchAll(/role="tab"[^>]*>.*?<span class="whitespace-nowrap">([^<]+)<\/span>/g)].map(match => match[1]);

test("a hidden page loses its tab but stays mounted, disabled and inert", () => {
  const html = render(["extra/compras"]);
  assert.deepEqual(tabs(html), ["Ventas", "Notas"]);
  assert.match(html, /data-notebook-panel="compras" data-notebook-disabled="true" hidden="" inert=""/);
  assert.match(html, /VALOR COMPRAS/, "contenido montado: valores y validación intactos");
});

test("a hidden default page falls back to the first visible page", () => {
  const html = render(["extra/ventas"], { defaultPage: "ventas" });
  assert.deepEqual(tabs(html), ["Compras", "Notas"]);
  assert.match(html, /id="extra-tab-compras" role="tab" aria-selected="true"/);
});

test("every page hidden renders no tablist or frame, only the hidden panels", () => {
  const html = render(["extra/ventas", "extra/compras", "extra/notas"]);
  assert.doesNotMatch(html, /role="tablist"|No hay secciones disponibles/);
  assert.match(html, /<div hidden="" data-notebook-hidden="">/);
  assert.match(html, /VALOR NOTAS/);
});

test("the policy only applies to the notebook id it names", () => {
  assert.deepEqual(tabs(render(["extra/compras"], { id: "otro" })), ["Ventas", "Compras", "Notas"]);
  assert.deepEqual(tabs(renderToStaticMarkup(<Notebook id="extra"><NotebookPage name="ventas" label="Ventas">x</NotebookPage></Notebook>)), ["Ventas"]);
});
