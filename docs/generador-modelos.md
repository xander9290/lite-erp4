# Generador de modelos: propuesta Prisma y contrato cliente

El segundo paso del scaffold ya convierte clases Model/Fields en artefactos
revisables. El perfil inicial es **flota**; sigue siendo un ejemplo de desarrollo,
sin ruta instalada ni tabla creada en la base de datos. El comando
[`create:app`](crear-aplicaciones.md) ya permite preparar módulos nuevos sin tocar tablas.

## Comandos disponibles

```sh
# Valida con Prisma 7 y muestra el plan, sin escribir en la carpeta de salida:
npm run orm:generate -- flota

# Escribe exclusivamente los artefactos de revisión y cliente:
npm run orm:generate -- flota --write

# Verifica que estén actualizados; devuelve código 2 si hace falta regenerar:
npm run orm:generate -- flota --check
```

Los comandos usan las declaraciones de `src/lib/orm/examples/fleet-vehicle.ts`.
El perfil y la lista explícita de campos publicados están en `scripts/orm-generate.ts`.
No se importan modelos o rutas arbitrarios recibidos desde el navegador.

Si existe `src/app/(auth)/erp/<id>/orm.config.ts`, se usa el perfil de esa aplicación
y la salida `src/generated/orm/apps/<id>`. `--example` fuerza el perfil incorporado
de Flota y mantiene su salida original. Crear Flota durante la tutoría no colisionará
con los artefactos del ejemplo.

## Qué produce

```text
src/generated/orm/flota/
├── FleetVehicle.schema.ts      # Fields, Zod, defaults y tipos para cliente
├── models.prisma              # Modelo y enum nuevos; fragmento para revisar
├── schema.preview.prisma      # Esquema actual completo + propuesta del módulo
├── migration.preview.sql      # Comparación de esquemas; SQL sin ejecutar
├── review.json                # Relaciones inversas y reglas sólo de validación
└── generation-manifest.json   # Propiedad e integridad de archivos generados
```

`schema.preview.prisma` copia el esquema actual en memoria y añade la propuesta.
Conserva los campos existentes de Partner y propone su relación inversa con vehículos.
Omite los bloques de generator para evitar generar un cliente de Prisma por accidente
desde ese archivo. `models.prisma` es un fragmento: no contiene por sí solo todas sus
dependencias y no se valida aisladamente.

Prisma valida el esquema completo antes de escribir. Después, `prisma migrate diff`
compara **archivos de esquema**, no una base conectada, para producir el SQL de revisión.
La propuesta actual sólo añade `fleet_vehicles`, su enum, índices y clave foránea.
El generador inicial rechaza una propuesta SQL que incluya eliminaciones.

Ningún comando de `orm:generate` modifica `prisma/models`, crea/aplica una migración, ejecuta SQL,
regenera el Prisma Client activo ni registra Flota en el ERP. El SQL es una propuesta
respecto al esquema versionado; no comprueba drift de la base de producción.

## Usar el contrato desde una vista propia

El archivo generado puede importarse desde un componente cliente sin importar la
clase del servidor:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FleetVehicleSchema,
  createFleetVehicleDefaults,
  type FleetVehicleInput,
  type FleetVehicleValues,
} from "@/generated/orm/flota/FleetVehicle.schema";

function useVehicleForm() {
  return useForm<FleetVehicleInput, unknown, FleetVehicleValues>({
    resolver: zodResolver(FleetVehicleSchema),
    defaultValues: createFleetVehicleDefaults(),
  });
}
```

La vista se escribe libremente con nuestros componentes. El generador no renderiza
formularios ni convierte métodos de la clase en llamadas remotas.

Los campos publicados se eligen explícitamente en `clientFields`. Agregar un campo
interno a la clase no lo incorpora automáticamente al esquema cliente. Los métodos
no se serializan. Una selección parcial de campos necesita un contrato de escritura
del servidor que complete/autorice sus datos; no equivale al modelo completo ni
concede permisos para modificarlo. En Flota se publican los siete campos del ejemplo
y sus tipos coinciden con los de la declaración del servidor.

## Mapeos de esta fase

| Declaración | Prisma PostgreSQL |
| --- | --- |
| Text | String; VarChar si hay maxLength |
| Integer | Int, con validación de rango de 32 bits |
| Boolean | Boolean |
| Selection | Enum con los valores declarados; las etiquetas quedan para UI |
| DateTime | DateTime con Timestamptz(3) |
| Many2one | ID String, relación e inversa; índice o unicidad según el campo |

Se añaden ID cuid, createdAt, updatedAt y createBy al modelo propuesto. createBy
referencia User como auditoría de infraestructura, con inversa e índice gestionados;
ver [auditoría de modelos](auditoria-modelos.md). Los defaults literales
se normalizan con el Field antes de convertirlos a defaults de Prisma. Un default
opcional que normaliza a null no añade un default SQL.

Integer se ajustó al rango de Int para impedir que Zod acepte valores que ese tipo
de Prisma no puede almacenar. Referencia de tipos del [conector PostgreSQL de Prisma 7](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).
Un futuro Field para enteros grandes necesitará un mapeo y contrato propios.

`unique`, obligatoriedad, enum, longitud máxima y claves foráneas se representan
en la propuesta donde corresponde. `minLength`, trim y rangos personalizados siguen
siendo validaciones Zod; no se inventan CHECKs SQL. El reporte señala esa diferencia.
La existencia de un conductor y los permisos deberán comprobarse en el futuro servicio.

## Relaciones y dependencias

La propuesta de Flota declara dependencia de Contactos y un enlace explícito de
Partner con su módulo propietario. Esta vinculación de modelos existentes está en
`externalOwners` del perfil, para que la herramienta no importe React/iconos ni ejecute
la aplicación al generar. La integración automática con el catálogo de instalación
seguirá en otra fase; el enlace no sustituye sus validaciones futuras.

El generador comprueba que el destino exista en el esquema o en la generación,
que se haya declarado la dependencia y que no haya conflictos de nombres/tablas.
Los destinos existentes necesitan un ID String simple sin tipo nativo especial.
Se generan nombres explícitos de relación para soportar varias referencias al mismo
modelo, autorrelaciones y unicidad one2one. Un Field `driverId` produce la relación
`driver`; un nombre sin sufijo Id produce `<nombre>Record` para conservar el ID escalar.

Las inversas de modelos existentes se proponen en `review.json` y en el preview.
El archivo real de Partner permanece intacto durante `orm:generate`.
El comando separado [orm:install](instalar-modelos.md) ya incorpora modelos nuevos
e inversas con protección de propiedad, sin ejecutar SQL. Todavía no hay Many2many/One2many
declarativos. La actualización aditiva de modelos instalados se revisa y aplica al
esquema mediante `orm:install --update`; la migración de base sigue siendo explícita.

## Regenerar sin pisar personalizaciones

El manifiesto guarda hashes de los archivos creados por el generador. Antes de
escribir, comprueba todos los archivos anteriores:

- Un archivo personalizado en el destino nunca se sobrescribe.
- Si se editó o eliminó un artefacto generado, la operación se detiene.
- Si desaparece un artefacto del plan, se exige revisión explícita; no se borra solo.
- No se siguen enlaces simbólicos en la salida; un lock evita dos escrituras simultáneas.
- Los cambios se preparan antes de reemplazar archivos; si falla un reemplazo, se
  intenta restaurar lo ya reemplazado.

No hay flag force. Las vistas, servicios y reglas propias se mantienen fuera de
esa carpeta. El manifiesto es un control de integridad local, no una firma de seguridad.

## Límites y verificación

Los defaults con funciones siguen funcionando en el contrato de servidor del paso 1,
pero esta generación los rechaza: no copia código de funciones al navegador ni los
ejecuta para fijar un resultado permanente. Los hooks beforeSave/afterSave ya se
ejecutan por el servicio compartido dentro de la transacción. Los defaults con
funciones/contexto siguen fuera del contrato serializable del generador.

```sh
npm run test:orm
npm run orm:generate -- flota --check
npx tsc --noEmit
```

Las pruebas comparan validación/defaults cliente-servidor, inferencia de tipos,
publicación explícita, relaciones e integridad de archivos. También importan el
contrato generado en un proceso sin las condiciones React de servidor.

El generador ya está conectado con la creación del cascarón de una
aplicación y con la instalación inicial de su esquema mediante `orm:install`.
La migración y generación del cliente activo siguen siendo pasos explícitos;
`orm:bind` genera el acceso tipado para los servicios iniciales y `orm:install --update`
permite evolución aditiva. Contrato, permisos y secuencia en [Flujo del framework](flujo-framework.md).
