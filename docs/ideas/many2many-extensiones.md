# Many2many en modelos extendidos (diseño, 2026-11-20)

Estado: **implementado el 2026-11-20** con las tres decisiones propuestas aceptadas por el
usuario. Contrato vigente en [relaciones-many2many.md](../relaciones-many2many.md#many2many-en-extensiones). Pendiente registrado en
[estado del proyecto](../estado-proyecto.md#pendiente-many2many-en-modelos-extendidos-2026-11-20).
Contrato vigente de Many2many: [relaciones-many2many.md](../relaciones-many2many.md).

## Caso real

Contactosextra ya tiene el catálogo `PartnerTags` (sin sincronizar) y quiere etiquetar
contactos desde su extensión de `core.partner`:

```ts
// src/modules/contactosextra/model/partner.ts
export const PartnerExtra = extendModel(Partner, Base => {
  class PartnerExtra extends Base {
    // …campos actuales…
    tagIds = Fields.Many2many("ContactosextraPartnertags", { label: "Etiquetas", maxSelected: 20 });
  }
  return PartnerExtra;
});
```

```tsx
// PartnerInsertions.tsx
<Inserter target="stack:fiscal-data" position="after">
  <FieldRelationTag name="tagIds" />
</Inserter>
```

Hoy `extensionFields` rechaza el campo («las extensiones todavía no admiten Many2many»).

## Qué ya funciona sin cambios

El modelo compuesto (`extB(extA(Base))`) se compila con `defineModel`, que ya separa
`many2manyFields`. Por eso, en cuanto la extensión pueda declararlo, lo siguiente ya
existe y es genérico:

- defaults `[]`, `formSchema`, `FormValues`, `normalize`/hooks/constraints con el arreglo;
- `validateMany2many` en el servicio: IDs únicos, existentes y **legibles** por el actor;
  create/write del dueño; dominio del campo;
- revisión del dueño, historial «Relaciones actualizadas», misma transacción Serializable;
- publicación de `config.many2many` y lookup autorizado del destino; `FieldRelationTag`.

Lo que falta es **dónde se guardan los vínculos** y que el repositorio los lea/escriba.

## Decisión central: los vínculos cuelgan de la fila compañera

Cada extensión con campos persistentes ya tiene su tabla compañera
(`contactosextra_core_partner`, 1:1 con el registro base, Cascade). Propuesta: la tabla
intermedia referencia **la fila compañera**, no la tabla base.

```
partners (core) 1──1 contactosextra_core_partner 1──* contactosextra_core_partner_tag_ids_rel *──1 contactosextra_partnertags
                     (Cascade)                     source Cascade · target Restrict · PK (source, target)
```

- El generador ya sabe crear Many2many en un modelo del módulo: basta con incluir el
  campo en el modelo compañero que compila `compileExtensions`. Nombres estables por
  `many2manyStorage(compañero, campo)`: modelo `ContactosextraCorePartnerTagIdsLink`,
  tabla `contactosextra_core_partner_tag_ids_rel`.
- **Propiedad clara:** tabla, FKs e inversa viven en `orm-contactosextra.prisma`. No se
  toca `partner.prisma` ni el esquema del módulo base. Retirar contactosextra retira su
  compañera y sus vínculos con el mismo plan del gestor.
- **Repositorio:** la escritura va anidada en el `upsert` de la compañera que ya existe
  (`create` al crear, `deleteMany` + `create` al actualizar), en la misma sentencia,
  transacción y revisión. La lectura añade los `targetId` al `select` de la compañera,
  ordenados por ID. Registros sin fila compañera presentan `[]`; guardar una selección
  crea la fila.
- Borrar el contacto: Cascade base → compañera → vínculos. Borrar una etiqueta usada:
  Restrict, igual que en modelos propios.

**Alternativa descartada:** FK directa a la tabla base (`partners.id`). Obligaría a
escribir una inversa en el esquema del módulo base (y en `core`, nativo), y a un
segundo camino de escritura fuera de la compañera. Más invasiva sin beneficio.

## Reglas

- **Destino:** modelo declarativo registrado del propio módulo extensor, de una
  dependencia (`depends`) o nativo, igual que hoy. `PartnerTags` es del mismo módulo.
- **Límite:** máximo 4 Many2many contando base y todas sus extensiones; 100 IDs por campo.
- **Nombres:** un campo Many2many de la extensión no puede chocar con campos del base ni
  de otras extensiones (ya se valida en `compose` para escalares; se extiende a éstos).
- **Una extensión sólo con Many2many** también es válida (hoy se exige al menos un campo
  persistente escalar).
- **Modelos con repositorio propio** (`core.user`, `repository: userRepository`): fuera de
  la primera versión, con error claro al componer. `core.partner` usa el repositorio
  declarativo y sí entra.
- Sin cambios a los límites actuales de Many2many: sin columnas/filtros por miembros,
  sin tracking por vínculo, sin `inverse` editable, sin Many2many en líneas One2many.

## Presentación

- Formulario por defecto (`ModelFields`): los Many2many de extensiones salen del grupo
  «Datos generales» y van en el grupo automático de su módulo, con `FieldRelationTag`.
- Vista personalizada o inserciones: `<FieldRelationTag name="tagIds" />` donde se
  quiera; publica `field:tagIds` como cualquier Field.
- Colecciones: igual que hoy, sin columnas de Many2many.

## Plan de implementación (cuando se autorice)

1. `extend.ts`/`define.ts`: aceptar Many2many en extensiones, incluirlos en el modelo
   compañero (y en `ModelExtensionInfo.many2many`), relajar «al menos un persistente»,
   rechazar repositorios propios y validar el límite de 4 en `compose`.
2. `repository.ts`: leer/escribir los vínculos de extensión a través de la compañera.
3. `ModelFields`/`ModelExtensions`: ubicación por defecto en el grupo del módulo.
4. Pruebas: `test:modules` (declaración, límites, nombres, repositorio propio
   rechazado) e integración temporal en `test:extensions:integration` (SQL generado,
   alta/edición/limpieza de vínculos, registro sin compañera, destino ilegible o
   inexistente rechazado, Restrict del destino, Cascade al borrar, revisión e historial,
   retirada del módulo extensor). Demo RHF/Zod en `/sample` con inserción.
5. Documentación: contrato de Many2many y de herencia de modelos.

Después, a ritmo del usuario: declarar `tagIds` en PartnerExtra, `orm:sync` de
contactosextra (revisar el SQL de la nueva tabla) e insertarlo en el formulario.

## Decisiones para el usuario

1. ¿Vínculos colgados de la fila compañera (propuesto) o FK directa a la tabla base?
2. ¿`core.user` fuera de la primera versión (propuesto)?
3. En el formulario por defecto, ¿Many2many de extensiones en el grupo de su módulo
   (propuesto)?
