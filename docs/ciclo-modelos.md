# Normalización, estado anterior y consultas compartidas

## Normalizar entradas

Los modelos pueden implementar `normalize(values)` para conversiones puras:

```ts
normalize(values: Readonly<Record<string, unknown>>) {
  return {
    ...values,
    plate: typeof values.plate === "string"
      ? values.plate.trim().toUpperCase()
      : values.plate,
  };
}
```

Es síncrono, heredable, recibe una copia congelada de los campos de entrada y debe
devolver todos los valores. No recibe actor, ID, revisión, tx ni estado anterior.
No consultar datos, generar efectos externos ni modificar la entrada desde él.
Las conversiones deben ser idempotentes; validar tipos antes de convertir, evitando
transformar accidentalmente null, booleanos o valores inválidos en datos válidos.

El servicio verifica sesión, pareja ID/revisión, campos declarados y concurrencia
antes de ejecutarlo. Los campos desconocidos se rechazan incluso si normalize
pretendiera descartarlos. Zod valida el resultado completo; luego beforeSave aplica
negocio y su resultado vuelve a validarse. Guardado normal y kanban usan el mismo
flujo, con hooks y actividad dentro de Serializable. Los rechazos conservan el
borrador; normalizar no permite omitir restricciones ni permisos.

Sin normalize se conserva la validación existente. `schema`, `parse`, defaults y
el resolver RHF no ejecutan el método: es lógica del guardado de servidor, no un
callback del navegador. La validación local sigue aplicando; no asumir que entradas
rechazadas por RHF se enviarán al normalizador. No necesita migración ni regenerar
bindings. beforeSave puede seguir transformando valores por compatibilidad o cuando
la decisión requiera contexto; no hay que duplicar una conversión en ambos métodos.

## Estado anterior en los hooks

```ts
type VehicleValues = { plate: string; active: boolean };

beforeSave(values: Record<string, unknown>, context: ModelContext<VehicleValues>) {
  if (context.previous?.active && context.previous.plate !== values.plate) {
    throw new ModelValidationError("Desactiva y guarda antes de cambiar las placas.");
  }
  return values;
}
```

Importar ModelContext y ModelValidationError desde `@/lib/orm`. El genérico es
opcional; puede usarse un tipo propio o ModelValues del contrato correspondiente.
No incluir campos que no publique el repositorio utilizado.

`previous` es null al crear; al editar contiene ID, revisión y los campos del DTO
leído por el servicio tras comprobar la revisión. Es una copia readonly y congelada
de escalares; no añade otra consulta. beforeSave y afterSave reciben el mismo
contexto. En afterSave sigue representando el estado anterior, no el guardado.
El tracking compara el resultado final persistido y conserva su lectura posterior
a los hooks. No se retorna previous al formulario ni se acepta desde el cliente.

Los contextos construidos manualmente para invocar hooks deben aportar previous
(null al crear). Los métodos custom/escrituras Prisma directas no obtienen este
flujo automáticamente. Los hooks siguen dentro de la transacción, sin afterCommit.

## Menos wrappers de consulta

En un módulo `"use server"`, mantener exports async explícitos:

```ts
import { createQueryActions } from "@/lib/orm/query-actions";

const queries = createQueryActions({ prisma, authorize: requireAdmin }, {
  list: recordService.list,
  mine: myRecords, // Acción con dominio ya fijado en servidor.
  lookup: recordService.lookup,
});

export async function listRecords(state: ListState): Promise<ListResult> {
  return queries.list(state);
}
```

Importar Prisma, requireAdmin, servicios y tipos de sus módulos del proyecto.
El helper espera funciones `(prisma, actor, input) => Promise<resultado>` y conserva
los tipos de entrada/salida. Obtiene la sesión en **cada llamada**, nunca al cargar
el módulo; el servicio sigue revalidándola dentro de la transacción. El cliente sólo
envía input, sin elegir método, actor, repositorio ni dominio.

Los resultados de error del servicio se conservan. Una excepción AccessError publica
su mensaje autorizado; otras excepciones se convierten en un error genérico, sin
detalles internos. `error` permite configurar el mensaje genérico de la colección
desde servidor. El scaffold usa este helper para leer, listas, kanban, actividad y
lookup. Guardar, mover, eliminar y publicar notas conservan sus acciones explícitas:
el helper no añade invalidación, reintentos ni transforma errores en éxito.

No exportar directamente el objeto queries ni funciones no async desde un archivo
use-server. Las aplicaciones existentes pueden adoptar el helper gradualmente;
no se sobrescriben sus acciones personalizadas.

## Reacciones y restricciones registradas

El motor explícito y los decoradores de reacciones/restricciones se documentan en
[Reacciones de modelos](reacciones-modelos.md). Las constraints se ejecutan tras
beforeSave revalidado y antes de persistir; no confundir onchange del borrador con
las reglas definitivas del guardado.
