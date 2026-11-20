# Many2many declarativo

Desde 2026-11-19 admite `domain: d => ...` sobre sus candidatos, con dependencias
del borrador y validación de todos los IDs al guardar. No descarta selecciones
incompatibles automáticamente. [Contrato de dominios](dominios-modelos.md).

Implementado el 2026-11-17 para módulos `defineModule` en `src/modules`.
Relaciona un registro con varios registros existentes, que pueden compartirse con
otros registros. El formulario envía la colección completa de IDs, no objetos
Prisma ni instrucciones de escritura anidada.

## Declaración y flujo

```ts
import { Fields, Model } from "@/lib/orm";

export class Etiqueta extends Model {
  name = Fields.Text({ required: true });
}

export class Ticket extends Model {
  name = Fields.Text({ required: true });
  etiquetas = Fields.Many2many("SoporteEtiqueta", {
    label: "Etiquetas",
    minSelected: 0,
    maxSelected: 20,
  });
}
```

Con `defineModule({ id: "soporte", ..., models: { ticket: Ticket, etiqueta: Etiqueta } })`,
el nombre Prisma del destino es `SoporteEtiqueta`. También admite destinos de
otros módulos declarativos registrados, con `depends` explícito de su propietario.
User/Partner manuales todavía no son destinos de esta API; para observadores de
Tickets hará falta diseñar ese soporte. Se admiten autorrelaciones dirigidas.

Después de declarar el campo:

1. Ejecutar `npm run orm:sync -- soporte`.
2. Revisar el SQL de la nueva tabla intermedia y sus claves antes de aprobar.
3. Reiniciar dev cuando se regenere Prisma Client.

ModelForm lo muestra automáticamente con `FieldRelationTag`, metadatos y lookup
autorizado del destino. No requiere nuevas Server Actions ni consultas en la vista.
En un formulario personalizado bajo ModelForm:

```tsx
<FieldRelationTag<Values> name="etiquetas" direction="inline" />
```

`eject:view -- soporte ticket form` incluye ese control. Las vistas que ya fueron
expulsadas no se reescriben: añadirlo manualmente. Fuera de ModelForm, el selector
admite `load={proveedor}` explícito, o los proveedores manuales existentes mediante
`model="partner" | "user"`. Estos últimos son sólo una UI: no crean una relación
Many2many con esos modelos de infraestructura.

Ejemplo de valores:

```ts
{ name: "Revisar equipo", etiquetas: ["id-urgente", "id-garantia"] }
```

El valor inicial es un nuevo `[]` por registro. Si `minSelected > 0`, ese borrador
inicial necesita selección antes de guardar. Omisión, IDs repetidos, vacíos, con
espacios, inexistentes o inaccesibles se rechazan; no se corrigen silenciosamente.
`[]` elimina todos los vínculos sólo cuando los mínimos lo permiten.

## Persistencia y seguridad

- Se genera una tabla propia, p. ej. `soporte_ticket_etiquetas_rel`, con PK compuesta
  `(sourceId, targetId)`, índice del destino y ambas FK. No hay columna de arrays
  en Ticket ni tabla intermedia sin propietario.
- Quitar una etiqueta del formulario elimina el vínculo, nunca la etiqueta. El
  borrado del dueño limpia sus vínculos con Cascade. Borrar un destino vinculado
  se rechaza con Restrict. No se añade lógica de negocio al destino ni se ejecuta
  su guardado por asociarlo.
- El servidor exige create/write del dueño y lectura de todos los destinos según
  sus permisos/reglas vigentes. No exige write del destino. Sesión, revisión,
  normalización, hooks, constraints, acciones, historial y vínculos comparten la
  transacción Serializable existente. Se valida la entrada antes de los hooks y
  su resultado antes de escribir; los fallos revierten todo.
- Una modificación sólo de vínculos avanza la revisión del dueño y registra
  «Relaciones actualizadas». No se publican IDs ni nombres antiguos en ese resumen;
  no hay `tracking` detallado por vínculo en esta versión.
- Si un vínculo existente apunta a un destino que el actor ya no puede leer, la
  apertura/edición del documento se rechaza con error de selección, sin exponer
  sus IDs ni eliminar vínculos ocultos al guardar. Un administrador autorizado
  puede revisar esa relación. Es una política conservadora inicial: todavía no
  hay presentación parcial con vínculos ocultos protegidos ni permisos por campo.
- Las colecciones siguen consultando escalares y no cargan los vínculos. Los
  lookups sólo publican los IDs y etiquetas autorizadas del modelo destino.

## Lógica en la clase

El arreglo se incluye en FormValues/ActionRecord, defaults y formSchema, separado
de los escalares SQL (`metadata`/`schema`). normalize, beforeSave y afterSave lo
reciben como parte del documento. En acciones/constraints y context.previous los
snapshots son inmutables.

```ts
@constraint("etiquetas")
validarEtiquetas(values: Readonly<Record<string, unknown>>) {
  const ids = values.etiquetas as readonly string[];
  // Reglas adicionales de negocio del documento.
}

@action({ label: "Quitar etiquetas" })
quitarEtiquetas() {
  return { etiquetas: [] }; // Sólo si minSelected permite cero.
}
```

## Límites actuales

- Hasta cuatro campos por modelo, máximo 100 IDs por campo. Opciones: `label`,
  `minSelected` (0), `maxSelected` (100), `invisible`. No defaults personalizados,
  sensitive, tracking detallado, unique, compute, related ni opciones SQL.
- Es un conjunto sin orden persistido. La lectura ordena por ID.
- Cada declaración posee su relación. No hay `inverse` editable: declarar otro
  Many2many en el destino crea otra relación independiente, no la inversa de ésta.
- Sin creación/edición de destinos desde la selección ni comandos Odoo/XML.
- Sin columnas de Many2many, filtros/domains/orden/grupos por sus miembros,
  `@onchange`/`@depends` sobre el arreglo ni rutas que lo atraviesen todavía.
- Sin Many2many en hijos One2many. Un modelo dueño sí puede declarar ambos tipos de
  colección. Desde `extendModel` sí (2026-11-20): ver [Many2many en extensiones](#many2many-en-extensiones). El scaffold legacy con orm.config.ts
  y bindings se rechaza explícitamente antes de instalar: usar defineModule.
- El gestor reconoce las tablas intermedias desde el esquema instalado con hashes
  verificados, sin evaluar manifests para el catálogo. Sus planes de retirada
  incluyen ese almacenamiento. No se aplican migraciones destructivas por defecto.

## Many2many en extensiones

Implementado el 2026-11-20 ([diseño](ideas/many2many-extensiones.md)). Una extensión declara el
campo como en un modelo propio:

```ts
export const PartnerExtra = extendModel(Partner, Base => {
  class PartnerExtra extends Base {
    tagIds = Fields.Many2many("ContactosextraPartnertags", { label: "Etiquetas", maxSelected: 20 });
  }
  return PartnerExtra;
});
```

- **Almacenamiento:** la tabla intermedia es del módulo extensor y cuelga de su fila compañera
  (`<modulo>_<base>_<campo>_rel`, source → compañera Cascade, target Restrict). No toca el
  esquema del módulo base. Retirar el extensor retira compañera y vínculos.
- **Repositorio:** los vínculos se leen y escriben dentro de la fila compañera, en la misma
  sentencia, transacción y revisión. Un registro sin fila compañera presenta `[]`; guardar
  vínculos la crea.
- Validación, permisos (lectura de los destinos, create/write del dueño), dominio, historial
  «Relaciones actualizadas» y avance de revisión son los mismos de un modelo propio.
- **Destino:** modelo registrado del propio extensor, de una dependencia o nativo.
- **Límites:** máximo 4 Many2many sumando base y extensiones; el nombre no puede repetir uno
  del base ni de otra extensión. Una extensión sólo con Many2many es válida.
- **Fuera de alcance:** modelos con repositorio propio (`core.user`), con error claro al componer.
- **Presentación:** en el formulario automático va al grupo del módulo extensor. En vistas
  propias o inserciones: `<FieldRelationTag name="tagIds" />`.
- Después de declararlo: `npm run orm:sync -- <modulo>` y revisar el SQL de la tabla nueva.

## Verificación

Many2many en extensiones: `test:modules` (declaración, esquema generado, composición,
repositorio, límites, destino sin dependencia y `core.user` rechazados) y
`test:extensions:integration` (proyecto/esquema temporales: SQL de la tabla y sus FK,
alta/lectura ordenada/cambio sólo de vínculos con revisión e historial, IDs inexistentes o
repetidos, destino ilegible, Restrict del destino y Cascade al borrar).

`/sample#many2many-model` usa datos ficticios en memoria, proveedor `load`, RHF y Zod;
no instala módulos ni guarda vínculos en el ERP.

```bash
npm run test:orm
npm run test:modules
npm run test:form-model
npm run test:orm:install
npm run test:module-manager
npm run test:many2many:integration
```

La integración crea y elimina un proyecto/esquema PostgreSQL temporal. Comprueba
DDL, registros compartidos, altas/bajas de vínculos, permisos/reglas del dueño y
destino, inexistentes, hooks/actions, rollback tardío, FK, revisiones, carreras,
historial, reconocimiento de propiedad y plan de retirada, además de eject:view y
TypeScript del formulario resultante. No usa cuentas ni datos reales del ERP.
