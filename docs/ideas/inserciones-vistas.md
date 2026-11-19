# Inserciones en vistas extendidas (diseño, 2026-11-19)

Estado: **implementado el 2026-11-19** con las tres decisiones propuestas aceptadas por el usuario
(contrato vigente: [inserciones-vistas.md](../inserciones-vistas.md)). Cambios respecto al diseño:
sin `form:root` (su papel lo cumple el fallback en `<ModelExtensions />`) y las páginas insertadas
no publican `page:` propios. Alcance acordado en
[estado del proyecto](../estado-proyecto.md#pendiente-prioritario-inserciones-en-vistas-extendidas-2026-11-19).

## Problema

Hoy una extensión (`extends["core.partner"]`) sólo puede aportar un bloque entero:
`views.form` se pinta donde el formulario base coloca `<ModelExtensions />` (o el grupo
automático por módulo). No puede poner `municipioId` junto a `email`, ni una página
en el notebook del base, sin editar el formulario base.

## Idea central: anclas que ya existen en el árbol

React no permite mover componentes ya escritos ni buscar con XPath. En lugar de mover
nodos, **cada elemento direccionable del formulario se vuelve un ancla** que, al
pintarse, pregunta al registro de inserciones qué va antes, dentro, después o en su
lugar, y lo pinta **en su propia posición del árbol React**. Así el contenido insertado
hereda los contextos correctos de ese lugar (FormProvider/RHF, página de Notebook para
revelar errores, FieldVisibility, dirección del Stack, modo lectura/locks).

```
ModelForm ─ FormView (RHF) ─ InsertionProvider(registro)
   ├─ <PartnerInsertions/>      ← se monta oculto: cada <Inserter> registra sus hijos, no pinta
   └─ formulario base
        FormGroup id="contacto"   ← ancla group:contacto
          FieldText name="email"  ← ancla field:email  → [before][self|replace][after]
```

Se descartan los portales: el contenido conservaría el contexto del lugar donde se
declaró y no el del destino (los errores no revelarían la página correcta del Notebook).

## Destinos

| Destino | Quién lo publica | Posiciones |
|---|---|---|
| `field:<nombre>` | Automático en cada Field* (vía `useModelField`/envoltura común) | before, after, replace |
| `group:<id>` | `FormGroup` con prop `id` | before, after, inside, replace |
| `stack:<id>` | `Stack` con prop `id` | before, after, inside, replace |
| `notebook:<id>` | `Notebook` con prop `id` | before, after, inside (sólo NotebookPage) |
| `page:<notebook>/<name>` | `NotebookPage` (su `name`) | before, after (páginas hermanas), inside, replace |

- Sólo son direccionables los contenedores con `id` explícito: el autor del formulario
  base decide qué es estable. ModelFields (formulario por defecto) publica `group:general`.
- `inside` añade al final del contenedor; no hay `inside:start` en la primera versión.
- Notebook hoy rechaza hijos que no sean NotebookPage: será su propia ancla y mezclará
  las páginas insertadas antes de validar sus hijos.
- Ids de ancla únicos en el formulario pintado; un duplicado es error.

## Declaración

Manifest (sólo en entradas `extends`; nunca junto con `views.form` de la misma entrada):

```ts
extends: {
  "core.partner": {
    model: PartnerExtra,
    insertions: { form: () => import("./views/PartnerInsertions") },
  },
},
```

Archivo de inserciones (componente cliente, sólo presentación):

```tsx
"use client";
export default function PartnerInsertions() {
  return <>
    <Inserter target="field:email" position="after">
      <FieldText name="vat" />
    </Inserter>
    <Inserter target="group:contacto" position="after">
      <FormGroup id="direccion" legend="Dirección">
        <FieldText name="street" />
        <Stack><FieldMany2One name="paisId" /><FieldMany2One name="estadoId" /></Stack>
      </FormGroup>
    </Inserter>
  </>;
}
```

- `define.ts`: `insertions` admite sólo `form` con loader diferido; error si convive con
  `views.form`. `ModelRoute` lo carga igual que hoy `views.form` y lo pasa como slot.
- Un `<Inserter>` por destino+posición dentro del archivo (dos iguales = error); puede
  tener varios hijos.
- `Inserter` no pinta nada en su lugar: registra `{módulo, destino, posición, hijos}` en
  un efecto de layout (antes del pintado, sin parpadeo) y las anclas se suscriben al
  registro (`useSyncExternalStore`).

## Varios módulos sobre el mismo destino

- **Orden determinista:** módulos en orden de dependencias (quien depende de otro va
  después), desempate por id de módulo. `before`: el último en el orden queda más
  cerca del destino; `after`/`inside`: se agregan en ese orden.
- **`replace` único:** dos módulos que reemplazan el mismo destino son conflicto, salvo
  que uno dependa del otro (gana el dependiente, como en una herencia explícita).
- `inside` sobre un contenedor reemplazado es conflicto (el contenedor ya no existe).
- `before`/`after` de otros módulos se conservan alrededor del reemplazo.
- Contenido insertado puede publicar anclas nuevas (p. ej. `group:direccion`) que sólo
  pueden usar módulos que dependan del que las publica. Un ancla no aplica inserciones
  dentro de su propio contenido insertado al mismo destino (sin recursión).

## Errores claros

- **Al definir el módulo (servidor):** forma de `insertions`, exclusión con `views.form`.
- **Al montar el formulario (cliente):** tras el primer pintado se comparan destinos
  registrados contra anclas montadas, y se validan duplicados y conflictos.
  - Desarrollo: error visible en el formulario (aviso con módulo, destino y posición).
  - Producción: no se pierde la captura; el contenido de un destino ausente se pinta en
    el sitio de `<ModelExtensions />` dentro del grupo del módulo, con `console.error`.
- Un destino condicional que no se montó cuenta como ausente; por eso los formularios
  base deberían ocultar con `invisible`/FieldVisibility (siguen montados) en vez de
  `{cond && …}` cuando quieran ser extensibles.

## Lo que no cambia

- Un solo FormView/RHF/Zod, guardado, revisión, locks, dirty guard y Server Actions.
- Servidor: permisos, reglas, constraints y validación iguales; `replace` sólo cambia
  presentación. Un campo obligatorio reemplazado sin volver a pintarlo seguirá
  fallando al guardar (aviso por toast como cualquier error sin campo visible).
- Vistas existentes: `views.form` de extensiones y `<ModelExtensions />` siguen
  funcionando. Un módulo con `insertions` no genera su grupo automático; los módulos
  sin ellas, sí. No se migra nada automáticamente.
- Eject: los Field* ya publican `field:<nombre>`; el formulario expulsado sólo debería
  añadir `id` a sus grupos.

## Plan de implementación (cuando se autorice)

1. Registro/contexto de inserciones y componente `Inserter`; ancla genérica.
2. Anclas en Field* (envoltura común), FormGroup, Stack, Notebook/NotebookPage y
   `group:general` en ModelFields.
3. `define.ts` + `ModelRoute` + `ModelExtensions` (supresión del grupo automático y
   fallback de destinos ausentes).
4. Pruebas unitarias del registro (orden, duplicados, replace, inside sobre
   reemplazado, destino ausente) y de render (contexto RHF y revelado en Notebook).
5. Demo ficticia en `/sample` con dos módulos simulados sobre el mismo formulario.
6. Documentación del contrato y, después, el usuario migra `PartnerExtraForm` a
   inserciones a su ritmo.

## Decisiones abiertas para el usuario

1. ¿Destino ausente en producción cae al grupo del módulo (propuesto) o rompe el formulario?
2. ¿`replace` entre módulos dependientes gana el dependiente (propuesto) o siempre error?
3. ¿Sólo formulario en esta versión (propuesto), o también lista/kanban más adelante?
