# Entorno de modelos: `context.env`

Fase 1 (lectura) y fase 2 (escritura) implementadas el 2026-11-27. Permite que los
métodos de un modelo consulten y modifiquen otros modelos registrados sin escribir
consultas Prisma a mano, pasando siempre por el servicio del modelo destino:

```ts
@action({ label: "Crear contacto de facturación" })
async crearFacturacion(record: ActionRecord<Partner>, context: ActionContext) {
  const existe = await context.env.DirectoryPartneremails.count(
    d => d.all(d.eq("partnerId", record.id), d.eq("usage", "billing")));
  if (existe) throw new ModelValidationError("Ya tiene un correo de facturación.");
  const contacto = await context.env.DirectoryPartner.create({ name: `${record.name} · Facturación`, type: "invoice", parentId: record.id });
  return { /* patch del propio registro, si hace falta */ };
}
```

## Dónde está disponible

- Consultar y escribir: `beforeSave`, `afterSave` (`ModelContext`), `@action`
  (`ActionContext`) y `beforeRemove` (`RemoveContext`).
- Sólo consultar: `@constraint`, `@onchange`, `@depends` y cálculos de colecciones
  (`ReactionContext`). Sus transacciones de reacciones son READ ONLY; una escritura
  falla con «este contexto sólo puede consultar». En `ReactionContext` TypeScript
  ya no ofrece `create`/`write`/`unlink`.

Siempre usa la **misma transacción** y el **mismo usuario** de la operación en curso:
si algo falla después, se revierte todo junto. Va en `context`, no en `this`: las
instancias de modelo se comparten entre peticiones.

## Consultas

- `search(domain | null, { fields, limit?, offset?, order?, direction? })`: filas
  `{ id, ...fields }`; `limit` 100 por defecto, máximo 500.
- `read(id, fields)`: una fila, o `null` si no existe o no es legible.
- `readMany(ids, fields)`: hasta 500 IDs, en el orden pedido; omite los ausentes.
- `count(domain?)`: número de registros legibles que cumplen el dominio.

Dominios con el mismo constructor `d` de manifests y relaciones (`d.eq`, `d.in`,
`d.all`, `d.any`, `d.not`…), con valores concretos; no admite `d.draft` ni `d.record`.
Campos: sólo persistentes públicos (1–30 por llamada); se rechazan sensitive,
writeOnly, related y compute; los Many2one devuelven su ID. Las filas son objetos
planos congelados, sin acceso perezoso: para datos relacionados usar otra llamada o
`readMany` por lote, nunca `read` dentro de un bucle grande.

## Escrituras

- `create(values)`: defaults del modelo + `values`. Devuelve `{ id, ...campos legibles }`.
- `write(id, values)`: cambio parcial. Lee la revisión actual dentro de la misma
  transacción (no hay revisión del navegador) y conserva los demás campos y líneas.
- `unlink(id)`: elimina un registro. Las relaciones Restrict y `beforeRemove` aplican;
  no borra en cascada las líneas One2many (igual que «Eliminar» en la lista).

Cada escritura usa el mismo pipeline que guardar desde el formulario: permiso
create/write/unlink y reglas de registro, restricciones de escritura por campo,
`normalize`, Zod, `beforeSave`, constraints, validación de relaciones, `afterSave`,
historial (tracking) y refresco del documento padre si es una línea. Valores: sólo
campos persistentes públicos escalares (no `id`, revisión, Many2many ni One2many).

### Guardas

- **Registro en curso**: no se puede modificar ni eliminar con `env` un registro que
  la misma operación está guardando, ejecutando en una acción o eliminando, ni crear,
  modificar o borrar sus líneas (refrescarían al padre y la operación continuaría con
  una revisión obsoleta). Para cambiar el propio registro, devolver el patch desde la
  acción o el valor desde `beforeSave`.
- **Profundidad**: hasta 3 escrituras `env` anidadas (A escribe B, cuyo hook escribe C).
  Más profundidad falla para cortar hooks que se llaman entre sí.
- No hay efectos externos: siguen sin poder enviarse correos o llamadas desde hooks.

## Seguridad

Cada llamada revalida, para el modelo destino: acceso por grupo (CRUD), reglas de
registro (AND con el dominio) y restricciones de campo («No leer» al consultar,
«No escribir» al guardar). No hay elevación de permisos (`sudo`): si el usuario no
puede, la llamada falla. Esto incluye modelos de dependencias cuyo módulo no tiene
asignado el usuario.

`env` sólo expone los modelos del propio módulo, de sus `depends` y del núcleo
(`User`). Otro nombre falla con un mensaje que sugiere declarar la dependencia.
Las extensiones (`extendModel`) se ejecutan en el servicio del modelo base. Desde el
2026-11-27 el `env` de un modelo incluye también los módulos que lo extienden y sus
`depends`: los métodos que Directorio añade a `core.user` ven `DirectoryPartner` y los
modelos de Ubicaciones. Así lo ve también el propio modelo base, siempre con permisos.

## Tipos

`orm:sync` y `orm:generate -- <módulo> --actions-only --write` generan
`src/generated/orm/actions/<módulo>/environment.ts`, que declara los campos de cada
modelo para TypeScript (selecciones como uniones, fechas como texto ISO, opcionales
con `| null`). Regenerarlo al cambiar campos. Fuera de un módulo registrado (pruebas,
demos) se usa `unavailableEnvironment`, que falla explícitamente al usarse.

## Fuera de alcance

Pendiente con caso real y aprobación: un `sudo()` explícito y auditado; escribir
Many2many/One2many por `env`; consultas con nombre propio sobre esta base.

Código: `src/lib/orm/environment.ts` (contrato, guardas, solo lectura), fachada
`environment()` en `src/lib/orm/service.ts`, alcance por módulo en
`src/lib/modules/environment.ts`, tipos en `src/lib/orm/generator/environment-types.ts`.
Pruebas: `src/lib/orm/environment.test.ts`, `environment-write.test.ts`,
`src/lib/modules/environment.test.ts` y `action-references.test.ts`.
