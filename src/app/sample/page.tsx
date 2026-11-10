import Link from "next/link";
import SampleForms from "./SampleForms";
import ImageSample from "./ImageSample";
import Many2OneSample from "./Many2OneSample";
import RelationTagSample from "./RelationTagSample";
import ListViewSample from "./ListViewSample";
import FormViewSample from "./FormViewSample";
import AlertsSample from "./AlertsSample";
import One2manySample from "./One2manySample";
import CollectionViewsSample from "./CollectionViewsSample";
import AuditSample from "./AuditSample";
import ListGroupingSample from "./ListGroupingSample";

export default function PageSample() {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl bg-base-200 p-4 sm:p-8">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6">
        <header className="space-y-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="badge badge-soft badge-primary">UI · Formularios</span>
            <Link href="/auth" className="btn btn-ghost btn-sm">Inicio de sesión</Link>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Catálogo de Fields</h1>
            <p className="max-w-2xl text-sm text-base-content/65">Ejemplos con React Hook Form y Zod. Prueba los campos vacíos para ver los errores en toast o carga un ejemplo válido para consultar el resultado. Validar muestra los datos localmente; FormView demuestra acciones de servidor sin persistencia y FieldImage sube a Cloudinary al confirmar su edición.</p>
          </div>
          <nav aria-label="Ejemplos de Fields" className="flex flex-wrap gap-2">
            <a className="btn btn-sm btn-outline" href="#list-view">ListView</a>
            <a className="btn btn-sm btn-outline" href="#list-selection">Selección de listas</a>
            <a className="btn btn-sm btn-outline" href="#list-grouping">Agrupación anidada</a>
            <a className="btn btn-sm btn-outline" href="#card-view">CardView</a>
            <a className="btn btn-sm btn-outline" href="#kanban-view">KanbanView</a>
            <a className="btn btn-sm btn-outline" href="#form-view">FormView</a>
            <a className="btn btn-sm btn-outline" href="#record-audit">Auditoría</a>
            <a className="btn btn-sm btn-outline" href="#alerts">Alertas</a>
            <a className="btn btn-sm btn-outline" href="#notebook">Notebook</a>
            <a className="btn btn-sm btn-outline" href="#field-select-statebar">Statebar</a>
            <a className="btn btn-sm btn-outline" href="#field-text">FieldText</a>
            <a className="btn btn-sm btn-outline" href="#field-text-long">Texto largo</a>
            <a className="btn btn-sm btn-outline" href="#field-number">FieldNumber</a>
            <a className="btn btn-sm btn-outline" href="#field-select">FieldSelect</a>
            <a className="btn btn-sm btn-outline" href="#field-many2one">FieldMany2One</a>
            <a className="btn btn-sm btn-outline" href="#field-relation-tag">FieldRelationTag</a>
            <a className="btn btn-sm btn-outline" href="#field-one2many">FieldOne2many</a>
            <a className="btn btn-sm btn-outline" href="#field-date">FieldDate</a>
            <a className="btn btn-sm btn-outline" href="#field-boolean">FieldBoolean</a>
            <a className="btn btn-sm btn-outline" href="#field-image">FieldImage</a>
            <a className="btn btn-sm btn-outline" href="#field-image-avatar">Avatar</a>
          </nav>
        </header>
        <ListViewSample />
        <ListGroupingSample />
        <CollectionViewsSample />
        <AlertsSample />
        <FormViewSample />
        <AuditSample />
        <SampleForms />
        <Many2OneSample />
        <RelationTagSample />
        <One2manySample />
        <ImageSample />
        <ImageSample widget="avatar" />
      </div>
    </main>
  );
}
