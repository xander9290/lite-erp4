# Pantallas nombradas por modelo (`screens`)

Implementado el 2026-11-25 (primera versión). Diseño y criterios originales en
[ideas/pantallas-modelos.md](ideas/pantallas-modelos.md).

Una pantalla es configuración de navegación sobre **el mismo modelo**: etiqueta,
presentación inicial, dominio de servidor, valores propuestos al crear y vistas
(list/card/kanban/form/modal). Sirve para tener, por ejemplo, «Contactos» y
«Direcciones» sobre `Partner` sin duplicar el modelo ni sus reglas.

- Modelo: datos, validaciones, hooks, publicación de campos y permisos (sin cambios).
- Pantalla: `label`, `view`, `domain`, `defaults` y `views`.
- Menú: referencia `{ model, screen }`.

## Declaración

```ts
partner: {
  model: Partner,
  list: { fields: [/* política de lista común a todas las pantallas */] },
  defaultScreen: "contacts", // opcional: por defecto, la primera pantalla
  screens: {
    contacts: {
      label: "Contactos",
      view: "card",
      domain: d => d.eq("type", "contact"),
      defaults: { type: "contact" },
      views: {
        card: () => import("./views/PartnerCard"),
        list: true,
        form: () => import("./views/PartnerForm"),
        modal: () => import("./views/PartnerModal"),
      },
    },
    addresses: {
      label: "Direcciones",
      domain: d => d.in("type", ["delivery", "invoice"]),
      defaults: { type: "delivery" },
      views: { modal: () => import("./views/PartnerModal") },
    },
  },
},
// …
menu: {
  Contactos: { model: "partner", screen: "contacts" },
  Direcciones: { model: "partner", screen: "addresses" },
},
```

Reglas de compilación (`src/lib/modules/screens.ts`, errores al cargar el manifest):

- IDs en minúsculas y dígitos (`/^[a-z][a-z0-9]*$/`); `default` está reservado.
- Con `screens`, `view`, `views` y `domain` del modelo se rechazan: cada pantalla
  declara los suyos. `list`, `kanban`, `transfer`, `audit` y `defaultSort` siguen
  siendo del modelo y se comparten.
- `defaultScreen` debe existir; sin él, la primera pantalla declarada es la default.
- Cada pantalla valida sus vistas igual que antes (kanban requiere configuración
  kanban del modelo; `true` sólo para list/card/kanban).
- Un enlace de menú `{ model, screen }` debe apuntar a una pantalla declarada. El
  valor de menú es enlace si es una clave o exactamente `{ model, screen }`;
  cualquier otro objeto es un grupo (un nivel).

## Compatibilidad

Un modelo sin `screens` compila una pantalla implícita `default` con su `view`,
`views` y `domain` de siempre. Sus menús por string conservan los IDs estables
(`<clave>-list`), así que la visibilidad de menús por grupo no cambia. Los enlaces
a pantallas usan `<clave>-<pantalla>-list`.

`ModuleModel.views`/`view`/`collectionViews` y el `domain` del servicio son los de la
pantalla default: relaciones, modales de otros modelos, `childIds` y enlaces simples
siguen usándola.

## Navegación

- URL: `/erp/<módulo>/<modelo>?screen=<id>`. Sin `screen` se abre la default; un ID
  desconocido responde 404 (no se muestra en silencio otra pantalla). Los menús
  añaden `screen` con `menuLinkHref`; el menú activo distingue pantallas de la
  misma ruta por ese valor.
- `ModelRoute` resuelve la pantalla en servidor y publica `config.screen`
  (`id`, `label`, `isDefault`, `defaults`). Con pantallas explícitas, el título,
  breadcrumbs y metadata usan la etiqueta de la pantalla.
- El selector de presentación usa las vistas de la pantalla y conserva `screen`
  en la URL. Abrir, crear, «Nuevo», guardar, eliminar y volver conservan la
  pantalla (`screenHref`); el valor sólo se añade cuando no es la default.
- El formulario de página y el modal del propio modelo usan los layouts de la
  pantalla (fallback modal → form dentro de ella). Los modelos relacionados usan
  su pantalla default.

## Dominio y seguridad

El navegador sólo envía el ID de pantalla a `modelList`/`modelKanban`; el registro
valida el ID y aplica el dominio declarado en servidor, que **sustituye** al dominio
default para la colección principal (listas, cards, kanban, conteos, páginas y
grupos). Siempre se combina con AND con filtros, búsqueda, permisos y reglas de
registro: una pantalla puede estrechar, nunca ampliar lo legible. Las colecciones
de consulta (`childIds`) conservan su propia fuente por inversa.

El dominio **no** restringe lectura individual ni guardado: un registro fuera del
dominio sigue abriéndose por ID si el actor puede leerlo.

## Valores propuestos (`defaults`)

Literales validados al compilar contra campos editables del modelo: text (longitud),
boolean, integer (rango), selection (opción declarada), many2one (ID) o `null` en
opcionales. Se rechazan sensibles, de lectura, calculados, related, folios,
imágenes y fechas.

Precedencia al crear: default del Field < default de la pantalla < propuesta
explícita (`default_<campo>` en la URL o inversa de una colección en modal). En
modales no se aplican los defaults de la pantalla de la página. Sólo proponen
valores: el servidor valida el guardado con el esquema y reglas del modelo, y editar
carga lo guardado.

## Expulsar vistas por pantalla

```powershell
npm run eject:view -- directory partner form --screen=addresses
```

Con `screens`, `--screen` es obligatorio; genera `PartnerAddressesForm.tsx` y lo
registra en `screens.addresses.views`. Sin `screens`, `--screen` se rechaza.

## Límites de esta versión

- Importar/exportar sólo se ofrece en la pantalla default (la exportación lee la
  fuente default).
- La referencia `{ model, screen }` se valida en runtime al cargar el manifest; aún
  no hay autocompletado de tipos de los IDs de pantalla.
- Sin capa separada de acciones de navegación ni publicación de campos por pantalla
  (`list.fields` es del modelo).
- `create:views` y los demás generadores no crean pantallas.

## Pruebas

- `src/lib/modules/screens.test.ts` (en `test:modules`): compatibilidad, compilación,
  rechazos, defaults, menús/navegación, enlaces y eject.
- `src/lib/orm/screen-domain.test.ts` (en `test:orm`): sustitución del dominio,
  reglas de registro, kanban y filtros con repositorio simulado.
