# Nombres de presentación de modelos

Los modelos declarativos definen la etiqueta compartida de sus Many2one en el
servidor. Por defecto se usa `name` si es Text no sensible; sin él, el ID.
Una etiqueta vacía también usa el ID. No se almacena otra columna.

```ts
class Vehicle extends Model {
  name = Fields.Text({ required: true });
  plate = Fields.Text({ required: true });

  displayFields = ["name", "plate"] as const;

  displayName(record: Readonly<Record<string, unknown>>) {
    return `${record.name} · ${record.plate}`;
  }
}
```

`displayFields` enumera las dependencias escalares (máximo doce, sin duplicados);
`id` se incluye siempre. No admite rutas, relaciones resueltas ni campos sensibles.
El método es síncrono, heredable y devuelve texto: no recibe actor, transacción ni
acceso a consultas. Sólo recibe los campos declarados, fuera de los valores Zod,
defaults y RHF. Estos métodos no se serializan al cliente ni se publican remotamente.

## Conectar un Many2one

El servicio del modelo relacionado expone `lookup`. Una Server Action fija el
servicio y obtiene la sesión; el servicio revalida cuenta activa, administrador y
versión de sesión dentro de RepeatableRead. Ejemplo:

```ts
"use server";

export async function lookupVehicles(request: ModelLookupRequest): Promise<Many2OneResult> {
  try { return await vehicleService.lookup(prisma, await requireAdmin(), request); }
  catch { return { ok: false, error: "No se pudieron consultar los vehículos." }; }
}
```

Los tipos se importan de `@/lib/many2one/model-lookup` y
`@/lib/many2one/types`; importar el servicio, Prisma y requireAdmin del proyecto.
El scaffold nuevo incluye `lookupRecords` autorizado.

```tsx
<FieldMany2One name="vehicleId" label="Vehículo" load={lookupVehicles} />
```

Con `load` no se declaran `model`, `displayName` ni `searchFields` en el Field.
Sugerencias, modal y resolución del ID guardado usan el mismo proveedor. El resultado
publica ID/label y `record: {id}`; no devuelve los campos usados para construir la
etiqueta ni columnas auxiliares. La selección conserva sólo el ID en RHF.

La búsqueda usa exclusivamente Text no sensibles de `searchFields` del servicio;
cada palabra debe coincidir en alguno. No busca sobre la etiqueta calculada ni por
rutas de auditoría. Hay paginación (1–25), orden estable por ID y resolución por ID
o lote de hasta cien IDs únicos. No acepta modelo, actor, select, plantilla, dominio
ni campos desde el navegador. Los dominios de otras acciones de lista no se heredan;
este servicio conserva acceso admin. Un dominio no autoriza relaciones al guardar:
las reglas de negocio específicas deben seguir validando las referencias.

Adaptadores existentes requieren `orm:bind -- <id> --write` para incorporar lookup,
una vez sincronizados sus modelos, esquema y cliente. No editar bindings ni hashes
manualmente. Cambiar sólo displayName/displayFields no requiere migración ni otro
bind si lookup ya existe: la proyección se decide en servidor por consulta.
Proveedores propios pueden implementar el método opcional del repositorio.

## Compatibilidad y ejemplo

Los catálogos manuales `user`/`partner` conservan sus contratos y plantillas
anteriores, sin ampliar su whitelist. Sus vistas existentes siguen funcionando.
`mode="display"` conserva su valor ya resuelto. FieldRelationTag no incorpora
todavía el proveedor declarativo.

Ejemplo RHF/Zod en `/sample#model-display-name`, con vehículos ficticios, búsqueda,
modal y resolución inicial. No persiste ni consulta registros del ERP. Flota sigue
en tutoría: no se genera, instala o relaciona Fabricante por esta mejora.

## Simplificaciones implementadas

`normalize(values)`, `context.previous` tipado en los hooks y `createQueryActions`
ya están disponibles. Contratos, ejemplos y límites en
[Ciclo de modelos y consultas compartidas](ciclo-modelos.md).
