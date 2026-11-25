# Importar y exportar desde ListView

Guía paso a paso para principiantes: `docs/importar-exportar.md`, publicada en
/documentation/importar-exportar. Este documento es la referencia técnica.

Función compartida de módulos declarativos (2026-11-20), opt-in por modelo en el
manifest. Admite escalares, fechas, Many2one, Many2many y una cadena One2many editable.
Habilitados: País, Estado, Municipio y Localidad de Ubicaciones. Sólo la ListView
estándar ofrece estas acciones; Card, Kanban, formularios y colecciones embebidas
no las muestran. Los endpoints revalidan acceso en servidor.

Desde 2026-11-21 también revalidan las [restricciones por campo](ideas/permisos-campos.md).
Un modelo tocado con campos sin lectura deniega la transferencia; para importar,
también se comprueba escritura de campos del dueño y líneas. No se generan archivos
parciales como alternativa a esas restricciones.

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
cliente y en la política de lista; se valida al registrar el modelo. Se admiten
Text, Integer, Boolean, Selection y DateTime persistentes, además de Many2one
mediante una clave externa explícita. Las colecciones se habilitan por separado
en `many2many`/`lines`: no necesitan una columna visible en la lista. Los campos
de cada línea deben pertenecer a su contrato público de captura; no se amplía su
política de búsqueda/lista. Sin sensibles, writeOnly, readOnly, secuencias, IDs,
revisiones, imágenes ni virtuales.
Los repositorios personalizados requieren un contrato posterior.

País sí declara Estados como One2many: no se transfiere ese campo. Al actualizar
se carga el documento autorizado completo y se conservan sus líneas; al crear
se usan los defaults. Sus límites/permisos siguen siendo los habituales.

## Configurar otro modelo

`create:model` conserva su generación habitual: **no activa transferencias** ni
inventa una clave de negocio. Después de personalizar y sincronizar los campos,
añadir `transfer` manualmente al modelo del manifest. No hacen falta acciones,
servicios, botones ni vistas nuevos. El framework valida el contrato al registrar
el módulo y ModelCollection conecta la ListView estándar. Configurar `transfer`
por sí solo no cambia el esquema ni concede permisos.

Ejemplo sobre modelos ya declarados (no crea una aplicación en el ERP):

```ts
pedido: {
  model: Pedido,
  transfer: {
    key: "codigo",
    fields: ["codigo", "fecha", "etiquetaIds", "lineaIds"],
    many2many: { etiquetaIds: { key: "codigo", mode: "add" } },
    lines: {
      lineaIds: {
        key: "codigo",
        mode: "merge",
        fields: ["codigo", "cantidad"],
      },
    },
  },
},
```

Pedido debe declarar `codigo` Text único y `lineaIds` One2many editable con una
inversa obligatoria, por ejemplo `pedidoId`. La línea declara `codigo` obligatorio
y `readonly uniqueTogether = [["pedidoId", "codigo"]] as const`, o una clave Text
global única. La inversa no se incluye en `key`/`fields` del contrato de líneas ni
se escribe en el archivo: el servicio la establece a partir del padre autorizado.
El destino de `etiquetaIds` debe tener su clave pública única y estar registrado
en el módulo o sus dependencias. No necesita habilitar su propio `transfer`.

## Fechas

Para un Field DateTime:

- `2026-11-20` significa `2026-11-20T00:00:00.000Z`.
- `2026-11-20T12:30:00-06:00` se normaliza a `2026-11-20T18:30:00.000Z`.
- Se admiten celdas nativas de fecha de Excel, interpretadas en UTC; se exporta
  texto ISO UTC para conservar el instante al volver a importar.
- Fecha/hora sin zona, fechas de calendario inválidas, formatos locales ambiguos,
  números seriales sin formato de fecha y fórmulas se rechazan. Vacío solicita null
  y el esquema del Field decide si es obligatorio.

No se añade un Field Date distinto de DateTime ni se infiere la zona del navegador.

## Many2many: claves externas y modo explícito

Cada campo se incluye en `fields` y en `many2many` con `key` y `mode` obligatorios.
La celda contiene un arreglo JSON, no IDs ni nombres de presentación:

- Clave Text única: `["ROJA","AZUL"]`.
- Clave compuesta: `[{"grupo":"general","codigo":"ROJA"}]`.
- Referencia anidada: `[{"paisId.codigo":"MX","codigo":"01"}]`, declarando
  `key: ["paisId", "codigo"]` y `relations.paisId.key: "codigo"`.

`mode: "add"` agrega vínculos y conserva los existentes; vacío o `[]` no quita
ninguno. `mode: "replace"` sustituye el conjunto completo; vacío o `[]` solicita
quitar todos. Una columna omitida conserva sus vínculos en ambos modos. La interfaz
muestra esta política antes de revisar/confirmar; no se infiere del contenido.

Se resuelve cada clave con la normalización y lectura/reglas del destino. No hay
creación implícita; se rechazan duplicados normalizados, claves inexistentes u
ocultas y conjuntos que excedan el maxSelected. Revisión y confirmación conservan
dominios, acceso a todos los vínculos existentes y permisos de escritura del dueño.
Las identidades/revisiones de los destinos se firman también: si cambian, se exige
revisar otra vez. Exportar usa las mismas claves, ordenadas de forma estable.

## One2many: una fila por línea, sin borrar omitidas

Se declara el campo en `fields` y en `lines`, con su propia `key`, `fields` y
`mode: "merge"`. El archivo usa encabezados con prefijo:

| codigo | fecha | etiquetaIds | lineaIds.codigo | lineaIds.cantidad |
| --- | --- | --- | --- | --- |
| P001 | 2026-11-20 | ["ROJA"] | 01 | 2 |
| P001 | 2026-11-20 | ["ROJA"] | 02 | 5 |

La clave del padre y sus demás valores deben repetirse iguales en todas sus filas.
Se agrupan antes de validar y la revisión muestra un resultado por documento,
identificado por su primera fila. Valores contradictorios del padre o claves
duplicadas normalizadas de una línea rechazan el plan completo.

Las líneas se identifican **dentro de su padre** con sus claves declaradas. Se
reutilizan ID/revisión sólo desde el snapshot autorizado del servidor, nunca desde
el archivo. Se agregan las nuevas y se actualizan las existentes; líneas, sublíneas
y campos omitidos se conservan. Celdas de línea completamente vacías no crean ni
eliminan líneas. No se admite reemplazo/borrado de líneas por importación.

Una tabla admite una cadena One2many por nivel, hasta documento → línea → sublínea
(tres niveles). Cada sublínea añade otro prefijo, por ejemplo
`lineaIds.entregas.codigo`. Varias colecciones independientes en el mismo nivel se
rechazan: necesitan un formato de varias tablas, pendiente. Relaciones readonly de
consulta no se transfieren como líneas. Los límites del documento siguen vigentes
(maxRows de cada relación y 500 filas totales); 200 filas físicas y 12 columnas
del archivo incluyen todos los niveles. Las referencias Many2one de las líneas se
declaran con `relations` dentro de su contrato.

Se carga el documento autorizado completo; acceso parcial a líneas impide revisar
o exportar. El servicio del padre ejecuta los servicios/validaciones/hooks de cada
nivel en la misma transacción y conserva permisos heredados, revisión, restricciones
e historial. Si cambian claves de líneas durante los hooks, se rechaza el plan.
Reordenar las filas del archivo no produce cambios por sí mismo: no hay orden
persistido de líneas.

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
resuelve con su propia referencia anidada (hasta tres saltos desde 2026-11-22):

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
  falle), sin nombres ni IDs. Desde 2026-11-21 las referencias declaradas usan
  lectura relacional autorizada desde el origen y reglas de cada destino, sin
  exigir entrada directa a su aplicación. No concede CRUD sobre el destino.
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

## Localidad: Municipio → Estado → País

Habilitada el 2026-11-22 reutilizando el servicio general, sin acciones ni vistas
nuevas. Localidad declara `uniqueTogether = [["municipioId", "codigo"]]`: un
código puede repetirse en municipios distintos. El manifest configura:

```ts
localidad: {
  model: Localidad,
  transfer: {
    key: ["municipioId", "codigo"],
    fields: ["municipioId", "codigo", "name", "active"],
    relations: {
      municipioId: {
        key: ["estadoId", "codigo"],
        relations: {
          estadoId: {
            key: ["paisId", "codigo"],
            relations: { paisId: { key: "codigo" } },
          },
        },
      },
    },
  },
},
```

La plantilla tiene seis columnas; el orden puede cambiar, conservando los nombres:

```csv
municipioId.estadoId.paisId.codigo,municipioId.estadoId.codigo,municipioId.codigo,codigo,name,active
MX,01,001,0001,Localidad de ejemplo,true
```

Las cuatro columnas de identidad son obligatorias. Los códigos son texto para
conservar ceros iniciales. País, Estado y Municipio deben existir y ser legibles
por la relación publicada; cada salto aplica su normalización y queda firmado
en el plan. No se crean referencias implícitas ni se admiten IDs. Un cuarto salto
se rechaza al declarar el contrato. Importar Localidad no exige escritura de
Municipio ni avanza su revisión: no es una línea editable de su documento.

Gestor y Administrador de Ubicaciones conceden import/export sobre Localidad por
defecto; los overrides vigentes de cada grupo/modelo siguen prevaleciendo.
Requiere la migración `20261122000000_localidad_municipality_code_unique`, que
sólo agrega el índice único Municipio+código. Consultar su aplicación y las
verificaciones actuales en [el estado del proyecto](estado-proyecto.md).
Se mantienen los límites de 200 filas de importación y 2.000 de exportación;
la carga inicial masiva de localidades no se implementa con esta habilitación.

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
con nombres técnicos exactos; una fila por registro, o por línea si habilita One2many:

| codigo | name | active |
| --- | --- | --- |
| MX | México | true |
| US | Estados Unidos | false |

- XLSX: una sola hoja con contenido. CSV: UTF-8, separador coma y comillas dobles
  para comas/saltos; BOM y CRLF admitidos. No se acepta XLS antiguo.
- Clave obligatoria, normalizada antes de buscar: País convierte `mx` a `MX`.
  Se rechazan duplicados tras normalizar, salvo la repetición del padre que agrupa líneas.
- Clave nueva: crear. Existente legible: actualizar. Mismos datos: sin cambios.
  Cambiar la clave en el archivo no renombra la del registro original.
- Columna omitida: conserva valor al actualizar; default u obligatorio al crear.
  Celda vacía en escalares: solicita vaciar el campo y pasa por su validación;
  en colecciones se aplica la política explícita descrita arriba.
- Texto/códigos como celdas de texto para conservar ceros iniciales. Booleanos:
  true/false o celdas booleanas de Excel. Selection usa su valor técnico.
- Encabezados desconocidos/duplicados se rechazan; no hay mapeo manual de nombres
  alternativos todavía. Fórmulas, enlaces, errores y objetos Excel se rechazan
  (excepto fechas nativas en campos DateTime),
  también textos que Excel interprete como fórmulas.
- Máximo 200 filas, 12 columnas, 512 KB de archivo y 8 MB descomprimidos para XLSX.
  En XLSX se ignoran filas/columnas vacías finales y hojas completamente vacías,
  aunque el editor las haya guardado con formato. El límite se comprueba sobre
  la última celda con contenido; se conservan huecos interiores y números de fila.
  Cero, false y fórmulas (incluso con resultado vacío) cuentan como contenido.
  Si el plan firmado resulta demasiado grande, se pide dividir el archivo.

## Revisar y confirmar

La revisión muestra altas, actualizaciones, sin cambios y errores por fila/campo,
con valores previstos. Con errores no se habilita confirmación parcial.
Cada documento agrupado pasa por el servicio completo en una transacción que **siempre se
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
Límite: 2.000 registros filtrados, también al exportar una selección, y 2.000 filas
físicas resultantes al expandir líneas. La selección se comprueba por padres;
seleccionar un documento exporta todas sus líneas autorizadas, aunque ocupe varias filas.

CSV neutraliza textos convertibles en fórmulas con un apóstrofo inicial; ese
escape permanece como texto si se reimporta. XLSX escribe valores, sin fórmulas.
Los archivos pueden usarse como base de una importación.

## Verificaciones y siguientes fases

`npm run test:list-transfer`: formatos, contratos y límites. Integración:
`npm run test:list-transfer:integration` crea un esquema exclusivo aleatorio,
aplica allí las migraciones, prueba servicios/permisos y lo elimina al terminar.
Nunca ejecutar manualmente sus workers contra un esquema real.

`npm run test:list-transfer:relations:integration` usa un módulo de ensayo propio
en proyecto/esquema desechables. Comprueba fechas, vínculos add/replace y claves
compuestas, documentos de tres niveles, conservación de omitidos, revisión sin
escrituras, rollback al confirmar, permisos parciales/revocados, límites, claves
alteradas por hooks, concurrencia y reimportación CSV/Excel sin cambios.

Pendiente: varias colecciones independientes por tabla, mapeo interactivo de
encabezados y grandes volúmenes con lotes, trabajos e idempotencia duradera.
La firma sigue siendo efímera por proceso: varias instancias requieren contrato
compartido. No se crean referencias automáticamente.
