# Importar y exportar

Esta guía explica, paso a paso y desde cero, cómo permitir que un modelo se
importe desde Excel/CSV y se exporte a un archivo. Empieza por el caso más
simple y termina con relaciones de tres saltos, etiquetas y documentos con
líneas y sublíneas.

Los ejemplos de **Ubicaciones** (País, Estado, Municipio y Localidad) ya están
activos en el ERP. Los de **Tienda** (clientes, pedidos, líneas y entregas) son
para practicar: no existen en el ERP, pero su configuración se comprobó con el
validador real del framework. Consultar esta página no crea archivos, tablas ni
registros. La referencia técnica completa está en
`docs/importar-exportar-listas.md`.

## La idea en un minuto

Una base de datos identifica cada registro con un ID interno, por ejemplo
`cmwux55c40002acvmvxrikpva`. Nadie quiere escribir eso en Excel. Por eso el
archivo **nunca usa IDs**: usa **claves de negocio**, que son datos que una
persona conoce, como el código de un país (`MX`) o el código de un estado (`14`).

- **Importar:** el servidor lee cada fila, busca el registro por su clave y
  decide: si no existe, lo **crea**; si existe, lo **actualiza**; si es igual,
  lo deja **sin cambios**.
- **Exportar:** genera un archivo con las mismas columnas, listo para editarlo
  y volver a importarlo.
- **Relaciones:** si un registro apunta a otro (un Estado pertenece a un País),
  la columna no guarda el ID del País sino **su clave**: `paisId.codigo = MX`.

Todo pasa por los servicios del modelo: validaciones, hooks, permisos y reglas
siguen aplicándose. Importar nunca es una puerta trasera.

## Dónde aparece en la pantalla

Sólo en la **vista de lista estándar** del modelo (no en tarjetas, kanban ni
formularios). Abre el menú **Acciones** (icono de engrane) de la lista:

- **Importar Excel/CSV:** descarga la plantilla, súbela llena, **revisa** el
  resultado y **confirma**.
- **Exportar Excel/CSV:** los registros seleccionados o todos los que coinciden con la
  búsqueda y los filtros, en CSV o XLSX.

Si no ves esas opciones, falta alguno de los pasos de la siguiente sección o tu
grupo no tiene el permiso.

## Los cuatro pasos para activarlo

### Paso 1: el modelo necesita una clave única

La clave es lo que identifica a un registro en el archivo. Hay dos opciones.

**Clave simple:** un campo Text obligatorio y único. País usa su código:

```ts
// src/modules/ubicaciones/models/pais.ts
codigo = Fields.Text({ label: "Código", required: true, unique: true, minLength: 2, maxLength: 2 });
```

**Clave compuesta:** cuando un código se repite en distintos «padres». El código
`01` existe en México y en otros países, así que un Estado se identifica por
**País + código**. Se declara con `uniqueTogether` en la clase:

```ts
// src/modules/ubicaciones/models/estado.ts
export class Estado extends Model {
  readonly uniqueTogether = [["paisId", "codigo"]] as const;
  paisId = Fields.Many2one("UbicacionesPais", { label: "País", required: true, onDelete: "Restrict" });
  codigo = Fields.Text({ label: "Clave", required: true, maxLength: 10 });
  name = Fields.Text({ label: "Nombre", required: true, maxLength: 120 });
  active = Fields.Boolean({ label: "Activo", default: true });
}
```

`uniqueTogether` crea un índice único en la base de datos, así que después de
añadirlo hay que sincronizar el módulo (`npm run orm:sync -- ubicaciones`) y
revisar la migración que propone. Si ya existen duplicados, la sincronización
lo avisa antes de aplicar nada.

### Paso 2: declarar `transfer` en el manifest

```ts
// src/modules/ubicaciones/manifest.ts
pais: {
  model: Pais,
  transfer: {
    key: "codigo",                       // la clave del paso 1
    fields: ["codigo", "name", "active"], // columnas del archivo
  },
},
```

- `key` es el campo (o la lista de campos) que identifica al registro.
- `fields` son las columnas del archivo. La clave debe estar incluida.
- No hacen falta vistas, botones ni acciones nuevas: la lista estándar los
  muestra sola.

### Paso 3: dar permiso a los grupos

Importar y exportar son permisos aparte del CRUD:

```ts
access: [
  { group: "gestor", models: ["pais", "estado"], perms: "crud", import: true, export: true },
  { group: "consulta", models: ["pais", "estado"], perms: "r", export: true },
],
```

- **Exportar** necesita `export` y lectura (`r`).
- **Importar** necesita `import`, lectura y además crear (`c`) para registros
  nuevos o escribir (`u`) para los existentes.
- El administrador siempre puede. Se puede ajustar por grupo en
  Ajustes → Accesos.

### Paso 4: probarlo

1. Abre la lista del modelo → Acciones → Importar Excel/CSV → descarga la
   plantilla.
2. Llénala:

```csv
codigo,name,active
MX,México,true
US,Estados Unidos,false
```

3. Súbela y pulsa **Revisar**. Verás, fila por fila, qué se crearía, qué se
   actualizaría y qué errores hay. Todavía no se guardó nada.
4. Si todo está bien, pulsa **Confirmar**. Se guarda todo junto; si algo falla,
   no se guarda nada.

## Relaciones Many2one: los «saltos»

Cuando un campo apunta a otro modelo (Many2one), hay que decirle al framework
**con qué clave** buscar el destino. Eso se declara en `relations`. Cada vez
que, para encontrar el destino, hay que pasar por otro modelo, se cuenta un
**salto**. El máximo es **tres**.

Regla de oro: **cada Many2one que forme parte de una clave necesita su propio
`relations`**. Así se va encadenando hasta llegar a una clave de texto simple.

```text
Localidad ──municipioId──▶ Municipio ──estadoId──▶ Estado ──paisId──▶ País
                1 salto              2 saltos            3 saltos
```

### Un salto: Estado → País

Estado apunta a País. País tiene clave simple (`codigo`), así que basta con:

```ts
estado: {
  model: Estado,
  transfer: {
    key: ["paisId", "codigo"],
    fields: ["paisId", "codigo", "name", "active"],
    relations: {
      paisId: { key: "codigo" },  // busca el País por su código
    },
  },
},
```

La columna `paisId` se convierte en `paisId.codigo`:

```csv
paisId.codigo,codigo,name,active
MX,01,Aguascalientes,true
MX,14,Jalisco,true
```

Léelo así: «el Estado `14` del País cuyo código es `MX`».

### Dos saltos: Municipio → Estado → País

Municipio apunta a Estado. Pero Estado **no tiene una clave simple**: se
identifica por País + código. Entonces la referencia a Estado usa esa clave
compuesta, y el `paisId` de esa clave necesita su propio `relations`:

```ts
municipio: {
  model: Municipio,  // uniqueTogether = [["estadoId", "codigo"]]
  transfer: {
    key: ["estadoId", "codigo"],
    fields: ["estadoId", "codigo", "name", "active"],
    relations: {
      estadoId: {
        key: ["paisId", "codigo"],                // cómo se identifica un Estado
        relations: { paisId: { key: "codigo" } },  // y cómo se identifica su País
      },
    },
  },
},
```

```csv
estadoId.paisId.codigo,estadoId.codigo,codigo,name,active
MX,14,039,Guadalajara,true
MX,14,120,Zapopan,true
```

Léelo de izquierda a derecha: «País `MX` → Estado `14` → Municipio `039`».

### Tres saltos: Localidad → Municipio → Estado → País

Es la misma idea, un nivel más:

```ts
localidad: {
  model: Localidad,  // uniqueTogether = [["municipioId", "codigo"]]
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

```csv
municipioId.estadoId.paisId.codigo,municipioId.estadoId.codigo,municipioId.codigo,codigo,name,active
MX,14,039,0001,Guadalajara,true
```

Un cuarto salto se rechaza al cargar el manifest.

### Cómo se forman los nombres de las columnas

El encabezado es el **camino** desde el campo hasta la clave de texto final,
separado por puntos:

- `paisId` + clave `codigo` → `paisId.codigo`
- `estadoId` + clave (`paisId` → `codigo`, `codigo`) → `estadoId.paisId.codigo`
  y `estadoId.codigo`

No tienes que calcularlos: **descarga la plantilla** y ya vienen escritos. El
orden de las columnas puede cambiar, pero los nombres deben ser exactos.

### Many2one que no forman parte de la clave

Un Many2one también puede ser una columna normal. En la Tienda de práctica, un
Cliente se identifica por su `codigo`, y además guarda su País, Estado y
Municipio:

```ts
relations: {
  paisId: { key: "codigo" },                                         // 1 salto
  estadoId: { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" } } }, // 2 saltos
  municipioId: {                                                      // 3 saltos
    key: ["estadoId", "codigo"],
    relations: { estadoId: { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" } } } },
  },
},
```

Columnas resultantes:

```text
paisId.codigo
estadoId.paisId.codigo, estadoId.codigo
municipioId.estadoId.paisId.codigo, municipioId.estadoId.codigo, municipioId.codigo
```

Reglas de estas columnas:

- Las columnas de una misma referencia van **juntas**: todas vacías dejan el
  campo vacío; llenar sólo algunas es un error.
- El destino **debe existir** y ser legible. Importar nunca crea Países,
  Estados ni Municipios.
- Si repites el mismo objeto de configuración en varias referencias, puedes
  guardarlo en una constante: `const estado = { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" } } } as const;`

## Many2many: varias etiquetas en una celda

Un Many2many (por ejemplo, etiquetas de un cliente) ocupa **una sola celda** con
una lista en formato JSON. Se declara en `fields` y en `many2many`, con un
**modo obligatorio**:

```ts
transfer: {
  key: "codigo",
  fields: ["codigo", "name", "etiquetaIds", "zonaIds"],
  many2many: {
    etiquetaIds: { key: "codigo", mode: "add" },
    zonaIds: { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" } }, mode: "replace" },
  },
},
```

Qué se escribe en la celda (tal cual en Excel):

```text
etiquetaIds:  ["VIP","MAYOREO"]
zonaIds:      [{"paisId.codigo":"MX","codigo":"14"},{"paisId.codigo":"MX","codigo":"01"}]
```

- Clave simple: una lista de textos.
- Clave compuesta: una lista de objetos con el nombre de cada parte de la clave.

Los modos:

- `add` **agrega** las etiquetas de la celda y **conserva** las que ya tenía.
  Celda vacía o `[]`: no quita nada.
- `replace` **sustituye** el conjunto completo. Celda vacía o `[]`: quita todas.
- En ambos modos, si la columna no está en el archivo, no se toca nada.

Las etiquetas deben existir: la importación no las crea.

En CSV las comillas dentro de una celda se duplican. No lo hagas a mano: edita
en Excel o descarga la exportación y úsala como modelo. Así se ve una fila en CSV:

```csv
codigo,name,etiquetaIds
C-001,Ferretería López,"[""VIP"",""MAYOREO""]"
```

## One2many: documentos con líneas y sublíneas

Un documento con líneas (un pedido con sus renglones) se escribe en **una fila
por línea**. Los datos del pedido se **repiten** en cada fila; el framework los
agrupa por la clave del pedido.

### Los modelos

```ts
export class Pedido extends Model {
  codigo = Fields.Text({ label: "Folio", required: true, unique: true, maxLength: 20 });
  fecha = Fields.DateTime({ label: "Fecha", required: true });
  clienteId = Fields.Many2one("TiendaCliente", { label: "Cliente", required: true });
  lineaIds = Fields.One2many("TiendaLinea", { inverse: "pedidoId", label: "Líneas" });
}

export class Linea extends Model {
  readonly uniqueTogether = [["pedidoId", "codigo"]] as const; // renglón único dentro del pedido
  pedidoId = Fields.Many2one("TiendaPedido", { label: "Pedido", required: true, onDelete: "Restrict" });
  codigo = Fields.Text({ label: "Renglón", required: true, maxLength: 10 });
  productoId = Fields.Many2one("TiendaProducto", { label: "Producto", required: true });
  cantidad = Fields.Integer({ label: "Cantidad", required: true, min: 1 });
  entregaIds = Fields.One2many("TiendaEntrega", { inverse: "lineaId", label: "Entregas" });
}

export class Entrega extends Model {
  readonly uniqueTogether = [["lineaId", "codigo"]] as const;
  lineaId = Fields.Many2one("TiendaLinea", { label: "Línea", required: true, onDelete: "Restrict" });
  codigo = Fields.Text({ label: "Entrega", required: true, maxLength: 10 });
  fecha = Fields.DateTime({ label: "Fecha" });
}
```

### El manifest

```ts
pedido: {
  model: Pedido,
  transfer: {
    key: "codigo",
    fields: ["codigo", "fecha", "clienteId", "lineaIds"],
    relations: { clienteId: { key: "codigo" } },
    lines: {
      lineaIds: {
        key: "codigo",         // único dentro de su pedido; pedidoId NO se escribe
        mode: "merge",
        fields: ["codigo", "productoId", "cantidad", "entregaIds"],
        relations: { productoId: { key: "codigo" } },
        lines: {
          entregaIds: { key: "codigo", mode: "merge", fields: ["codigo", "fecha"] },
        },
      },
    },
  },
},
```

Fíjate en tres cosas:

- La línea se identifica sólo por `codigo`: el pedido al que pertenece ya lo da
  la fila. Por eso `pedidoId` (la inversa) **no** va en `key` ni en `fields`.
- Las líneas pueden tener sus propias `relations` (aquí, el producto por código).
- `mode: "merge"` es el único modo: agrega líneas nuevas y actualiza las
  existentes, pero **nunca borra** las que no aparecen en el archivo.

### El archivo

```csv
codigo,fecha,clienteId.codigo,lineaIds.codigo,lineaIds.productoId.codigo,lineaIds.cantidad,lineaIds.entregaIds.codigo,lineaIds.entregaIds.fecha
P-001,2026-11-20,C-001,1,LAP-14,2,E1,2026-11-22
P-001,2026-11-20,C-001,1,LAP-14,2,E2,2026-11-25
P-001,2026-11-20,C-001,2,MOU-01,5,,
P-002,2026-11-21,C-002,1,MOU-01,1,,
```

- Filas 1 a 3: **un** pedido `P-001`. Sus datos (`fecha`, cliente) se repiten
  iguales; si no coinciden, la revisión lo rechaza.
- Filas 1 y 2: la línea `1` (dos laptops) con dos entregas, `E1` y `E2`.
- Fila 3: la línea `2` sin entregas (celdas de sublínea vacías).
- Fila 4: otro pedido.

Límites: una sola colección One2many por nivel y como máximo tres niveles
(documento → línea → sublínea).

## El ejemplo completo: Tienda

El Cliente de práctica junta todo: clave simple, escalares, Many2one de uno,
dos y tres saltos y dos Many2many.

```ts
cliente: {
  model: Cliente,
  transfer: {
    key: "codigo",
    fields: ["codigo", "name", "activo", "paisId", "estadoId", "municipioId", "etiquetaIds", "zonaIds"],
    relations: {
      paisId: { key: "codigo" },
      estadoId: { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" } } },
      municipioId: {
        key: ["estadoId", "codigo"],
        relations: { estadoId: { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" } } } },
      },
    },
    many2many: {
      etiquetaIds: { key: "codigo", mode: "add" },
      zonaIds: { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" } }, mode: "replace" },
    },
  },
},
```

La plantilla que genera tiene 11 columnas:

```text
codigo, name, activo, paisId.codigo,
estadoId.paisId.codigo, estadoId.codigo,
municipioId.estadoId.paisId.codigo, municipioId.estadoId.codigo, municipioId.codigo,
etiquetaIds, zonaIds
```

Una fila de ejemplo:

```text
codigo:                             C-001
name:                               Ferretería López
activo:                             true
paisId.codigo:                      MX
estadoId.paisId.codigo:             MX
estadoId.codigo:                    14
municipioId.estadoId.paisId.codigo: MX
municipioId.estadoId.codigo:        14
municipioId.codigo:                 039
etiquetaIds:                        ["VIP","MAYOREO"]
zonaIds:                            [{"paisId.codigo":"MX","codigo":"14"}]
```

Requisitos para que funcione: `tienda` declara `depends: ["ubicaciones"]` (porque
apunta a sus modelos), y Etiqueta, Producto y Cliente tienen `codigo` Text
obligatorio y único.

## Qué escribir en cada tipo de campo

- **Text:** el texto tal cual. Los códigos con ceros (`039`) deben ir como
  **texto** en Excel para no perder los ceros.
- **Integer:** un número entero (`5`).
- **Boolean:** `true` o `false` (o una casilla booleana de Excel).
- **Selection:** el **valor técnico**, no la etiqueta: `delivery`, no «Entrega».
- **DateTime:** `2026-11-20` (medianoche UTC) o con hora y zona,
  `2026-11-20T12:30:00-06:00`. Una hora sin zona se rechaza.
- **Celda vacía:** pide vaciar el campo (falla si es obligatorio).
- **Columna ausente:** al actualizar, el valor actual se conserva; al crear,
  se usa el default del campo.

No se aceptan fórmulas, IDs internos ni nombres en lugar de claves.

## Errores comunes al configurarlo

El framework revisa `transfer` al cargar el manifest. Estos son los mensajes
más frecuentes y qué hacer:

- **«Campo no habilitado para transferencia: paisId.»** Pusiste un Many2one en
  `fields` sin decir cómo buscarlo. Añade `relations: { paisId: { key: "codigo" } }`.
- **«define una clave única declarada…»** La `key` no es única. Usa un Text
  `unique: true` o declara `uniqueTogether` con exactamente esos campos.
- **«…requiere destino registrado, depends y clave Text única obligatoria
  pública.»** Buscas el destino por un campo que no es su clave (por ejemplo
  `name`), el destino usa clave compuesta y pusiste sólo `codigo`, o falta el
  `depends` del módulo dueño del destino.
- **«la clave compuesta debe coincidir con uniqueTogether del destino… y cada
  Many2one resuelto por su propia clave.»** Declaraste `key: ["paisId", "codigo"]`
  pero olvidaste `relations: { paisId: { key: "codigo" } }` dentro de esa referencia.
- **«Many2many … requiere clave externa y mode add o replace.»** Falta `mode`.
- **«referencia Many2one inválida…»** El campo de `relations` no está en `fields`,
  o hay más de tres saltos.
- **«máximo 12 columnas…»** Cuenta también las columnas de cada referencia y de
  las líneas. Quita campos o divide en dos modelos.

## Límites que conviene saber

- Importar: hasta **200 filas**, **12 columnas** y 512 KB por archivo.
- Exportar: hasta **2.000** registros (y 2.000 filas al expandir líneas).
- Para cargas grandes (por ejemplo, todas las localidades del país) se usa un
  script aparte, no la lista.
- El plan revisado vence a los 15 minutos; si alguien cambia los datos entre
  revisar y confirmar, se pide revisar otra vez.
- Con pantallas (`screens`), importar y exportar sólo aparecen en la pantalla
  por defecto.

## Lista de comprobación

1. El modelo tiene una clave: Text `unique: true` o `uniqueTogether`.
2. Si añadiste `unique`/`uniqueTogether`, sincronizaste con `orm:sync` y
   revisaste la migración.
3. `transfer` en el manifest con `key` y `fields`.
4. Cada Many2one de `fields` tiene `relations`, y cada Many2one dentro de una
   clave compuesta también.
5. Cada Many2many tiene `key` y `mode`.
6. Las líneas usan `lines` con `mode: "merge"` y sin la inversa.
7. Los grupos tienen `import`/`export` además del CRUD que necesitan.
8. Descargas la plantilla, revisas y sólo entonces confirmas.
