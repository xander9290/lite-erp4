<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Preferencias de diseño de formularios

- Mantener desactivado el autocompletado del navegador en todos los Fields, controles auxiliares y FormLayout con `autoComplete="off"`, incluso al crear variantes nuevas. No confundirlo con las búsquedas propias de FieldMany2One y FieldRelationTag, que deben conservarse. Los gestores de contraseñas pueden ignorar esta indicación; no prometer un bloqueo absoluto ni usar campos ocultos o readonly temporal para forzarlo.
- En todos los Fields con `direction="inline"`, el label va a la izquierda, con su texto alineado a la izquierda y centrado verticalmente respecto al control (`items-center`).
- La solicitud anterior de alinear el label por la parte inferior se revirtió: el usuario se había confundido por el efecto visual de la línea negra inferior del input. Esa línea no debe usarse como referencia para alinear el label.
- Cada nuevo Field o variante debe incluir un ejemplo funcional en la ruta `/sample`, integrado con React Hook Form y validación Zod. Los componentes reutilizables permanecen en `src/components/ui/form`; los ejemplos y sus esquemas se mantienen en `src/app/sample`.
- `FormLogin` y su esquema se reservan para usuario y contraseña; no usarlos como área de pruebas de Fields.
- Las alertas globales usan `AlertProvider` / `useAlerts` en `ui/alerts`. En nuevas vistas de registros, usar `FormViewLoader` para «Cargando…», errores y reintentos. FormView muestra «Error de validación» para rechazos del servidor (`kind: "validation"` / `fieldErrors`); conservar los toasts para validaciones locales. Contratos y ejemplos en `src/components/ui/alerts/README.md` y `/sample#alerts`.
- FormView protege cambios pendientes con RHF `isDirty` y FormNavigationProvider en el layout raíz. Para acciones como cerrar sesión o cerrar un modal de edición, ejecutar el efecto dentro de `useFormNavigation().run(...)` para confirmar antes. No limpiar el bloqueo si el guardado falla. Los Links con opciones `replace`/`scroll` o callbacks propios deben usar `NavigationGuardLink` de `nextjs-nav-guard`. Contrato en `src/components/ui/form/FormView.md`.
- `FieldOne2many` edita líneas directamente en la tabla; el usuario no quiere un modal para editarlas. Reutilizar los Fields existentes en sus columnas. Ejemplo y documentación en `/sample#field-one2many` y `src/components/ui/form/FieldOne2many.md`. La demo no persiste pedidos/líneas; los modelos actuales no contienen esas entidades.

## Modelo de contactos

- Partner es la entidad base compartida para empresas, usuarios, clientes y proveedores. Los datos de contacto y `avatarUrl` pertenecen a Partner; User aporta acceso, credenciales y permisos mediante su relación `partnerId`. Reutilizar ese contacto en aplicaciones futuras en lugar de duplicar sus datos. Esto define la dirección del ERP; no implica que los módulos de empresas/clientes/proveedores ya existan.

## Ideas pendientes

- Las pestañas de formularios están implementadas como `Notebook` y `NotebookPage` en `ui/form`; ejemplo en `/sample#notebook`. Mantener sus páginas montadas y la integración de errores con FormLayout. Los Fields nuevos deben incluir `data-form-field={name}` en su wrapper para identificar y revelar errores dentro de notebooks.

- El usuario pidió conservar la idea de un scaffold de aplicaciones modulares inspirado en Odoo, con manifest, vistas, modelos, relaciones y activación desde un catálogo. Alcance y decisiones en [docs/ideas/aplicaciones-modulares.md](docs/ideas/aplicaciones-modulares.md). Es una idea futura; retomarla cuando el usuario lo solicite.
