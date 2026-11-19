# One2many anidados

**Fase B implementada el 2026-11-19** a petición del usuario (rama `codex/partner`, sin
commit). Contrato vigente en [Líneas declarativas](../lineas-one2many.md#líneas-anidadas-2026-11-19).
**Fase A implementada el 2026-11-19:** relaciones de consulta `readonly`
([contrato](../lineas-one2many.md#relaciones-de-consulta-readonly-2026-11-19)). Regla acordada con
el usuario: hijos numerosos se crean desde su propio formulario.
Ubicaciones: `Estado.municipioIds` declara `maxRows` ≤ 100, pero un estado real puede tener
más municipios; el documento País rechazará abrirse en cuanto un estado supere su límite.

**Pendiente urgente solicitado el 2026-11-19.** Registrar el trabajo no autoriza
implementarlo. Presentar el diseño con sus límites antes de modificar el motor.

## Caso real y límite actual

Ubicaciones declara Pais.estadoIds → Estado y Estado.municipioIds → Municipio.
El segundo nivel hace que defineModule rechace Pais.estadoIds: el contrato actual
admite hasta cuatro One2many hermanos, pero el hijo no puede tener líneas propias.
Las Many2one inversas siguen siendo required/no únicas/Restrict válidas.
No quitar la validación como solución: el coordinador sólo implementa un nivel.

## Diseño necesario

- Definir profundidad máxima y límites de filas por rama y por documento completo;
  rechazar ciclos y propiedad ambigua. No prometer profundidad o volumen ilimitados.
- Cargar/guardar el árbol autorizado completo en una transacción, con hooks,
  constraints, dominios, historial y validación en cada nivel. Una fila oculta no
  debe interpretarse como baja; errores tardíos deben revertir todo el documento.
- Concurrencia y revisión de ancestros: una escritura independiente del descendiente
  invalida los borradores afectados. Revalidar permisos del recorrido y conservar
  filtros de acceso heredado, sin ampliar derechos desde las vistas.
- Altas/bajas/ediciones en orden consistente, con identidad persistida de cada fila;
  conservar Restrict y no introducir cascadas ni reparenting implícitos.
- RHF/Zod, rutas de errores, dirty guard, locks y acciones de formulario coordinados
  con el padre. Mantener edición inline y composición explícita; no imponer modales.
- Evaluar catálogos grandes: municipios pueden superar el máximo actual de líneas.
  No paginar/filtrar una colección editable de forma que omitir filas las elimine.

## Criterios de aceptación

Fixtures independientes de la tutoría que cubran al menos tres niveles de modelo,
lectura/alta/edición/baja, permisos parciales, dominios de fila, concurrencia desde
padre e hijo, rollback de hooks/constraints, historial, errores UI y límites.
Regresión del One2many actual y guardados/acciones conservada; sin datos reales.
Revisar cualquier SQL necesario antes de aplicarlo; no requiere migrar por el mero
hecho de declarar One2many sobre FKs existentes.

Contrato vigente: [Líneas declarativas](../lineas-one2many.md).
Punto actual: [Estado](../estado-proyecto.md).

## Propuesta de diseño (2026-11-19, pendiente de aprobación)

### Hallazgos al revisar el motor actual

- **El servicio ya es recursivo en su núcleo.** `persistLines` guarda cada línea con
  `child.persist(...)`, el ciclo completo del hijo (normalize, hooks, constraints,
  Many2many, historial). Si el hijo declarara líneas, su `persist` ya llamaría a
  `persistLines` para los nietos con `skipOwner` del hijo.
- **La concurrencia de ancestros ya se encadena.** Una escritura independiente de un nieto
  ejecuta `captureOwners` → `refresh` del hijo → `persist` del hijo → `captureOwners` → `refresh`
  del padre: la revisión sube por toda la rama en la misma transacción.
- **El acceso heredado ya es recursivo.** `authorizeModel` limita al hijo por el alcance del
  padre (`owners`), y esa llamada vuelve a aplicar el del abuelo.
- **Lo que hoy impide el segundo nivel:**
  1. `defineModule` rechaza un hijo con líneas propias (guard intencional).
  2. `owned()` devuelve filas planas (`projectListRow`), sin sus líneas: el documento no
     carga nietos y el borrador no los conoce.
  3. `validateLines` rechaza claves que no sean metadata del hijo (las líneas anidadas lo son).
  4. Cliente: `useModelField` sólo reconoce rutas `campo.N.subcampo` de un nivel;
     `ModelLineConfig` no anida líneas; `FieldOne2many` no tiene presentación para sublíneas.

### El caso de Ubicaciones no es un documento

México tiene 32 estados, pero unos 2,475 municipios (Oaxaca solo ~570). Un «documento País»
con municipios anidados tendría miles de filas editables en un formulario y una transacción:
ningún límite razonable lo admite, y paginar una colección editable haría que las filas no
cargadas parecieran bajas. **Ubicaciones es un catálogo de referencia, no un documento con
líneas.** Para ese caso propongo una pieza distinta (fase A) y reservar los One2many anidados
editables para documentos acotados (fase B), p. ej. Pedido → Líneas → Entregas o
Ticket → Intervenciones → Materiales.

### Fase A — Relaciones de consulta (`readonly`), resuelve Ubicaciones

`Fields.One2many("UbicacionesMunicipio", { inverse: "estadoId", readonly: true })`:

- No forma parte de RHF, Zod ni del guardado: el formulario del Estado muestra una
  colección **paginada, con búsqueda y filtros** de sus municipios (la misma fuente de
  ModelCollection con dominio fijo `estadoId = registro`), con enlace a cada municipio y
  botón «Nuevo» que preasigna el Estado.
- Sin límite de filas, sin riesgo de bajas implícitas, con permisos y reglas del hijo.
- Puede convivir en cualquier nivel: País (líneas editables de Estados, 32 filas) y Estado
  (consulta de Municipios). No requiere SQL: usa las FK existentes.
- Aceptación: paginación/búsqueda/filtros del servidor, dominio fijo no manipulable,
  creación con padre preasignado y validado, sin cargar el árbol; prueba con miles de filas
  en esquema temporal.

### Fase B — One2many anidados editables (documentos acotados)

**Límites (fijos en código, validados al componer):**
- Profundidad máxima 3: documento → línea → sublínea. Sin ciclos ni un modelo en dos ramas.
- Por relación, `maxRows ≤ 100` (como hoy); por documento completo, **≤ 500 filas** y un
  tope de tamaño del payload. Cada relación sigue en el mismo módulo, con inversa
  `required`/no única/`Restrict` y un solo dueño.

**Servidor:**
- `owned()` devuelve documentos completos (con sus líneas) para hijos que declaran líneas;
  el árbol se carga en la misma transacción `RepeatableRead`, por niveles y en lotes (un
  `findMany` por relación y nivel, no una consulta por fila).
- `validateLines` recursivo: claves de cada nivel = metadata + sus One2many; identidad
  `{id, revision}` y pertenencia verificadas contra el árbol cargado; conteo total.
- Orden de escritura: altas/ediciones de arriba hacia abajo (el hijo existe antes que sus
  nietos), bajas de abajo hacia arriba (Restrict intacto, sin cascadas). `skipOwner` evita
  refrescos redundantes dentro del guardado; un solo `refresh` por ancestro.
- Errores con rutas completas (`estadoIds.3.municipioIds.12.name`); cualquier fallo de hook,
  constraint, dominio o permiso revierte todo el documento. Constraint agregada del padre
  tras releer el árbol canónico, como hoy.
- Una fila no legible en cualquier nivel rechaza abrir el documento (como hoy en un nivel):
  nunca se interpreta como baja.

**Cliente:**
- `ModelLineConfig` anida `lines`; `buildModelUI` construye esquemas Zod recursivos;
  `useModelField` resuelve rutas de cualquier profundidad.
- `FieldOne2many` presenta sublíneas **inline** con fila expandible (la tabla del nivel
  siguiente aparece bajo la fila, con su «Agregar línea» debajo), sin modales. Errores se
  revelan expandiendo la fila afectada. Dirty guard, locks y acciones comparten el RHF del
  documento.

**Aceptación:** fixture propio de tres niveles en esquema temporal: lectura, alta/edición/
baja en cada nivel y combinadas, límites por relación y por documento, permisos parciales y
reglas heredadas, dominios de fila, concurrencia desde padre/hijo/nieto, rollback de hooks y
constraints en cualquier nivel, historial por modelo, rutas de error en la UI; regresión del
One2many de un nivel, acciones y Kanban.

### Recomendación

1. Ahora, para desbloquear Ubicaciones: retirar `Estado.municipioIds` (variante de un nivel)
   e implementar la **fase A** para mostrar los municipios del Estado como consulta.
2. Fase B cuando aparezca un documento real con tres niveles acotados.
