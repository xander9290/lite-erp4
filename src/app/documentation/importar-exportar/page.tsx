import type { Metadata } from "next";
import DocumentationGuide from "../DocumentationGuide";

export const metadata: Metadata = {
  title: "Importar y exportar · Documentación · Lite ERP",
  description: "Cómo habilitar importar y exportar Excel/CSV en Lite ERP: claves de negocio, Many2one de uno a tres saltos, Many2many y documentos con líneas y sublíneas.",
};

export default async function TransferDocumentationPage() {
  "use cache";

  return <DocumentationGuide guide="transfer" />;
}
