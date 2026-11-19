import ModelFieldsSample from "./ModelFieldsSample";
import DomainSample from "./DomainSample";
import FormDeletionSample from "./FormDeletionSample";
import FormActionsSample from "./FormActionsSample";
import RelatedImageSample from "./RelatedImageSample";
import { relatedImageModel } from "./related-image.model";
import ModelReactionsSample from "./ModelReactionsSample";
import { sampleReactionModel } from "./reaction-model";
import Link from "next/link";
import { Suspense } from "react";
import SampleForms from "./SampleForms";
import ImageSample from "./ImageSample";
import Many2OneSample from "./Many2OneSample";
import ActionParametersSample from "./ActionParametersSample";
import SequenceSample from "./SequenceSample";
import Many2manySample from "./Many2manySample";
import RelationTagSample from "./RelationTagSample";
import ListViewSample from "./ListViewSample";
import FormViewSample from "./FormViewSample";
import AlertsSample from "./AlertsSample";
import One2manySample from "./One2manySample";
import One2manyDeclarativeSample from "./One2manyDeclarativeSample";
import CollectionViewsSample from "./CollectionViewsSample";
import ComputedCollectionSample from "./ComputedCollectionSample";
import RelationFilterSample from "./RelationFilterSample";
import CollectionCoreSample from "./CollectionCoreSample";
import CapabilitiesSample from "./CapabilitiesSample";
import AuditSample from "./AuditSample";
import ListGroupingSample from "./ListGroupingSample";
import ModelDisplayNameSample from "./ModelDisplayNameSample";
import ImageCollectionsSample from "./ImageCollectionsSample";
import BadgeCollectionsSample from "./BadgeCollectionsSample";

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
            <a className="btn btn-sm btn-outline" href="#domains">Dominios</a>
            <a className="btn btn-sm btn-outline" href="#model-reactions">Reacciones de modelo</a>
            <a className="btn btn-sm btn-outline" href="#related-image">Imagen relacionada</a>
            <a className="btn btn-sm btn-outline" href="#model-fields">Contrato del modelo</a>
            <a className="btn btn-sm btn-outline" href="#list-view">ListView</a>
            <a className="btn btn-sm btn-outline" href="#list-selection">Selección de listas</a>
            <a className="btn btn-sm btn-outline" href="#list-grouping">Agrupación anidada</a>
            <a className="btn btn-sm btn-outline" href="#card-view">CardView</a>
            <a className="btn btn-sm btn-outline" href="#collection-core">Colección compartida</a>
            <a className="btn btn-sm btn-outline" href="#computed-collections">Cálculos en colecciones</a>
            <a className="btn btn-sm btn-outline" href="#kanban-view">KanbanView</a>
            <a className="btn btn-sm btn-outline" href="#form-view">FormView</a>
            <a className="btn btn-sm btn-outline" href="#form-deletion">Eliminar desde formulario</a>
            <a className="btn btn-sm btn-outline" href="#form-actions">Acciones de formulario</a>
            <a className="btn btn-sm btn-outline" href="#action-parameters">Parámetros de acciones</a>
            <a className="btn btn-sm btn-outline" href="#action-parameters">Parámetros de acciones</a>
            <a className="btn btn-sm btn-outline" href="#model-capabilities">Capacidades</a>
            <a className="btn btn-sm btn-outline" href="#record-audit">Auditoría</a>
            <a className="btn btn-sm btn-outline" href="#alerts">Alertas</a>
            <a className="btn btn-sm btn-outline" href="#notebook">Notebook</a>
            <a className="btn btn-sm btn-outline" href="#field-select-statebar">Statebar</a>
            <a className="btn btn-sm btn-outline" href="#field-text">FieldText</a>
            <a className="btn btn-sm btn-outline" href="#stack">Stack</a>
            <a className="btn btn-sm btn-outline" href="#field-invisible">Invisible</a>
            <a className="btn btn-sm btn-outline" href="#field-text-header">Encabezado</a>
            <a className="btn btn-sm btn-outline" href="#field-text-phone">Teléfono</a>
            <a className="btn btn-sm btn-outline" href="#field-text-email">Correo</a>
            <a className="btn btn-sm btn-outline" href="#field-text-long">Texto largo</a>
            <a className="btn btn-sm btn-outline" href="#field-number">FieldNumber</a>
            <a className="btn btn-sm btn-outline" href="#field-select">FieldSelect</a>
            <a className="btn btn-sm btn-outline" href="#field-many2one">FieldMany2One</a>
            <a className="btn btn-sm btn-outline" href="#model-display-name">Nombre desde el modelo</a>
            <a className="btn btn-sm btn-outline" href="#field-relation-tag">FieldRelationTag</a>
            <a className="btn btn-sm btn-outline" href="#many2many-model">Many2many</a>
            <a className="btn btn-sm btn-outline" href="#model-sequences">Folios</a>
            <a className="btn btn-sm btn-outline" href="#field-one2many">FieldOne2many</a>
            <a className="btn btn-sm btn-outline" href="#one2many-model">Líneas declarativas</a>
            <a className="btn btn-sm btn-outline" href="#field-date">FieldDate</a>
            <a className="btn btn-sm btn-outline" href="#field-boolean">FieldBoolean</a>
            <a className="btn btn-sm btn-outline" href="#field-image">FieldImage</a>
            <a className="btn btn-sm btn-outline" href="#image-collections">Imágenes en colecciones</a>
            <a className="btn btn-sm btn-outline" href="#badge-collections">Badges en colecciones</a>
            <a className="btn btn-sm btn-outline" href="#field-image-avatar">Avatar</a>
          </nav>
        </header>
        <DomainSample />
        <ModelReactionsSample rules={sampleReactionModel.reactionRules} />
        <RelatedImageSample rules={relatedImageModel.reactionRules} />
        <ModelFieldsSample />
        <ListViewSample />
        <ListGroupingSample />
        <CollectionViewsSample />
        <Suspense fallback={<p role="status">Cargando colección compartida…</p>}><CollectionCoreSample />
        <RelationFilterSample />
        <ComputedCollectionSample /></Suspense>
        <ImageCollectionsSample />
        <BadgeCollectionsSample />
        <AlertsSample />
        <FormViewSample />
        <FormDeletionSample />
        <FormActionsSample />
        <ActionParametersSample />
        <CapabilitiesSample />
        <AuditSample />
        <SampleForms />
        <Many2OneSample />
        <ModelDisplayNameSample />
        <RelationTagSample />
        <Many2manySample />
        <SequenceSample />
        <One2manySample />
        <One2manyDeclarativeSample />
        <ImageSample />
        <ImageSample widget="avatar" />
      </div>
    </main>
  );
}
