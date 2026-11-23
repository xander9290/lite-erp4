# Inserciones en vistas extendidas

Implementado el 2026-11-19. Diseño y decisiones: [ideas/inserciones-vistas.md](ideas/inserciones-vistas.md).
Demo ficticia: `/sample#insertions`. Pruebas: `test:form-model` (registro y render) y `test:modules`
(manifest).

Formularios abajo; colecciones (lista, Card y Kanban) en [su sección](#colecciones).

Una extensión (`extends`) puede colocar sus campos **en cualquier punto direccionable del
formulario base** sin editarlo, en vez de aportar un bloque completo con `views.form`.

## Declarar

```ts
// manifest.ts del módulo que extiende
extends: {
  "core.partner": {
    model: PartnerExtra,
    insertions: { form: () => import("./views/PartnerInsertions") },
  },
},
```

```tsx
// views/PartnerInsertions.tsx
"use client";
import { Inserter } from "@/components/ui/form/insertions/Insertions";

export default function PartnerInsertions() {
  return <>
    <Inserter target="field:name" position="after"><FieldText name="vat" /></Inserter>
    <Inserter target="group:contacto" position="after">
      <FormGroup id="direccion" legend="Dirección">…</FormGroup>
    </Inserter>
  </>;
}
```

- En formularios, `insertions.form` y `insertions.modal` admiten un loader diferido.
  `insertions.form` no convive con `views.form` en la misma entrada `extends`.
  Las claves de colecciones son `list`, `card` y `kanban`.
- Un `<Inserter>` por combinación destino + posición en el archivo; puede tener varios hijos.
- `<Inserter>` no pinta nada donde se escribe; fuera de un archivo de inserciones es error.
- El archivo es sólo presentación: permisos, validación y guardado siguen en el servidor.

Desde 2026-11-22, un layout `views.modal` carga sólo `insertions.modal`; conserva
las inserciones de página por separado. Sin layout modal, el fallback conserva
el contenido form de cada extensión, salvo que ésta publique insertions.modal.
Los campos de extensiones sin contenido modal se presentan automáticamente en
ModelExtensions. [Contrato completo y eject](formularios-modal.md#vista-modal-independiente-y-eject).

## Destinos

| Destino | Lo publica | Posiciones |
|---|---|---|
| `field:<nombre>` | Todo Field* de primer nivel (no las celdas de líneas) | before, after, replace |
| `group:<id>` | `FormGroup` con `id` | before, after, inside, replace |
| `stack:<id>` | `Stack` con `id` | before, after, inside, replace |
| `notebook:<id>` | `Notebook` con `id` (inside: sólo `NotebookPage`) | before, after, inside |
| `page:<notebook>/<name>` | `NotebookPage` de un Notebook con `id` | before/after (sólo `NotebookPage`), inside, replace |

- El formulario automático (`ModelFields`) publica `group:general`.
- Los contenedores sin `id` no son direccionables: el autor del formulario base decide qué
  es estable. Las páginas insertadas por otro módulo no publican `page:` propios.
- `inside` agrega al final del contenedor.
- Para ser extensible, oculta con `invisible` (el ancla sigue montada) en lugar de
  `{condición && …}`: un destino no montado cuenta como ausente.

## Varios módulos

- Orden: el de composición de extensiones (profundidad de dependencias y luego id).
- `replace` único por destino. Si dos módulos lo reemplazan, gana el que depende del otro;
  sin dependencia entre ellos es conflicto (se usa el primero en orden y se avisa).
- `inside` sobre un contenedor reemplazado es conflicto.
- Un destino publicado por contenido insertado (p. ej. `group:direccion` de contactosextra)
  sólo lo usan ese módulo y los que dependen de él.

## Errores

Tras montar el formulario se comprueban destinos ausentes, duplicados (`<Inserter>` o
anclas repetidas) y conflictos:

- Desarrollo: aviso visible al inicio del formulario con módulo, destino y posición.
- Siempre: `console.error("[inserciones] …")`.
- El contenido sin destino (o rechazado por dependencia/contenedor reemplazado) no se pierde:
  aparece en el grupo del módulo, donde está `<ModelExtensions />`.

## Lo que no cambia

- Un solo FormView/RHF/Zod, guardado, revisión, locks, dirty guard y Server Actions. El
  contenido insertado se pinta en la posición del ancla, así que hereda su contexto: los
  errores revelan la página correcta del Notebook.
- `replace` sólo cambia presentación: un campo obligatorio reemplazado y no vuelto a pintar
  seguirá fallando al guardar.
- Un módulo con `insertions` no genera su grupo automático en `<ModelExtensions />`; los demás,
  sí. `views.form` sigue funcionando igual.

## Notas de implementación

- `src/components/ui/form/insertions/resolve.ts`: reglas puras (orden, conflictos, ausentes).
- `Insertions.tsx`: store por formulario, `InsertionProvider` (en ModelForm), `Inserter` y las
  anclas (`useInsertionAnchor`, `useInsertionAnchors`, `InsertionAnchor`). Los registros se
  hacen durante el render (los archivos de inserciones se montan antes que el formulario) y
  se repiten en un efecto de layout, que sobrevive al doble montaje de StrictMode.
- `FormGroup` ahora es componente cliente (usa el ancla).
- El servidor publica en `config.extensions` `depends` (transitivo) e `insertions: true`;
  `ModelRoute` carga los archivos y los entrega por `ModelExtensionViews`.

## Colecciones

Implementado el 2026-11-19 con las cuatro decisiones aceptadas por el usuario. Demo ficticia:
`/sample#collection-insertions`. Pruebas: `src/lib/modules/collection-insertions.test.ts`
(dentro de `test:modules`).

```ts
insertions: {
  form: () => import("./views/PartnerInsertions"),
  list: () => import("./views/PartnerListInsertions"),
  card: () => import("./views/PartnerCardInsertions"),
  kanban: () => import("./views/PartnerCardInsertions"),
},
```

```tsx
"use client";
import Column from "@/components/modules/Column";
import { Inserter } from "@/components/ui/form/insertions/Insertions";

export default function PartnerListInsertions() {
  return <Inserter target="column:email" position="after">
    <Column field="vat" label="RFC" />
    <Column field="estadoId" label="Estado" />
  </Inserter>;
}
```

| Destino | Vista | Posiciones |
|---|---|---|
| `column:<campo>` | Lista con `columns` declaradas | before, after, replace |
| `columns:end` | Lista con `columns` declaradas | inside |
| `card:title` / `card:body` / `card:footer` | Card y Kanban con la tarjeta por defecto | before, after, inside |

- Dentro de un `<Inserter>` de colección sólo va `<Column field label? width? align? … />`
  (mismas opciones de presentación que `columns`). Otro contenido se ignora con aviso.
- **Campos permitidos:** publicados por el servidor en la colección (`list.fields`) y de la
  extensión del módulo o de extensiones de las que depende. `replace` también puede volver a
  presentar la columna que reemplaza. Búsqueda, filtros, orden y agrupación siguen la política
  del servidor; insertar una columna no los concede.
- **Lista sin `columns`:** ya deriva todas las columnas publicadas (extensiones incluidas), así
  que las inserciones de lista no se aplican.
- **Límite de 12 columnas:** las insertadas cuentan. Si se rebasa, se omiten primero las de los
  últimos módulos (orden de dependencias) con aviso; las columnas base nunca se quitan.
- Una columna repetida (ya presente o insertada antes) se omite con aviso.
- **Tarjeta:** `card:title` inside agrega líneas bajo el título; `card:body` inside, filas al
  final de los detalles; `card:footer`, un pie con filas. Un campo colocado por una extensión
  sale sólo donde se colocó (se retira de los detalles automáticos).
- Con `renderCard` personalizado no hay zonas: las filas insertadas siguen a su contenido y se
  avisa del destino ausente.
- Destinos ausentes: en lista, sus columnas van al final; en tarjeta, al final del cuerpo.
- Ancho y alineación los decide el `<Column>` insertado. Fuera de alcance: selector de columnas
  visibles.

Implementación: `ModelRoute` carga el archivo de la vista seleccionada y `ModelExtensionViews`
lo entrega con el id del modelo (una colección embebida de otro modelo no lo toma).
`ModelCollection` monta las anclas, coloca con `placeListColumns`/`placeCardColumns`
(`src/lib/modules/collection-insertions.ts`) y pasa `cardInsertions` a RecordCard. Sin archivos
de inserciones, el proveedor corta cualquier store exterior.
