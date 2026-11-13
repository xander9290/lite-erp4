# Agrupación anidada de ListView

Many2one directo se agrupa por su ID persistente, con groupable en la columna y en
list.groupable del servicio. Configurar su proveedor autorizado en relations para
mostrar etiquetas; nombres iguales conservan grupos distintos. El scaffold nuevo
habilita Many2one, Boolean y Selection agrupables. Vehicle habilita Modelo (name).
Esto es distinto de agrupar por rutas como modelo.fabricante.name, aún pendiente.

ListView permite hasta tres niveles ordenados, con grupos desplegables, conteos y
carga al abrir cada rama. Se habilita por columna con `groupable: true` y una
acción propia `load(state)`. Las aplicaciones creadas por el scaffold habilitan
`active`; las existentes mantienen su configuración hasta que se adapte.

```ts
export const recordColumns = [
  { field: "brand", label: "Marca", type: "text", groupable: true, sortable: true },
  { field: "active", label: "Activo", type: "boolean", groupable: true, sortable: true },
] as const;
```

Publicar las mismas columnas en `createModelService` y ListView. Tras actualizar
el framework, regenerar el adaptador con `orm:bind -- <id>` y después `--write`.
No necesita migración ni regenerar Prisma Client si el modelo almacenado no cambió.
No editar adaptadores gestionados manualmente. El servicio rechaza agrupaciones
sin soporte del repositorio con un mensaje explícito.

## Contrato de consulta

- `ListState.groupBy?: string[]`: campos en orden jerárquico, sin duplicados.
- `groupPath?: (string | number | boolean | null)[]`: valores exactos de los
  ancestros abiertos, alineados con `groupBy`; no se publica en la URL.
- Mientras falten niveles, `ListPage.groups` contiene `{ value, count }`,
  `rows` está vacío y `hasMoreGroups` indica si existe otra página de grupos.
- Al completar la ruta, se devuelve una página de registros convencional.
- `total` siempre cuenta registros del ámbito actual, no grupos. Los grupos se
  ordenan por su valor ascendente; el orden de columnas se aplica a los registros.
- El repositorio opcional `groups(tx, {where, field, skip, take})` devuelve grupos
  contados en SQL. Se solicita una entrada adicional para detectar la página
  siguiente, sin descargar todas las claves ni todos los registros.

Cada petición del servicio revalida la sesión/admin en una transacción
RepeatableRead. Dominio fijo, filtros, búsqueda y ruta se combinan con AND antes
del conteo y de la consulta. El navegador nunca suministra un `where` ni decide
el dominio. Abrir otra rama produce otra instantánea: los conteos pueden cambiar
si hay escrituras concurrentes; Actualizar vuelve a consultar y cierra las ramas.

## Interacción y límites

«Agrupar por» añade niveles; ↑ cambia su orden, × retira un nivel y «Sin agrupar»
restaura la tabla. `group` (o `<paramPrefix>_group`) conserva la jerarquía en la URL.
Cambiar agrupación, filtros, orden o tamaño vuelve a la primera página y cierra
las ramas. Limpiar filtros conserva la agrupación.

Cada rama pagina independientemente y cada página de registros tiene su propia
selección y menú de eliminación. No hay selección de un grupo entero ni borrado
implícito de páginas ocultas. Eliminar conserva la confirmación y la recarga del
contrato existente; no evita autorización ni control de revisión del servidor.

Este primer contrato admite escalares de texto, selección, booleanos y enteros;
los Many2one escalares se agrupan por ID y pueden mostrar su displayName mediante
`resolveListLabels` y columnas `widget: "many2one"`. `groupedPage` publica el
`groupField` del nivel actual; el resolvedor consulta sólo los IDs de esa página
con el lookup autorizado y añade `label`, conservando `value` y conteos. Dos IDs
con el mismo nombre siguen siendo grupos distintos. Referencias ausentes muestran
«No disponible»; errores del lookup rechazan la consulta completa. Selection usa
sus `options` también en encabezados. Esto no habilita agrupación por rutas
de relaciones (`createByUser.login`), ni fechas/periodos. `null` y cadena vacía son
grupos distintos; el texto usa igualdad exacta, incluso mayúsculas/minúsculas.
Los proveedores legacy sin `load` (`partner`, `user`) no
habilitan esta función: rechazan peticiones agrupadas en lugar de ignorarlas.
Los proveedores propios deben implementar el contrato o rechazarlo explícitamente.

Ejemplo público: `/sample#list-grouping`, con datos ficticios y consultas de
servidor en memoria, sin persistencia. No demuestra por sí solo el acceso Prisma.

## Pendiente: agrupación por rutas de relaciones

Registrado el 2026-11-10 a petición del usuario; es una ampliación propuesta,
todavía no implementada.

Alcance inicial: rutas de relaciones Many2one y uno a uno, incluidos varios saltos
cuando todas las relaciones del recorrido sean de ese tipo. Ejemplos:
`createByUser.login`, `createByUser.partner.name`, `patient.name` y
`vehicle.driver.name`; cada ejemplo depende de que el modelo y el proveedor
declaren y autoricen esa ruta.

Cada ruta se habilitará explícitamente en el servidor y definirá su clave y su
etiqueta. Para agrupar por la entidad relacionada, usar su ID como clave y mostrar
login, nombre o avatar como presentación; dos entidades con el mismo nombre no
deben fusionarse. Definir también el tratamiento de relaciones opcionales y nulas.
No aceptar rutas arbitrarias enviadas desde el navegador.

Criterios de aceptación: mantener agrupación anidada, conteos SQL, paginación por
rama, dominios, filtros, búsqueda y autorización; no descargar el dataset completo
ni ampliar los datos publicados por el proveedor. Probar identidades con etiquetas
iguales, relaciones nulas, varios saltos y rechazo de rutas no autorizadas.

One2many y Many2many quedan fuera de ese primer alcance: requieren un contrato
separado para pertenencia a varios grupos, duplicados, conteos y paginación.
La agrupación por periodos de fecha sigue siendo otro pendiente independiente.

## Comprobaciones

`npm run test:list-grouping` cubre tipos/rutas inválidos, URL, prefijos, tres
niveles y páginas del ejemplo. `src/lib/orm/service.test.ts` comprueba que conteos,
grupos y registros reciben el mismo dominio/filtros, y rechaza sesiones inválidas.
La integración aislada del framework incluye el adaptador SQL generado.
