# Modelos TypeScript: primer contrato del scaffold

Esta fase implementa la declaración de clases y Fields, su esquema Zod y sus tipos.
El [segundo paso del generador](generador-modelos.md) ya produce propuestas Prisma,
SQL de revisión y validación cliente desde esas declaraciones, sin instalar tablas.
Esta API de declaración no ejecuta consultas, acciones ni rutas. Flota es un ejemplo
ejecutable del contrato, no una aplicación instalada. Contactos y Citas siguen usando
sus modelos y operaciones actuales.

## Tu primer modelo

La implementación de referencia está en `src/lib/orm/examples/fleet-vehicle.ts`:

```ts
import "server-only";
import { Fields, Model, defineModel, type ModelInput, type ModelValues } from "@/lib/orm";

class Vehicle extends Model {
  plate = Fields.Text({ label: "Placas", required: true, unique: true, maxLength: 20 });
  brand = Fields.Text({ label: "Marca", required: true, maxLength: 100 });
  mileage = Fields.Integer({ label: "Kilometraje", required: true, min: 0, default: 0 });
  driverId = Fields.Many2one("Partner", { label: "Conductor", onDelete: "Restrict" });
  active = Fields.Boolean({ label: "Activo", default: true });
}

export const vehicleModel = defineModel(Vehicle, {
  name: "FleetVehicle",
  table: "fleet_vehicles",
});

export type VehicleInput = ModelInput<typeof vehicleModel>;
export type VehicleValues = ModelValues<typeof vehicleModel>;
```

La clase describe los campos; `defineModel` recoge los Fields de la instancia,
incluidos los inicializados por clases base, y excluye sus métodos. Los atributos
de la clase son **descriptores**, no valores de un vehículo guardado.
Los constructores deben limitarse a declaraciones, sin consultas ni efectos externos.
No se despachan métodos ni se expone una API remota automáticamente.

`name` identifica el futuro modelo Prisma; `table` declara el nombre físico deseado.
Ninguno crea una tabla. Los nombres se validan y los campos `id`, `revision`,
`createdAt`, `updatedAt`, `createBy` y `createByUser` están reservados para el contrato
de persistencia. La [auditoría implícita](auditoria-modelos.md) asigna el creador
desde la sesión del servidor al crear; no se declara como Field editable.

## Valores iniciales y validación

```ts
const defaults = vehicleModel.createDefaults();
// { plate: "", brand: "", mileage: 0, driverId: null, active: true }

const result = vehicleModel.schema.safeParse({
  ...defaults,
  plate: " ABC-123 ",
  brand: "Marca de ejemplo",
});

if (result.success) {
  // result.data.plate === "ABC-123"
  // result.data.mileage es number, nunca null después de validar.
}
```

`createDefaults()` devuelve un objeto nuevo. Los campos obligatorios pueden empezar
vacíos para la captura; no se intenta validar un formulario vacío al importar el módulo.
Los defaults explícitos sí deben ser válidos. Se admiten funciones de default y se
ejecutan cada vez que se solicita un formulario nuevo, no al declarar el modelo:

```ts
Fields.DateTime({ required: true, default: () => new Date().toISOString() });
```

Los defaults se aplican al construir valores iniciales, **no al recibir un payload
incompleto**. El esquema exige todas las claves de la colección de campos y rechaza
propiedades adicionales; más adelante definiremos contratos separados para parches.

El contrato también ofrece `vehicleModel.parse(input)`, que valida con su esquema
base y lanza ZodError si falla. Los errores conservan su ruta, por ejemplo `plate`.
Un esquema personalizado con `schema.superRefine(...)` es un esquema nuevo: debe
utilizarse explícitamente; no modifica el método `parse` del contrato original.

## Catálogo inicial

| Field | Entrada de controles | Salida validada y reglas |
| --- | --- | --- |
| `Text` | `string \| null`; inicia en `""` | Recorta espacios salvo `trim: false`; vacío pasa a null si es opcional. `minLength` / `maxLength`. |
| `Image` | `string \| null`; inicia en `null` | URL HTTPS sin credenciales, hasta 2048 caracteres. folder obligatorio; [contrato y Cloudinary](ideas/campos-imagen.md). |
| `Integer` | `number \| null`; inicia en null | Entero de 32 bits, compatible con Int de Prisma; `min` / `max`. No convierte strings a números. |
| `Boolean` | `boolean`; inicia en false | true y false son válidos. No acepta `required`; no significa «debe estar activado». |
| `Selection` | Unión literal de opciones o null | Acepta sólo los valores declarados; etiquetas separadas del valor persistido. |
| `DateTime` | `string \| null`; inicia en null | ISO UTC con Z. Rechaza fechas locales, offsets, días inválidos y fechas sin hora. |
| `Many2one` | `string \| null`; inicia en null | ID de texto de hasta 100 caracteres. Declara destino y `onDelete: Restrict/SetNull`. |

Excepto Boolean, `required: true` elimina null del tipo de salida validada. Un
default como `0` o `true` no estrecha el campo a ese literal: seguirá siendo number
o boolean. Selection sí preserva la unión de sus opciones.

```ts
Fields.Selection([
  { value: "available", label: "Disponible" },
  { value: "maintenance", label: "En mantenimiento" },
], { required: true, default: "available" });
```

Los campos opcionales conservan su clave y usan null; no se omiten con undefined.
Las opciones desconocidas, límites incompatibles, selecciones duplicadas y defaults
inválidos fallan explícitamente. `SetNull` no es compatible con una relación requerida.
El catálogo no incluye todavía Float, Date sin hora, One2many ni Many2many.

## Inferencia y libertad de tipos

`ModelInput` representa la captura y `ModelValues` el resultado de Zod. Las pruebas
de compilación verifican compatibilidad de `zodResolver` con los tres parámetros
de RHF: `useForm<Input, unknown, Values>`. No se requiere escribir ambas interfaces
manualmente. Puedes añadir types, interfaces, DTOs o intersecciones para tu negocio.

El tipo del registro persistido se incorporará con la integración de Prisma;
esta fase no inventa IDs ni revisiones de registros que todavía no existen.

## Frontera con el navegador y vistas

`Model`/`defineModel` son del servidor. No importar la clase ni el contrato del modelo
desde una vista cliente y no pasar funciones/esquemas Zod mediante props de servidor.
El generador produce los artefactos de validación que la vista puede importar desde
`src/generated/orm/flota`, sin incluir la clase ni métodos del servidor. Los campos
publicados se eligen explícitamente. Ver la guía del segundo paso para usar su Zod
con el resolver de RHF.

`metadata` contiene sólo atributos de campos y señala si el default es literal o
una fábrica; no expone la función de default. Los descriptores y metadatos se congelan.
Esto no convierte automáticamente en público todo atributo que decida agregar un módulo.

Las vistas se seguirán componiendo en TSX con FormView/ListView/Fields/Notebook.
La integración con los Fields visuales, eventos mediante callbacks/hooks y métodos
de negocio del modelo son fases posteriores. No hay renderizado automático de forms.

## Restricciones que aún no aplica esta fase

`unique: true` registra intención: Zod no consulta ni garantiza unicidad en la base.
Many2one valida el ID, pero aún no resuelve el modelo destino, comprueba existencia,
permisos ni la clave foránea. No usar este contrato como servicio de persistencia.
La propuesta Prisma del segundo paso expresa las restricciones compatibles; sólo
aplicarlas y añadir operaciones autorizadas completará esas garantías en la base.

## Verificación y siguiente paso

```sh
npm run test:orm
npx tsc --noEmit
```

`model.test.ts` verifica el comportamiento. `model.typecheck.ts` comprueba los tipos
y los errores esperados de TypeScript; no se ejecuta como prueba de runtime.

El mapeo inicial y la generación revisable ya funcionan con `npm run orm:generate -- flota`.
La instalación, el cascarón y los servicios iniciales ya están conectados.
`beforeSave` y `afterSave` son hooks opcionales de la clase, ejecutados por el servicio
en la transacción; el resto de los métodos no se publica automáticamente.
El recorrido y sus límites están en [Flujo del framework](flujo-framework.md).
