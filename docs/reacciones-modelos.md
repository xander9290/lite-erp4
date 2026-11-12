# Reacciones, restricciones y presentación de modelos

Implementado el 2026-11-11. Configuración explícita y decoradores producen el mismo
registro y usan el mismo motor. Son código de servidor; las vistas reciben únicamente
metadatos serializables publicados y una Server Action propia de la aplicación.

## Reaccionar a un cambio del borrador

```ts
import { onchange, type ReactionValues } from "@/lib/orm";

@onchange({ fields: ["plate"], writes: ["plate"] })
normalizePlate(values: ReactionValues) {
  return { plate: typeof values.plate === "string"
    ? values.plate.trim().toUpperCase() : null };
}
```

La alternativa explícita, dentro de la clase, es:

```ts
readonly onchange = [
  { method: "normalizePlate", fields: ["plate"], writes: ["plate"] },
];
```

Usar una declaración por método: registrar también el mismo método con decorador
produce un error. `fields` son disparadores; `reads` limita dependencias de entrada
(por defecto fields), `writes` fija el patch editable y `preview` los resultados de
lectura. Máximo 12 nombres por categoría. Cada disparador debe estar en reads.
Cada salida pertenece a una sola reacción: agrupar sus disparadores en fields evita
respuestas ambiguas. No se exponen nombres de métodos en el contrato del navegador.

Se admite un borrador parcial: dependencias todavía vacías pueden ser null/undefined,
pero los valores presentes deben cumplir sus schemas. Los campos obligatorios ajenos
a la reacción pueden estar pendientes. El patch devuelto debe cumplir los schemas de
sus campos; si debe poder quedar vacío, su declaración debe admitirlo. Campos ajenos,
sensibles, identidad, revisión y auditoría no se aceptan como entradas editables o patch.

El handler recibe una copia congelada de sus dependencias y `{tx, actor, id?}`. El
servicio autoriza administrador activo y sessionVersion en RepeatableRead; si se
aporta id/revision comprueba ambos y lee el registro. Inicia la transacción PostgreSQL
en read-only antes de esas lecturas. Un intento de escritura usando tx falla y no
publica resultados. Esto no es un sandbox para código local: no importar otro Prisma
Client ni ejecutar efectos externos desde las reacciones.

El navegador no envía DOM events, nombre de modelo/repository/método, permisos ni where.
`recordService.react` sólo permite disparadores registrados y devuelve un resultado
validado o un error controlado. La política base sigue siendo admin; proveedores propios
necesitan autorizar también sus registros relacionados. Onchange no modifica BD ni
actividad y no sustituye las reglas definitivas de save.

## Calcular datos de lectura

```ts
readonly preview = {
  fabricanteAvatar: Fields.Image({ folder: "fabricantes" }),
};

@depends({ fields: ["name"], preview: ["fabricanteAvatar"] })
async fabricantePreview(values: ReactionValues, { tx }: ReactionContext) {
  if (typeof values.name !== "string" || !values.name) {
    return { fabricanteAvatar: null };
  }
  const modelo = await tx.flotaModelo.findUnique({
    where: { id: values.name },
    select: { fabricante: { select: { avatar: true } } },
  });
  return { fabricanteAvatar: modelo?.fabricante.avatar ?? null };
}
```

`@depends` es una reacción que sólo produce preview; no permite writes. Los campos
preview son DTOs de lectura explícitos, validados con Fields y separados de metadata
persistente, Prisma, defaults, Zod de save, RHF e historial. No crean columnas ni un
motor de recomputación almacenada. Las dependencias son campos locales del borrador;
no se sondean cambios externos de Fabricante. Se actualizan al abrir/resetear el
formulario, cambiar una dependencia o reintentar. El handler puede consultar relaciones
mediante un select fijo y autorizado del servidor.

## Conectar el formulario

El scaffold nuevo genera una acción explícita `onchangeRecord` con requireAdmin y
`recordService.react`. El contrato generado exporta `<Model>ReactionRules` y
`<Model>PreviewFields`. Las reglas sólo contienen nombres públicos; callbacks y
clases permanecen en servidor. El generador rechaza dependencias no publicadas o
sensibles; no amplía clientFields automáticamente.

```ts
// schemas/vehicle.ui.ts
export const recordUI = {
  fields: recordFields,
  reactions: { rules: recordReactionRules, load: onchangeRecord },
  lookups: { name: lookupModelos },
};
```

```tsx
<FormView methods={methods} model={recordUI} onSubmit={saveRecord}>
  <FormGroup>
    <FieldMany2One<RecordInput> name="name" />
    <ModelPreviewImage name="fabricanteAvatar"
      label="Fabricante" widget="avatar" shape="squared" />
    <ModelReactionStatus />
  </FormGroup>
</FormView>
```

FormLayout también integra el motor. Mantener recordUI estable, normalmente a nivel
de módulo. `useModelReactions` usa suscripciones RHF, debounce configurable (120 ms
por defecto), versiones por grupo equivalente de reglas, dependencias y una época de reset. Ignora
respuestas antiguas, invalida previews al cambiar su origen y no pisa un destino
editado durante la petición. Coalesce disparadores de una misma regla y no repite una entrada idéntica salvo retry.
Los errores se conservan por grupo de reacción: editar otro campo no los da por resueltos.

Los patches se aplican con shouldDirty/shouldValidate y no encadenan nuevas reacciones.
Al montar/resetear sólo inicializa cálculos de preview, sin aplicar patches ni ensuciar
el formulario; calcula una vez por regla, usando su primer disparador. No hay cascadas
ni grafo de dependencias entre cálculos. Al enviar, espera las peticiones vigentes y
bloquea el envío si queda un error; ModelReactionStatus muestra estado y reintento.
El desmontaje invalida resultados, pero no promete cancelar SQL/HTTP ya iniciado.

ModelPreviewImage es un contenedor de lectura, no una nueva columna ni un FieldImage
editable. Soporta image/avatar y rounded/squared, sin uploader. El nombre calculado
se puede consumir con FormModelContext.reactionState.preview. No pasar preview como
values ni añadirlo a clientFields para hacerlo visible.

## Validar reglas al guardar

```ts
@constraint("brand", "active")
validateBrand(values: Readonly<Record<string, unknown>>) {
  if (values.active && !values.brand) {
    throw new ModelValidationError("Introduce la marca.", {
      brand: "Introduce la marca o desactiva el vehículo.",
    });
  }
}
```

Alternativa explícita: `readonly constraints = [{method:"validateBrand",fields:["brand","active"]}]`.
Todas las restricciones se ejecutan en cada guardado, después de normalize,
beforeSave y su revalidación Zod, antes de escribir. También corren desde kanban en
la misma transacción del servicio, con revisión, previous e historial existentes.
Deben devolver void o lanzar ModelValidationError; no transformar values ni hacer
efectos externos. Las dependencias identifican las reglas y se validan al declarar,
no omiten reglas por cambios de campos. Conservar constraints de BD para concurrencia.
La herencia registra métodos una sola vez; un override no decorado oculta la anotación
heredada. Los duplicados se rechazan. No decorar hooks sólo para cambiar su nombre.

## Nombre de presentación

```ts
readonly displayRelations = { fabricante: flotaFabricanteModel };

@displayName("name", "fabricante.name")
modeloLabel(record: DisplayRecord<FlotaModelo,
  "name" | "fabricante.name">): string {
  return `${record.fabricante.name} · ${record.name}`;
}
```

`DisplayRecord` infiere la proyección desde los Fields/displayRelations de la clase
y las rutas indicadas; valida estas rutas en TypeScript. `DisplayOf` permite aportar
un mapa de relaciones separado si se necesita. La anotación del método repite sus
dependencias porque el decorador no puede inferir el tipo del parámetro de otro
miembro; mantener withDisplayName cuando se prefiera inferencia desde un callback. Mantiene nulabilidad. El método es síncrono y recibe sólo la proyección
congelada. El generador valida publicación, sensibilidad, destinos y hasta tres saltos.
Añadir rutas necesita regenerar contratos/bindings. Los métodos displayFields/displayName
y withDisplayName siguen disponibles; no mezclar displayFields con @displayName.
No se permiten varios métodos de presentación decorados en el mismo modelo.

## Compatibilidad, verificación y rendimiento

La prueba de decoradores estándar pasó en TypeScript/tsx, pero este Next.js falló
al ejecutar el modelo durante la colección de páginas. Se usa deliberadamente la
modalidad legacy con experimentalDecorators:true, que soporta el compilador instalado
(ver `node_modules/next/dist/docs/03-architecture/nextjs-compiler.md`). Next recomienda
evitar legacy en proyectos nuevos: es una dependencia de compatibilidad de esta versión,
no una afirmación de soporte universal. No se usa emitDecoratorMetadata ni reflect-metadata.
El adaptador sólo registra el método original; una futura modalidad podrá alimentar
el mismo registro. Referencia de las modalidades: [TypeScript 5.0](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html).

Pruebas: registro explícito/decorado equivalente, herencia/overrides/duplicados,
entrada parcial y whitelist, permisos y revisión, SQL readonly, patch inválido y
restricciones que impiden guardar sin onchange. Integración con proyecto/esquema
PostgreSQL temporales y cuentas propias, más TypeScript, lint, scaffold y build.
En navegador de producción, /sample#model-reactions verificó ABC, total 60 y rechazo
al superar 100000, sin persistencia. La validación posterior de dev no se completó:
el proceso existente y la navegación local no estuvieron disponibles para esa sesión.

Medición reproducible: `npm run benchmark:reactions`.
500 calentamientos y 5000 llamadas por pasada, orden alternado. En la medición local
se observaron p50 de aproximadamente 0.001–0.0025 ms y p95 de 0.0014–0.0042 ms, con
variación por calentamiento/carga. Sólo mide el núcleo puro, sin HTTP, sesión, SQL ni
renders. No demuestra ventaja de rendimiento del decorador ni representa la latencia
del formulario. El registro/schema de entrada se compila una vez y ambas sintaxis
usan las mismas funciones por petición; el beneficio comprobado es la ergonomía.

## Adopción en Flota

- Vehicle: reacción de matrícula a mayúsculas, normalize definitivo al guardar,
  preview de nombre/avatar del fabricante vía Modelo y displayName compuesto.
  No se duplicó fabricanteId ni avatar en la tabla de vehículos.
- FlotaRecord: conserva sus dos reglas de negocio, ahora como constraints; usa
  previous para comprobar el cambio de placas, eliminando su consulta redundante.
- Fabricante y Modelo: displayName decorado, con proyección tipada. Se mantienen
  sus tarjetas, formularios, límites y publicaciones existentes.
- Acciones y recordUI de los cuatro recursos conectan react. Se regeneraron los
  contratos de Flota y el lookup de Vehicle con las nuevas rutas, sin cambiar SQL
  ni aplicar migraciones a la base real como parte de esta tarea.
