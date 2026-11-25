import type { Metadata } from "next";
import DocumentationGuide from "../DocumentationGuide";

export const metadata: Metadata = {
  title: "Backend · Documentación · Lite ERP",
  description: "Documentación del servidor de Lite ERP: manifest, pantallas nombradas por modelo (screens), dominios con el usuario de la sesión, reglas de registro y valores propuestos.",
};

export default async function BackendDocumentationPage() {
  "use cache";

  return <DocumentationGuide guide="backend" />;
}
