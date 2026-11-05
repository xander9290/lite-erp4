# FieldOne2many

Tabla editable de líneas dentro del formulario padre, sin modal de edición. Comparte el FormProvider de FormLayout/FormView y funciona dentro de FormGroup o NotebookPage. Ejemplo completo con Zod en `/sample#field-one2many`.

```tsx
<FieldOne2many<OrderInput, "lines">
  name="lines"
  label="Líneas del pedido"
  createRow={() => ({ description: "", quantity: 1, unitPrice: 0 })}
  maxRows={20}
  reorderable
  onChange={rows => console.log(rows)}
  columns={[
    {
      key: "description",
      label: "Descripción",
      render: ({ fieldName, index }) => (
        <FieldText<OrderInput>
          name={fieldName("description")}
          aria-label={`Descripción, línea ${index + 1}`}
        />
      ),
    },
    {
      key: "quantity",
      label: "Cantidad",
      align: "right",
      render: ({ fieldName, index }) => (
        <FieldNumber<OrderInput>
          name={fieldName("quantity")}
          aria-label={`Cantidad, línea ${index + 1}`}
          type="float" decimals={2}
        />
      ),
    },
  ]}
/>
```

El padre configura `defaultValues.lines` como arreglo de objetos y su esquema Zod con `z.array(lineSchema)`. No agregues otro FormLayout dentro de la tabla. `createRow` debe devolver un objeto nuevo con todos los valores iniciales de la línea; utiliza `null` o cadenas vacías cuando el Field lo requiera.

## Columnas y valores

Cada columna define `key`, `label`, `render` y opcionalmente `width` (ancho CSS para escritorio) y `align`. El renderer recibe `{ index, row, fieldName, readOnly, disabled }`:

- `row` contiene valores actuales, incluidos los cambios escritos; sirve para calcular subtotales.
- `fieldName("quantity")` genera una ruta como `lines.2.quantity` y permite reutilizar los Fields existentes.
- El renderer devuelve contenido; si necesitas hooks propios, devuelve un componente que los use.
- Usa nombres accesibles por fila cuando omitas los labels. Los Fields conservan `autoComplete="off"` y su estilo habitual.

Puedes usar FieldMany2One para productos cuando exista ese modelo en el registro de búsquedas. El ejemplo usa un catálogo estático porque el proyecto actualmente solo tiene User y Partner. El Field no recibe un nombre Prisma para hacer consultas: `name` identifica el arreglo del formulario, y la acción de guardado del padre decide cómo persistir esa relación.

La identidad visual viene de useFieldArray; los IDs persistidos se leen de los valores de RHF, nunca de `fields[].id`. Los IDs originales no se sobrescriben ni se envían claves internas al backend. Las líneas nuevas pueden carecer de ID hasta que el servidor las cree.

## Cambios y acciones

`onChange(rows)` entrega una copia del arreglo completo al editar, agregar, quitar, mover o cambiar sus valores mediante `setValue`. Agrupa los cambios síncronos de una misma operación, como seleccionar un producto y actualizar su descripción/precio. No se ejecuta por el montaje inicial ni por `reset`/Revertir. Los callbacks se ejecutan fuera de la notificación interna de RHF para permitir lógicas de negocio; evita lógicas que se modifiquen a sí mismas indefinidamente.

El Field administra `useFieldArray` y usa los mismos defaults del formulario para `isDirty`, `dirtyFields`, Guardar y Revertir. No uses `shouldUnregister: true` en sus Fields: deben conservarse al reordenar y dentro de páginas ocultas. El `name` de un FieldOne2many debe permanecer estable durante su montaje; si cambias de relación, remonta el componente con una key nueva.

`reorderable` habilita subir/bajar líneas. Quitar es un cambio local y reversible; no ejecuta un DELETE. `minRows` y `maxRows` limitan las acciones y la validación del componente (defaults: 0 y 100); `required` exige al menos una. Define también los límites en Zod para comprobarlos en servidor. La tabla no pagina: representa la colección completa del documento.

`readOnly` oculta las acciones y bloquea los controles; `disabled` bloquea la edición. El fieldset conserva los datos en RHF. No hace falta propagar `disabled` a cada Field, ya que un Field de RHF deshabilitado individualmente puede omitirse del envío. El bloqueo del FormView también impide agregar, quitar o mover líneas mientras se guarda.

`footer` acepta contenido o una función de las filas actuales; úsalo para mostrar totales. Los cálculos de negocio deben repetirse en servidor. En móvil, las filas de la misma tabla se distribuyen verticalmente con encabezados visibles por control; la edición sigue siendo directa, sin abrir otra vista. En escritorio se muestran las columnas horizontales. La distribución usa el ancho del contenedor, por lo que también se adapta dentro de un Notebook o FormGroup estrecho.

## Errores

Zod valida cada línea y sus campos; los errores locales siguen apareciendo en toast. Cada fila indica si tiene errores. Notebook identifica los Fields de cada línea y revela el primero inválido al guardar. Un error agregado del arreglo se muestra en el footer y enfoca el grupo/Agregar línea si está vacío.

Un rechazo del servidor puede usar una ruta precisa:

```ts
return {
  ok: false,
  kind: "validation",
  error: "Revisa la línea 2.",
  fieldErrors: { "lines.1.description": "Esta descripción está bloqueada." },
};
```

FormView muestra el diálogo de Error de validación y conserva todas las líneas editadas. Al cerrarlo vuelve al campo rechazado. En éxito, devuelve el padre con la colección completa e IDs asignados por el servidor; FormView hará `reset(savedRecord)` después de terminar el submit.

## Persistencia

`src/lib/one2many/changes.ts` ofrece `planOne2manyChanges(owned, submitted)`. Después de validar el payload y autorizar el documento, el servidor le pasa la colección completa de IDs que pertenece al padre. Devuelve `create`, `update` y `deleteIds`; cada alta/actualización incluye su posición en el arreglo.

Rechaza IDs duplicados o ajenos, distingue números de strings y conserva el ID cero. Planifica actualización para todas las líneas existentes recibidas; no intenta detectar diferencias de contenido. No consulta Prisma ni ejecuta escrituras por sí mismo.

La acción real debe seleccionar los campos permitidos, aplicar la política de eliminación de la relación y guardar padre y líneas dentro de una transacción. La clave foránea se deriva del padre autorizado; no se toma de cada línea enviada. El índice del plan puede usarse para persistir el orden. Recalcula precios derivados, impuestos y totales según las reglas del modelo.

**La ausencia de un ID implica baja únicamente cuando `owned` y el formulario representan la colección completa.** No uses un resultado paginado/filtrado ni un snapshot enviado por el cliente como referencia de propiedad. La aplicación también debe decidir cómo resolver ediciones concurrentes, por ejemplo con una revisión del padre.

La demo de `/sample` valida, normaliza y muestra un resumen de operaciones sin escribir en la base de datos. Las nuevas líneas siguen sin ID después de validar, porque aún no existen modelos Pedido/Línea en Prisma. El rechazo BLOQUEADO permite probar el circuito de errores de servidor. El catálogo estático y esa regla son exclusivos del ejemplo.

El componente incluye su propia frontera Suspense: esta versión de Next.js requiere diferir las claves aleatorias que RHF genera para las filas durante el prerender.
