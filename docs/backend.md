# Backend

Esta guía reúne lo que se declara y se ejecuta en el servidor: el manifest del
módulo, las pantallas de cada modelo y los dominios que deciden qué registros se
consultan. Las vistas TSX sólo presentan; nada de lo que aparece aquí viaja como
código al navegador.

Los ejemplos usan la aplicación **Directorio** (`src/modules/directory`), con el
modelo `Partner`. Consultar esta página no crea archivos, tablas ni registros.

## Qué corre en el servidor

- **Modelo** (`models/*.ts`): Campos, validaciones, hooks, acciones y constraints.
- **Manifest** (`manifest.ts`): Modelos, pantallas, menús, grupos, permisos y reglas.
- **Servicio** (generado por el framework): Lee, guarda y lista dentro de transacciones autorizadas.
- **Dominio** (pantalla, regla o relación): Qué registros entran en una consulta.

El navegador nunca envía un dominio, un actor ni un `where`. Como mucho envía el
**ID** de algo declarado (una pantalla, una acción) y el servidor lo busca en el
registro de módulos.

## Pantallas: varias vistas del mismo modelo

Una pantalla (`screen`) es una forma de navegar un modelo. Cada una tiene su
etiqueta, presentación inicial, dominio, valores propuestos y vistas, pero todas
comparten el mismo modelo, sus validaciones y sus permisos. Así no hace falta
duplicar `Partner` para tener «Contactos» y «Direcciones».

- `label`: Título, breadcrumbs y pestaña del navegador.
- `view`: Presentación inicial: `list` (por defecto), `card` o `kanban`.
- `domain`: Registros de la lista, tarjetas y kanban de esa pantalla.
- `defaults`: Valores propuestos al crear desde esa pantalla.
- `views`: `list`, `card`, `kanban`, `form` y `modal` propios.

`list` (columnas publicadas), `kanban`, `transfer`, `audit` y `defaultSort`
siguen siendo opciones del **modelo** y valen para todas sus pantallas.

### Declarar pantallas

```ts
// src/modules/directory/manifest.ts
partner: {
  model: Partner,
  list: {
    fields: ["image", "name", "phones", "street", "streetNumber", "vat", "provinceId", "countyId"],
  },
  defaultScreen: "contacts",
  screens: {
    contacts: {
      label: "Contactos",
      view: "card",
      domain: (d) => d.eq("type", "contact"),
      defaults: { type: "contact" },
      views: {
        form: () => import("./views/PartnerForm"),
        card: () => import("./views/PartnerCard"),
        list: true,
        modal: () => import("./views/PartnerModal"),
      },
    },
    addresses: {
      label: "Direcciones",
      view: "list",
      domain: (d) => d.in("type", ["delivery", "invoice"]),
      defaults: { type: "delivery" },
      views: {
        list: true,
        form: () => import("./views/PartnerForm"),
        modal: () => import("./views/PartnerModal"),
      },
    },
  },
},
```

Reglas que comprueba el framework al cargar el manifest:

- Los IDs de pantalla van en minúsculas y dígitos; `default` está reservado.
- Con `screens`, el modelo ya no declara `view`, `views` ni `domain` propios: cada
  pantalla lleva los suyos.
- `defaultScreen` es opcional; sin él, la primera pantalla es la de por defecto.
- Un modelo sin `screens` sigue funcionando como antes: tiene una pantalla
  implícita `default` con su `view`, `views` y `domain`.

### Enlazarlas en el menú

```ts
menu: {
  Contactos: {
    Directorio: { model: "partner", screen: "contacts" },
    Direcciones: { model: "partner", screen: "addresses" },
  },
  Configuración: {
    Etiquetas: "partnertags",
    "Actividad empresarial": "businessactivity",
  },
},
```

Un enlace es una clave de modelo (`"partner"`, abre la pantalla por defecto) o
exactamente `{ model, screen }`. La pantalla viaja en la URL como
`/erp/directory/partner?screen=addresses`; un ID inexistente responde 404.

Los menús se identifican por un ID estable que usa Ajustes → Grupos → Menús:
`partner-list` para el enlace simple y `partner-addresses-list` para una
pantalla. Cambiar uno por otro cambia el ID, así que revisa la visibilidad por
grupo si ya la habías configurado.

### Qué conserva la pantalla

Al cambiar entre lista y tarjetas, abrir, crear, guardar, eliminar y volver, la
URL conserva `?screen=`. El formulario y el modal del modelo usan los de la
pantalla (si no hay modal, se usa su form). Las relaciones y los modales que se
abren desde **otros** modelos usan la pantalla por defecto del destino.

## Dominios

Un dominio es una condición declarada con el constructor `d`. El servidor la
valida contra los campos del modelo y la convierte en el `where` de la consulta.

- `eq`, `neq`: `d.eq("type", "contact")`
- `in`, `notIn`: `d.in("type", ["delivery", "invoice"])`
- `gt`, `gte`, `lt`, `lte`: `d.gte("createdAt", "2026-01-01T00:00:00.000Z")`
- `contains`, `startsWith`, `endsWith`: `d.startsWith("name", "RG")`
- `all`, `any`, `not`: `d.all(d.eq("active", true), d.not(d.eq("vat", null)))`

Admite campos declarados no sensibles y persistentes (no `compute` ni `related`),
además de `id`, `createBy`, `createdAt` y `updatedAt`. Los valores se comprueban
según el tipo: opciones válidas en Selection, enteros en Integer, fechas ISO en
DateTime e IDs en Many2one. Comparar con `null` sólo vale con `eq`/`neq` en
campos opcionales.

### Combinar condiciones

```ts
companies: {
  label: "Empresas",
  domain: (d) => d.all(
    d.eq("type", "contact"),
    d.eq("partnerType", "company"),
  ),
  defaults: { type: "contact", partnerType: "company" },
},
```

`all` exige todas las condiciones, `any` al menos una y `not` invierte una.

### Usar el usuario de la sesión

El dominio de una pantalla recibe un segundo argumento con el contexto del
servidor: `actor` (usuario autenticado y revalidado) y `tx` (la transacción de
la consulta). El ID sale de la sesión, nunca del navegador.

```ts
mine: {
  label: "Mis clientes",
  domain: (d, { actor }) => d.eq("saleUserId", actor.id),
},
created: {
  label: "Creados por mí",
  domain: (d, { actor }) => d.eq("createBy", actor.id),
},
mineOrCreated: {
  label: "Mis contactos",
  domain: (d, { actor }) => d.all(
    d.eq("type", "contact"),
    d.any(d.eq("saleUserId", actor.id), d.eq("createBy", actor.id)),
  ),
},
```

El dominio debe devolver la condición directamente (función síncrona). No
consultes la base de datos dentro de él.

### Dónde se aplica y dónde no

- **Sí:** lista, tarjetas, kanban, conteos, paginación y agrupación de la
  pantalla. Se combina con AND con filtros, búsqueda, permisos y reglas de
  registro.
- **No:** abrir un registro por su ID, guardarlo o ejecutar acciones. Tampoco
  afecta a las colecciones de otro formulario, como «Otras direcciones»
  (`childIds`), que se filtran por su relación inversa.

Una pantalla puede mostrar **menos** registros, nunca más de los que el usuario
tiene permitido leer.

## Dominio de pantalla frente a regla de registro

Si un usuario **no debe poder ver** ciertos registros, eso no es una pantalla:
es una regla de registro (`rules`) del manifest. Las reglas se aplican en todas
las operaciones (listas, lectura por ID, guardado, relaciones).

```ts
groups: {
  vendedor: "Vendedor",
  gerente: { label: "Gerente", implies: ["vendedor"] },
},
access: [
  { group: "vendedor", models: "partner", perms: "cru" },
  { group: "gerente", models: "partner", perms: "crud" },
],
rules: [
  {
    id: "partner-propios",
    label: "Sólo mis clientes",
    models: "partner",
    groups: ["vendedor"],
    domain: ({ actor }) => [{ field: "saleUserId", operator: "eq", value: actor.id }],
  },
  { id: "partner-todos", label: "Todos los clientes", models: "partner", groups: ["gerente"], domain: [] },
],
```

- Organizar la navegación (Contactos, Direcciones, Mis clientes): `screens.<id>.domain`.
- Impedir que alguien lea o edite registros: `rules` con `groups`.

Ambas se pueden combinar: la regla limita lo permitido y la pantalla filtra
dentro de eso.

## Valores propuestos al crear

`defaults` propone valores al abrir «Nuevo» desde una pantalla. Son literales
que se validan al cargar el manifest:

- Text (respetando su longitud máxima), Boolean, Integer (dentro de su rango),
  Selection (una opción declarada) y Many2one (un ID).
- `null` sólo en campos opcionales.
- No se admiten campos sensibles, de lectura, calculados, related, folios,
  imágenes ni fechas.

Prioridad: default del campo → default de la pantalla → propuesta explícita
(`default_<campo>` en la URL o el padre que propone una colección en modal).
Los defaults de la pantalla no se aplican en modales.

Sólo proponen: el usuario puede cambiarlos y el servidor valida el guardado con
las reglas del modelo. Si un valor es obligatorio para la pantalla, valídalo en
el modelo (`beforeSave` o `@constraint`), no en `defaults`.

## Expulsar una vista para una pantalla

Para dar a «Direcciones» un formulario propio:

```powershell
npm run eject:view -- directory partner form --screen=addresses
```

Crea `src/modules/directory/views/PartnerAddressesForm.tsx` y lo registra en
`screens.addresses.views.form`. Con `--dry-run` sólo muestra el plan. En
modelos con `screens`, `--screen` es obligatorio; en modelos sin pantallas se
rechaza.

## Ocultar pestañas por grupo

Las pestañas (`NotebookPage`) de un formulario se pueden ocultar a un grupo, por
pantalla y por presentación (formulario de página o modal). El servidor no lee el
TSX de las vistas, así que el modelo declara cuáles son ocultables, con el mismo
`id` del `<Notebook>` y el mismo `name` de cada `<NotebookPage>`:

```ts
partner: {
  model: Partner,
  screens: { /* ... */ },
  pages: {
    additionalInfo: {
      otherAddresses: "Otras direcciones",
      sales: "Ventas",
      purchase: "Compras",
      otherInfo: "Otra información",
    },
  },
},
```

```tsx
<Notebook id="additionalInfo">
  <NotebookPage name="sales" label="Ventas">...</NotebookPage>
</Notebook>
```

Después, en Ajustes → Grupos → (grupo) → Páginas, marca «Ocultar» en cada pantalla
y presentación. Reglas:

- Es sólo presentación: la página sigue montada y sus valores se guardan igual.
  Para impedir leer o editar datos usa Campos (No leer / No escribir).
- Se suma por grupos implicados; un grupo sólo configura modelos de su módulo y
  los administradores siempre ven todo.
- Si la pestaña por defecto queda oculta se abre la primera visible; si todas
  quedan ocultas, no se pinta el Notebook.
- Una extensión puede añadir páginas al catálogo del modelo que extiende con
  `extends: { "x.modelo": { model, pages: { ... } } }`.
- Sólo las páginas declaradas aparecen en Grupos. En desarrollo la consola avisa
  si el catálogo y la vista no coinciden.

## Límites actuales

- Importar y exportar sólo aparecen en la pantalla por defecto. Cómo activarlos
  está en la guía [Importar y exportar](/documentation/importar-exportar).
- La referencia `{ model, screen }` se valida al cargar el manifest; todavía no
  hay autocompletado de los IDs de pantalla.
- Las columnas publicadas (`list.fields`) son del modelo, no de cada pantalla.

La referencia técnica completa está en `docs/pantallas-modelos.md` y la de
dominios en `docs/dominios-modelos.md`.
