# Campos calculados virtuales

Implementados el 2026-11-12. El modelo declara un Field de lectura y un método;
React presenta el resultado con los Fields existentes. Se reutilizan los contratos
de lectura y el motor autorizado de reacciones.

```ts
class Linea extends Model {
  cantidad = Fields.Integer({ required: true });
  precio = Fields.Integer({ required: true });
  total = Fields.Integer({ label: "Total", compute: "calcularTotal", required: true });

  @depends("cantidad", "precio")
  calcularTotal(values: ReactionValues) {
    return Number(values.cantidad ?? 0) * Number(values.precio ?? 0);
  }
}
```

`Fields.Integer`, `Fields.Text` y `Fields.Image` admiten compute. Un método para
un solo Field devuelve el escalar. Si varios Fields comparten método, éste devuelve
un objeto con exactamente sus nombres y valores, sin omitir ni añadir salidas.
Los resultados se validan con sus schemas, incluidos Int de 32 bits y URLs HTTPS.
El ejemplo usa precios enteros; no introduce Float ni un tipo monetario persistido.

## Dependencias y servidor

Usar `@depends("cantidad", "precio")` o `@depends({ fields: [...] })`, sin repetir
preview/writes: sus outputs se infieren de los Fields compute. También se admite
registro explícito de lectura con método/dependencias; mantener uno por método.
Un override debe volver a declarar su decorador, igual que las reacciones actuales.
Sin override, Fields y métodos se heredan normalmente.

El método recibe sólo sus dependencias en una copia congelada y el contexto de
reacciones; puede ser async. En un borrador incompleto puede recibir null/undefined:
debe representarlo con una salida válida o rechazar el cálculo. No recibe todo
el formulario. Métodos ausentes, dependencias inexistentes/sensibles y salidas
duplicadas producen errores al declarar/generar el modelo.

Si la misma petición ejecuta onchange y compute activos, primero valida los patches
editables y después calcula sobre ese borrador efectivo. No dispara otras reglas
inactivas ni envía otra petición desde React; tampoco crea una cascada entre cálculos.

La acción real usa recordService.react, con sesión/admin revalidados, revisión si
hay ID, y transacción RepeatableRead readonly. No hacer efectos externos ni usar
otro Prisma Client para eludirla. SQL readonly no es un sandbox para código JS.
Al guardar siguen mandando normalize, constraints, permisos y concurrencia del
servidor; no confiar en un cálculo enviado por el navegador.

## Vista y generación

```tsx
<FieldNumber mode="display" name="total" type="integer" direction="inline" />
<FieldText mode="display" name="resumen" />
```

Los controles heredan label de recordUI.readFields. Text/Number comparten
presentación de lectura, carga y error/reintento; no usan inputs ni useController.
Image usa su modo display existente. El frontend sólo formatea la presentación.

Compute no pertenece a clientFields, defaults, ModelInput/ModelValues, valores RHF,
esquema de guardado, auditoría ni Prisma. No acepta default, unique/tracking/sensitive
activos ni related simultáneo. required valida el resultado, no solicita captura.
Los schemas estrictos rechazan esos campos en el payload. No existe store aquí.

Se generan PreviewFields y ReactionRules, sin publicar métodos ni sus nombres.
Conectar readFields/reactions como en [Campos relacionados](campos-relacionados.md).
El scaffold nuevo genera controles display para Text, Integer e Image; conservar
las vistas personalizadas y editarlas explícitamente, sin regenerarlas.

Regenerar contratos con orm:generate -- app --write o usar orm:sync -- app.
Cambiar sólo compute no requiere SQL ni binding nuevo, mientras no cambien Fields
persistentes ni proyecciones related/display. Las dependencias deben estar publicadas.

## Alcance actual

Se consulta al abrir/resetear el formulario, cambiar una dependencia o reintentar.
Conserva debounce, agrupación, descarte de respuestas antiguas y espera de peticiones
antes de enviar. El preview no ensucia RHF; un error vigente bloquea el envío.

Esta etapa es virtual para borradores de formularios: no columnas persistidas,
inverse, orden/búsqueda/grupos ni proyección automática desde list/read/lookup.
La proyección por lote de related en colecciones ya existe; no implica que los
métodos compute se ejecuten por fila en esas vistas.
Sólo depende de Fields locales persistentes, sin cadenas compute/related, ciclos
ni invalidación por cambios externos en relaciones. Agrupar fórmulas relacionadas
en un mismo método con varias salidas evita cascadas de frontend.

Demo RHF/Zod en /sample#model-reactions: total Integer y resumen Text calculados
en servidor, sin BD ni persistencia. Validar muestra sólo name/quantity/unitPrice
en el payload y sigue ejecutando las restricciones definitivas.

La siguiente etapa requiere diseñar invalidación y recomputación persistente
ante escrituras fuera del formulario y cambios relacionados; no se habilita aquí.
