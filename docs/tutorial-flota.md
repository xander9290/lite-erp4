# Flota: tutoría con módulos declarativos

Recorrido actualizado el 2026-11-13 para `src/modules`. El usuario ejecuta los
ejercicios; explicar y verificar uno cada vez, sin crear modelos, vistas ni reglas
por adelantado. [Contrato y herramientas](modulos-declarativos.md).

La Flota actual (`/erp/flota`, flujo `orm.config.ts`) y Demo se conservan con sus
fuentes y datos por decisión del usuario. Este trabajo no los migra ni retira.
Para practicar en paralelo, el ID propuesto es **flotaensayo**; no ejecutar
`create:module -- flota`, porque colisiona con la aplicación existente. Usar el ID
`flota` en el futuro exige acordar primero qué hacer con la aplicación actual.

## Recorrido previsto

1. Crear el módulo mínimo y entender manifest e índice explícito.
2. Añadir Fabricante, personalizar campos, revisar `orm:sync` y probar las vistas
   por defecto con guardado/reapertura.
3. Añadir Modelo y su Many2one a Fabricante, con lookup por convención.
4. Añadir Vehicle y su relación a Modelo; personalizar `@displayName` para
   «Fabricante · Modelo». Las decisiones de nombres se toman con el usuario.
5. Practicar las opciones de colección en Fields.
6. Expulsar sólo el formulario de Vehicle con `eject:view` y personalizar su TSX.
7. Declarar grupos, permisos y reglas; asignarlos desde Control de accesos.
8. Añadir una imagen `related` del logo del fabricante.

No es necesario escribir un manifest desde cero ni generar vistas por modelo:
`create:module` produce el esqueleto y `create:model` registra cada clase. Los
menús y las reglas de negocio/acceso sí se personalizan expresamente.

## Primer paso, todavía por ejecutar por el usuario

```bash
npm run create:module -- flotaensayo --dry-run
```

Debe mostrar la creación de `src/modules/flotaensayo/manifest.ts` y la edición de
`src/modules/index.ts`, sin escribir archivos ni consultar la base. Revisar juntos
el resultado antes de explicar el siguiente comando. El módulo mínimo no contiene
modelos ni aparece en el cajón hasta añadir el primero; ningún ejercicio se ha
ejecutado en la aplicación del usuario como parte de implementar las herramientas.

Las migraciones siempre se revisan antes de aprobar SQL en `orm:sync`. Las
pruebas del framework usan fixtures y esquemas temporales independientes de esta
tutoría, de Flota y de Demo.
