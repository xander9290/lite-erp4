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

`displayFields` enumera las dependencias (máximo doce, sin duplicados);
`id` se incluye siempre. Admite escalares y rutas Many2one con hasta tres saltos,
sin campos sensibles. Cada ruta termina en un escalar o ID.
El método es síncrono, heredable y devuelve texto: no recibe actor, transacción ni
acceso a consultas. Sólo recibe los campos declarados, fuera de los valores Zod,
defaults y RHF. Estos métodos no se serializan al cliente ni se publican remotamente.

## Concatenar datos relacionados

```ts
class Vehicle extends Model {
  name = Fields.Text({ required: true });
  fabricanteId = Fields.Many2one("Fabricante");
  displayFields = ["name", "fabricante.name"] as const;

  displayName(record: Readonly<{
    name: string;
    fabricante: Readonly<{ name: string }> | null;
  }>) {
    return [record.fabricante?.name, record.name].filter(Boolean).join(" · ");
  }
}
```

`fabricanteId` conserva el ID editable. `fabricante` es el alias Prisma: se quita
el sufijo `Id`; si el Field no termina en `Id`, su alias añade `Record`.
No se declara `fabricanteId.name`. La forma del parámetro debe corresponder a las
dependencias y nulabilidad declaradas; TypeScript no infiere automáticamente ese
objeto a partir de las cadenas de `displayFields`.

El generador verifica las rutas contra los modelos del **mismo perfil**. Todos los
IDs de relación atravesados y escalares finales deben estar publicados mediante
`clientFields` y no ser sensibles. El destino también debe estar registrado en ese
perfil; los modelos manuales/core, perfiles externos y colecciones inversas requieren
un proveedor propio. Esto conserva la política admin del servicio inicial y no
implementa reglas de acceso particulares por modelo relacionado.

El adaptador carga la proyección anidada para la página o lote de IDs con una sola
llamada `findMany`, sin consultas por registro en `displayName`. Prisma puede ejecutar
varias consultas SQL para resolver esa proyección. El método recibe copias congeladas
de los campos declarados; las relaciones vacías son `null` y DateTime se presenta
como ISO UTC. Ningún objeto relacionado completo se publica al cliente.

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
manualmente. Cambiar sólo el método o dependencias escalares no requiere migración
ni otro bind si lookup ya existe. Agregar rutas relacionadas sí requiere regenerar
el adaptador con `orm:bind -- <id> --write` o el flujo `orm:sync -- <id>`; un adaptador
anterior falla cerrado. Declarar estas rutas no cambia el esquema SQL; agregar un
Field Many2one nuevo sí puede requerir la migración normal. Los adaptadores verifican
las dependencias contra los metadatos publicados generados; mantener contratos y
bindings sincronizados al modificar publicación, sensibilidad o destinos.
Proveedores propios pueden implementar el método opcional del repositorio.

## Compatibilidad y ejemplo

Los catálogos manuales `user`/`partner` conservan sus contratos y plantillas
anteriores, sin ampliar su whitelist. Sus vistas existentes siguen funcionando.
`mode="display"` conserva su valor ya resuelto. FieldRelationTag no incorpora
todavía el proveedor declarativo.

Ejemplo RHF/Zod en `/sample#model-display-name`, con vehículos/fabricante ficticios,
búsqueda, modal, resolución inicial y relación vacía. No persiste ni consulta registros
del ERP. Flota sigue en tutoría: esta mejora no edita sus declaraciones ni genera
sus artefactos por adelantado.

## Simplificaciones implementadas

`normalize(values)`, `context.previous` tipado en los hooks y `createQueryActions`
ya están disponibles. Contratos, ejemplos y límites en
[Ciclo de modelos y consultas compartidas](ciclo-modelos.md).


El contrato enlazado y las nuevas APIs de presentación se documentan en
[Contratos de vistas](contratos-vistas.md).
