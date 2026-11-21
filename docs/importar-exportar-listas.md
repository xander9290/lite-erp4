# Importar y exportar desde ListView

Fases 1–3 implementadas el 2026-11-20. Pilotos habilitados: País, Estado y Municipio de Ubicaciones. Sólo la ListView
estándar ofrece estas acciones; Card, Kanban, formularios y colecciones embebidas
no las muestran. Los endpoints revalidan acceso en servidor.

## Habilitar un modelo

En su manifest:

```ts
models: {
  pais: {
    model: Pais,
    transfer: { key: "codigo", fields: ["codigo", "name", "active"] },
  },
},
```

Una clave simple debe ser Text y única; una compuesta debe coincidir con
`uniqueTogether` del modelo. Los campos deben estar publicados en el contrato
cliente y en la política de lista; se valida al registrar el modelo. Fase 1:
Text, Integer, Boolean y Selection persistentes; fase 2 añade Many2one mediante
una clave externa explícita. Sin sensibles, writeOnly, readOnly, secuencias, IDs,
revisiones, imágenes, virtuales ni vínculos Many2many o líneas One2many.
Los repositorios personalizados requieren un contrato posterior.

País sí declara Estados como One2many: no se transfiere ese campo. Al actualizar
se carga el documento autorizado completo y se conservan sus líneas; al crear
se usan los defaults. Sus límites/permisos siguen siendo los habituales.

## Estado: Many2one a País y clave compuesta

Estado declara en su clase:

```ts
readonly uniqueTogether = [["paisId", "codigo"]] as const;
```

Es una restricción de BD compartida por formularios, acciones e importaciones;
el generador emite `@@unique([paisId, codigo])`. Hasta cuatro grupos, de dos a
cuatro campos persistentes obligatorios Text/Integer/Selection/Many2one,
públicos, sin secretos, secuencias ni repeticiones. Se hereda; no se puede
declarar desde una extensión ni cruzar tablas compañeras. No entra en defaults,
Zod de captura ni formularios. Retirar una restricción instalada sigue rechazado
por el instalador, incluso con force.

En el manifest:

```ts
estado: {
  model: Estado,
  transfer: {
    key: ["paisId", "codigo"],
    fields: ["paisId", "codigo", "name", "active"],
    relations: { paisId: { key: "codigo" } },
  },
},
```

La plantilla resultante usa el código del país, nunca un ID interno:

| paisId.codigo | codigo | name | active |
| --- | --- | --- | --- |
| MX | 01 | Aguascalientes | true |
| MX | 02 | Baja California | true |

`paisId.codigo` se resuelve en servidor por `Pais.codigo`, aplicando la
normalización/esquema del destino y lectura/reglas vigentes. La referencia debe
apuntar a un modelo registrado del módulo o de sus dependencias, con clave Text
única obligatoria publicada y no sensible. Se comprueba tras componer módulos.
No exige exportar/editar el destino por el mero hecho de referenciarlo; sí lectura.
No crea países ni resuelve por nombres. Referencia inexistente o restringida:
error de fila sin publicar nombres/IDs. Encabezados con `paisId` crudo se rechazan.

País + código identifica el Estado: puede haber `01` en países distintos. Deben
estar presentes todas las columnas de la clave; no se permite trasladar un Estado
a otro País mediante la importación. Se aplican las conversiones propias del
modelo y de cada Field (p. ej. trim) antes de buscar/detectar duplicados. Códigos
geográficos siguen como texto, sin rellenar ceros automáticamente.

Estado es además una línea poseída por País mediante `estadoIds`: importar altas
o cambios exige escritura del País y avanza su revisión mediante el servicio
existente. No duplica esa lógica ni transforma los Municipios readonly en líneas.

La revisión firma también las identidades/revisiones de los destinos. Al confirmar
se resuelven otra vez TODAS las filas antes de escribir: si un país cambió, se
renombró/reasignó su código o perdió acceso, el plan se rechaza. Esto evita confundir
las revisiones del País avanzadas por las propias filas del mismo lote con cambios
externos. El resultado final y los dominios se comprueban dentro de la transacción.
Una referencia fuera de dominio puede exportarse si sigue siendo legible, pero
debe cumplir el dominio al importar/guardar. No se limpia automáticamente.

Exportar devuelve el mismo encabezado/código para reimportar. Si una referencia
no es legible, se rechaza la exportación, sin sustituirla silenciosamente por vacío.
Las referencias repetidas se resuelven una vez por ID dentro del snapshot readonly
de esa exportación; no hay caché entre actores, peticiones o escrituras.

Migración `20261120223000_estado_country_code_unique` aplicada con aprobación el
2026-11-20 en desarrollo Windows: sólo crea el índice único País+código. Preflight
sin duplicados ni otras migraciones pendientes. Verificados historial e índice
único válido; no se reescribieron registros. En otras máquinas, revisar/aprobar
SQL y comprobar historial/duplicados antes de aplicarla.

## Municipio: referencia con clave compuesta (fase 3)

Implementada el 2026-11-20 en el framework. Una referencia puede identificar su
destino con el grupo `uniqueTogether` del destino; cada Many2one de esa clave se
resuelve con su propia referencia anidada (dos saltos como máximo):

```ts
// models/municipio.ts
readonly uniqueTogether = [["estadoId", "codigo"]] as const;

// manifest.ts
municipio: {
  model: Municipio,
  transfer: {
    key: ["estadoId", "codigo"],
    fields: ["estadoId", "codigo", "name", "active"],
    relations: {
      estadoId: {
        key: ["paisId", "codigo"],                 // uniqueTogether de Estado
        relations: { paisId: { key: "codigo" } },  // País por código
      },
    },
  },
},
```

| estadoId.paisId.codigo | estadoId.codigo | codigo | name | active |
| --- | --- | --- | --- | --- |
| MX | 01 | 001 | Aguascalientes | true |

- Validación al componer: la clave compuesta debe coincidir exactamente con un
  grupo `uniqueTogether` del destino, con campos públicos (cliente y lista), sin
  secretos ni secuencias; cada Many2one de la clave declara su referencia y los
  escalares no. Cada salto exige destino registrado en el módulo que declara ese
  Many2one o en sus dependencias. Las claves simples conservan sus reglas. Máximo
  12 columnas contando las de cada referencia.
- Importar: de adentro hacia afuera (País por código → Estado por País+código →
  identidad del Municipio), con normalización/esquema, lectura y reglas de cada
  destino. Las columnas de una referencia van juntas: todas vacías la vacían,
  parcialmente vacías es error de celda. Referencia inexistente: error en
  `estadoId.paisId.codigo + estadoId.codigo` (o en la columna del salto que
  falle), sin nombres ni IDs. Sin lectura del modelo destino: error de acceso.
  Nunca crea Estados ni Países.
- Confirmar: la firma incluye identidad/revisión de cada salto; si un Estado o
  País cambió o se renombró su clave, el plan se rechaza.
- Exportar: recorre el camino inverso con caché por ID dentro de esa exportación;
  el dominio sólo se comprueba en el Many2one del dueño.
- `Estado.municipioIds` es de consulta: importar Municipios no exige escritura del
  Estado ni avanza su revisión (a diferencia de Estados dentro de País).

Volumen: con 200 filas por archivo y 2.000 por exportación, la carga inicial del
INEGI (~2.470 municipios) sigue por CLI; la ListView es para mantenimiento.

Verificado (2026-11-20, con `transfer` ya declarado en Municipio): `test:list-transfer`
(contratos válidos/inválidos, saltos) e integración temporal completa: revisar →
confirmar → repetir sin cambios, mismo código en dos Estados, exportar/reimportar
CSV y XLSX, Estado inexistente, encabezados de clave faltantes y Estado renombrado
antes de confirmar. Si la referencia forma parte de la clave (como `estadoId`), sus
columnas son encabezados obligatorios; el error «columnas juntas» aplica a
referencias fuera de la clave y aún no tiene caso de integración propio.

## Permisos por grupo y modelo

```ts
access: [
  { group: "operadores", models: "pais", perms: "cru", import: true, export: true },
  { group: "lectores", models: "pais", perms: "r", import: false, export: false },
],
```

Omitido/false no concede; otro grupo, incluido uno implicado, puede conceder.
Los ajustes de Accesos sustituyen los defaults por pareja grupo/modelo y las
concesiones efectivas se combinan con OR. El administrador conserva su bypass.

- Exportar necesita export + read y respeta reglas de lectura.
- Importar necesita import + read y create para altas o write para registros
  existentes, incluso al revisar filas sin cambios.
- La UI sólo ofrece Importar si existe además create o write. Cada fila vuelve
  a comprobar sus permisos reales. TSX no concede permisos.

Ajustes → Accesos → grupo incluye Importar y Exportar. La migración
`20261120210000_list_transfer_permissions` agrega sólo `can_import` y `can_export`,
Boolean NOT NULL DEFAULT false, a los overrides. Aplicada con aprobación del
usuario el 2026-11-20 en desarrollo Windows; historial y columnas verificados,
sin cambiar datos de negocio. No asumirla aplicada en otras máquinas. Aplicarla requiere
revisión/aprobación del SQL y del historial pendiente global. No ejecutar deploy
contra el ERP para probarla.

## Plantilla y archivo

Acciones → Importar Excel/CSV permite descargar una plantilla vacía. Primera fila
con nombres técnicos exactos; una fila por registro:

| codigo | name | active |
| --- | --- | --- |
| MX | México | true |
| US | Estados Unidos | false |

- XLSX: una sola hoja con contenido. CSV: UTF-8, separador coma y comillas dobles
  para comas/saltos; BOM y CRLF admitidos. No se acepta XLS antiguo.
- Clave obligatoria, normalizada antes de buscar: País convierte `mx` a `MX`.
  Duplicados tras normalizar marcan ambas filas como error.
- Clave nueva: crear. Existente legible: actualizar. Mismos datos: sin cambios.
  Cambiar la clave en el archivo no renombra la del registro original.
- Columna omitida: conserva valor al actualizar; default u obligatorio al crear.
  Celda vacía: solicita vaciar el campo y pasa por su validación.
- Texto/códigos como celdas de texto para conservar ceros iniciales. Booleanos:
  true/false o celdas booleanas de Excel. Selection usa su valor técnico.
- Encabezados desconocidos/duplicados se rechazan; no hay mapeo manual de nombres
  alternativos todavía. Fórmulas, enlaces, errores y objetos Excel se rechazan,
  también textos que Excel interprete como fórmulas.
- Máximo 200 filas, 12 columnas, 512 KB de archivo y 8 MB descomprimidos para XLSX.
  Si el plan firmado resulta demasiado grande, se pide dividir el archivo.

## Revisar y confirmar

La revisión muestra altas, actualizaciones, sin cambios y errores por fila/campo,
con valores previstos. Con errores no se habilita confirmación parcial.
Cada fila pasa por el servicio completo en una transacción que **siempre se
revierte**, incluso cuando valida: normalize, Zod, hooks, constraints, relaciones
e historial se prueban sin confirmar datos. Puede adquirir locks temporales;
no es una consulta SQL readonly. Rige el contrato de hooks sin efectos externos
no transaccionales.

Después de validar las filas individualmente, se simula además el lote completo
con el mismo flujo de confirmación y rollback obligatorio. Así se detectan límites
y reglas acumuladas entre filas antes de habilitar Confirmar. Si falla el lote,
se marca la fila correspondiente y no se emite un plan confirmable. Los hooks
pueden ejecutarse durante ambas simulaciones, siempre sin confirmar cambios.
No se ocultan errores ni se aumenta automáticamente ningún límite del modelo.

Decisión del usuario (2026-11-20): País.estadoIds conserva líneas editables; aumentó
maxRows de 50 a 100 y confirmó que la importación funcionó. No se convierte en consulta paginada. El máximo es el total de Estados
por País, no el tamaño del archivo/lote. Separar archivos no permite superarlo.
El error por límite se distingue del de lectura parcial sin revelar conteos
de filas restringidas.

El plan está firmado, ligado a actor/versión de sesión/modelo/contrato y al hash
del documento completo revisado. Vence a los 15 minutos o al reiniciar el proceso.
La firma usa una clave efímera del proceso; varios workers/instancias requieren
diseñar firma o almacenamiento compartidos antes de habilitar ese despliegue.
No se guardan archivos/planes en disco o BD ni se añaden credenciales privadas.

Confirmar abre una transacción Serializable para el lote completo, sin reintentos
automáticos. Revalida permisos, claves y documentos (incluidas líneas), ejecuta
de nuevo el servicio y comprueba que el resultado aprobado no cambió. Un fallo
tardío revierte lote e historial. Las filas sin cambios no se guardan ni avanzan
revisión. Un plan aplicado con cambios no puede aplicarse otra vez porque ya
no coincide su snapshot. La UI consume la confirmación antes del envío y recarga
tras el intento; ante red/commit desconocido exige nueva revisión y no afirma
rollback.

## Exportar

Elegir seleccionados de la página o todos los que coinciden con búsqueda/filtros.
Consulta paginada en un snapshot RepeatableRead readonly; reutiliza compilador de
lista, dominio fijo, orden y reglas de lectura. La agrupación es presentación:
se exportan registros, no encabezados de grupo. Sólo salen `transfer.fields`,
con encabezados técnicos, sin IDs/revisiones/auditoría/proyecciones privadas.
La selección se intersecta con filtros/permisos y se rechaza si falta un ID.
Límite: 2.000 registros filtrados, también al exportar una selección.

CSV neutraliza textos convertibles en fórmulas con un apóstrofo inicial; ese
escape permanece como texto si se reimporta. XLSX escribe valores, sin fórmulas.
Los archivos pueden usarse como base de una importación.

## Verificaciones y siguientes fases

`npm run test:list-transfer`: formatos, contratos y límites. Integración:
`npm run test:list-transfer:integration` crea un esquema exclusivo aleatorio,
aplica allí las migraciones, prueba servicios/permisos y lo elimina al terminar.
Nunca ejecutar manualmente sus workers contra un esquema real.

Pendiente: Many2many/One2many;
mapeo interactivo de encabezados, Date/DateTime y grandes volúmenes con lotes,
trabajos e idempotencia duradera. No se crean referencias automáticamente.
