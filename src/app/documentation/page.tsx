import type { Metadata } from "next";
import DocumentationGuide from "./DocumentationGuide";

export const metadata: Metadata = {
  title: "Crear módulos · Documentación · Lite ERP",
  description: "Aprende a crear módulos de Lite ERP: Fields.Selection, Fields.Image, Notebook y NotebookPage, relaciones, permisos, acciones tipadas y formularios desde TSX paso a paso.",
};

export default async function DocumentationPage() {
  "use cache";

  return <DocumentationGuide guide="modulos" />;
}
