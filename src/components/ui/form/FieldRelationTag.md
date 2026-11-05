# FieldRelationTag

Selector múltiple de registros existentes con tags DaisyUI y modal paginado. Reutiliza la acción y el registro de modelos de FieldMany2One; no requiere librerías nuevas.

```tsx
const schema = z.object({ partnerIds: z.array(z.string().min(1)).min(1).max(5) });
const methods = useForm({
  resolver: zodResolver(schema),
  defaultValues: { partnerIds: [] }, // También admite un arreglo de IDs existentes.
});

<FormLayout methods={methods} onSubmit={onSubmit}>
  <FormGroup>
    <FieldRelationTag
      name="partnerIds"
      label="Contactos"
      model="partner"
      searchFields={["name", "user.login"]}
      displayName="{name}"
      columns={[{ field: "user.login", label: "Usuario" }]}
      maxSelected={5}
      required
      onChange={(ids, records) => console.log(ids, records)}
    />
  </FormGroup>
</FormLayout>
```

- RHF conserva `string[]`, sin duplicados. `onChange(ids, records)` devuelve los IDs y DTOs públicos en el mismo orden. Limpiar todo devuelve `([], [])`.
- El desplegable permite agregar/quitar un registro. El modal usa checkboxes y conserva las marcas entre búsquedas y páginas. **Aplicar selección** confirma el conjunto; Cancelar/Escape lo descartan sin cambiar el formulario ni ejecutar onChange.
- Las × quitan tags; Retroceso quita el último cuando la búsqueda está vacía. Flechas/Enter/Escape funcionan en el desplegable.
- `defaultValues` y `reset` reciben IDs. Se resuelven por lote, sin modificar `isDirty` ni ejecutar onChange. Escribir búsquedas o marcar provisionalmente en el modal tampoco cambia RHF.
- `model`, `searchFields`, `displayName`, `columns` y `pageSize` funcionan como en FieldMany2One. Las relaciones opcionales y rutas como `partner.name` están soportadas.
- `maxSelected`: de 1 a 100 (100 predeterminado); replicar el límite en Zod. Los valores iniciales que superen el límite se reportan como inválidos.
- `direction="inline" | "block"`, label opcional (sin label ocupa todo el ancho), `disabled`, `readOnly`, `required`, `clearable`, `placeholder` y atributos accesibles.
- Sin autocomplete, creación ni edición. Los errores del formulario pasan por los toasts de FormLayout. Las consultas fallidas tienen reintento local.
- Los IDs inaccesibles se conservan y se señalan; no se descartan silenciosamente ni se inventan registros. Usa **Quitar no disponibles** o limpia la selección para recuperarte. Mientras se resuelven IDs, la edición espera para que el callback entregue registros completos.

## Backend

La acción existente admite `ids` (máximo 100, únicos) para cargar todas las selecciones en una consulta acotada, sin truncarlas al tamaño de página del buscador. Conserva las validaciones, los selects públicos y los filtros del registro del servidor.

El componente no decide qué relación se guarda ni escribe en la base. En una relación many-to-many de Prisma, el servidor puede traducir los IDs con `set: ids.map(id => ({ id }))` para reemplazar la selección, o `connect`/`disconnect` para cambios puntuales. Validar existencia, permisos y pertenencia al guardar. Los modelos actuales mantienen sus relaciones originales; no se crea una relación M:N nueva para este ejemplo.

Ejemplo Zod/RHF con usuarios y contactos reales: `/sample#field-relation-tag`. La carga de registros no inserta datos.
