# Motor compartido de dominios

Implementado el 2026-11-19. El constructor produce condiciones declarativas y
reutiliza el compilador Prisma existente; no es un evaluador de JavaScript recibido
del navegador. Permisos y reglas de registro se aplican siempre mediante AND.

## Relaciones

```ts
estadoId = Fields.Many2one("UbicacionesEstado", {
  label: "Estado",
  domain: d => d.eq("paisId", d.draft("paisId")),
});
```

El primer `paisId` pertenece al destino Estado; `d.draft("paisId")` referencia
un escalar persistente y público del formulario dueño. El callback se ejecuta al
construir el Field, sin contexto de BD, y se copia a metadatos JSON inmutables.
No captura el formulario vivo ni se envía como función al cliente.

Una condición no necesita grupo. Para combinar:

```ts
domain: d => d.all(
  d.eq("paisId", d.draft("paisId")),
  d.any(d.eq("active", true), d.not(d.eq("tipo", "restringido"))),
),
```

El constructor admite `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`,
`startsWith`, `endsWith`, `in`, `notIn`, `all`, `any` y `not`. Los operadores y
valores permitidos dependen del tipo de destino, según [dominios de listas](dominios-listas.md).
`in`/`notIn` reciben arrays literales; `draft` sólo representa un escalar.
No hay rutas, funciones de valor ni referencias a arrays, imágenes, campos
sensibles o virtuales del borrador. Las referencias Many2one entre sí deben
apuntar al mismo modelo. Se admiten condiciones sobre el ID del destino.

Los nombres de campos en `Fields.Many2one/Many2many` son strings: se comprueban
contra los modelos compuestos al registrar los módulos. No se promete inferencia
TypeScript automática entre clases por su nombre Prisma. Operadores y métodos
del constructor sí tienen autocompletado y tipos; `defineListAction` además limita
los nombres por el tipo conocido del servicio.

### Identidad del registro actual

Desde 2026-11-22, `d.record.id` referencia el ID del registro dueño del formulario,
separado de los campos de `draft`. Por ejemplo, para excluir el propio contacto:

```ts
parentId = Fields.Many2one("Partner", {
  label: "Contacto principal",
  onDelete: "Restrict",
  domain: d => d.neq("id", d.record.id),
});
```

Se admite sólo en relaciones Many2one/Many2many, comparando el `id` del destino
mediante `eq` o `neq`. No admite otras propiedades de record, listas `in/notIn`,
operaciones de texto ni dominios de colecciones (que no tienen registro actual).
`d.draft("id")` sigue siendo inválido: no se añade un Field ID ni un campo SQL.

- Al editar, `neq` excluye el ID propio del buscador rápido, modal y paginación.
- Al crear sin ID, esa condición `neq` es verdadera; `eq` es falsa. AND/OR/NOT
  mantienen sus reglas booleanas y los demás filtros no desaparecen. Una
  dependencia de draft vacía sigue dejando todo el dominio sin candidatos.
- El proveedor observa el metadato ID de la propia fila al trabajar con líneas
  One2many, incluso anidadas. Cambiar/resetear la identidad invalida su caché igual
  que cambiar las dependencias. Formularios manuales deben conservar ese metadato
  de identidad para ofrecer la experiencia de edición.
- El endpoint admite `record: {id?: string}` separado de `draft` sólo si la
  declaración lo utiliza. Rechaza claves extras/IDs inválidos y comprueba lectura
  y reglas del registro dueño dentro de la misma transacción antes de consultar
  el destino. No basta con conocer un ID ajeno.
- Al guardar, el servidor toma la identidad validada del servicio, independiente
  de la petición del lookup. Revalida también después de hooks, con el ID asignado
  al crear; un hook que introduzca una autorreferencia revierte el guardado.
- Resolver una selección histórica por ID conserva su etiqueta legible y señala
  `domainValid: false` si es incompatible; no se borra automáticamente.

No requiere migración por sí mismo. Excluir el propio registro no impide ciclos
entre varios registros: esa regla de negocio permanece en la constraint del
modelo. Demo ficticia RHF/Zod: `/sample#record-domain`.

### Consultas y selecciones

- La vista sigue usando `<FieldMany2One name="estadoId" />`. Metadatos y proveedor
  fijan las dependencias; búsqueda, modal y paginación usan el mismo lookup.
- El endpoint recibe modelo dueño, campo publicado, consulta y sólo las
  dependencias declaradas. Rechaza campos extras, tipos inválidos y payloads
  mayores de 16.000 caracteres una vez validados. El servidor determina el destino
  y autoriza lectura tanto del dueño como del destino en RepeatableRead.
- Una dependencia ausente, `null` o vacía deja **todo el dominio sin candidatos**,
  también bajo OR/NOT. `false` y `0` son valores. Un `null` literal conserva su
  significado de comparar con vacío en campos opcionales.
- Cambiar una dependencia cambia la identidad del proveedor. Los controles
  invalidan cachés/respuestas anteriores y vuelven a consultar; no se descargan
  catálogos reales completos para filtrarlos en React.
- Las selecciones se conservan. La resolución por ID/lote puede mostrar etiquetas
  legibles fuera del dominio con `domainValid: false`, sin ofrecerlas como nuevos
  candidatos. El Field muestra incompatibilidad y permite corregir o quitar la
  selección. No hay limpieza automática ni `clearOnDependencyChange` todavía.
- Las etiquetas inaccesibles siguen ocultas; los errores de lectura no se
  convierten en selecciones válidas. Reintentos sólo de lectura, manuales.
- Guardar valida los valores finales después de beforeSave y después de
  afterSave dentro de la transacción Serializable. Acciones y movimientos pasan
  por el mismo persist; los hooks no pueden introducir referencias incompatibles.
  Un rechazo conserva el documento y revierte revisiones, vínculos e historial.
- Abrir un registro antiguo con selecciones legibles incompatibles permite
  corregirlo; no se rechaza sólo por el dominio. Las protecciones existentes de
  vínculos inaccesibles Many2many permanecen.

Many2many usa exactamente la misma opción:

```ts
estados = Fields.Many2many("UbicacionesEstado", {
  domain: d => d.eq("paisId", d.draft("paisId")),
});
```

Cada ID seleccionado debe cumplir el dominio al guardar; nunca se descartan
vínculos automáticamente al cambiar una dependencia. Esto limita candidatos, no
habilita consultas SQL por miembros del array ni amplía la capacidad de extender
modelos con Many2many.

Las extensiones Many2one usan el contrato compuesto del base y validan el
`depends` del módulo que declaró el Field. Las relaciones Many2one dentro de
One2many toman dependencias de **su propia fila**, no del padre. El hijo valida al
guardar por su servicio habitual. One2many no admite filtrar las líneas mismas:
se conserva la colección completa y nunca se interpretan líneas ocultas como bajas.

El proveedor de dominio del modelo tiene prioridad sobre un `load` de presentación.
No se admiten dominios en parámetros de acciones ni en bindings legacy: se rechazan
en lugar de aceptarlos sin aplicar su contrato de validación.

## Lista, Card y Kanban

Declarar el dominio en la entrada del modelo del manifest, junto a su fuente:

```ts
models: {
  documento: {
    model: Documento,
    domain: d => d.eq("active", true),
    views: { list: true, card: true, kanban: true },
    kanban: "estado",
  },
},
```

El mismo dominio se aplica antes de contar, paginar, agrupar y consultar cada
columna Kanban. No se coloca en las columnas TSX ni se envía desde React.
No modifica permisos de lectura de registros individuales, guardado o borrado.
Un `source` personalizado sigue siendo responsable de su propia consulta autorizada;
no recibe el dominio del manifest como un filtro ejecutable en el navegador.

Para contexto de servidor, el segundo argumento entrega actor y transacción,
después de revalidar sesión/lectura:

```ts
domain: (d, { actor }) => d.eq("createBy", actor.id),
```

Las colecciones no tienen `draft`; usarlo se rechaza, nunca produce una consulta
sin restricción. `all()` vacío significa verdadero y `any()` vacío falso.
Se conservan el límite de 100 nodos y ocho niveles, validación de todas las ramas,
tipos escalares nativos y escapes literales de búsquedas de texto.

Las fuentes manuales existentes conservan arrays y callbacks antiguos. También
pueden escribir:

```ts
service.defineListAction({ domain: d => d.eq("active", true) });
service.defineListAction({ domain: d => d.eq("createBy", d.actor.id) });
```

En ese contrato compatible el primer argumento reúne constructor y contexto
histórico. Las reglas de acceso mantienen su API anterior; no confundirlas con
un dominio de candidatos o de colección.

## Ejemplo, comprobación y siguiente ejercicio

Demo pública ficticia RHF/Zod en `/sample#domains`, con Many2one/Many2many,
dependencia vacía y carga de selecciones incompatibles. No persiste ni accede a
catálogos reales. Su pequeño fixture simula candidatos en memoria; la integración
comprueba las consultas SQL autorizadas del registro real.

`npm run test:domains:integration` crea proyecto/esquema PostgreSQL temporales:
reglas/permisos, sesión, ID/lote, dependencias, payload manipulado, extensiones,
Many2many, hooks/acciones, rollback, colecciones/grupos/Kanban. No instala cambios
en el ERP. El constructor y los contratos tienen pruebas en `test:orm`.

No se modificaron los modelos/vistas de Contactosextra o Ubicaciones para adelantar
la tutoría. Sigue aplicar el dominio País→Estado con el usuario y conservar por
ahora su constraint `validarPaisEstado`. El dominio por sí solo no requiere SQL;
los cambios en contratos generados se realizan con los comandos del framework,
sin editar hashes ni regenerar vistas personalizadas.

Oportunidad pendiente: inferir nombres y tipos de destino/borrador entre clases
declarativas sin exigir repetir los tipos en cada Field. Aceptación: errores de
referencia detectados por TypeScript, extensiones compatibles y ningún ciclo de
inferencia ni importación de modelos server-only al cliente.
