# FieldMany2One

Para modelos declarativos, usar `load={lookupRecords}` del servicio del modelo
relacionado, sin plantilla de presentación ni campos de búsqueda en la vista.
Contrato, permisos, compatibilidad y ejemplo RHF/Zod en
[Nombres de presentación](../../../../docs/nombres-presentacion.md) y
`/sample#model-display-name`. El modo `model` descrito abajo conserva los
catálogos manuales existentes.

Buscador de registros existentes integrado con FormLayout/RHF. No crea ni edita registros. No requiere librerías adicionales.

```tsx
const methods = useForm({
  resolver: zodResolver(schema),
  defaultValues: { userId: null }, // O el ID existente; se resuelve automáticamente.
});

<FormLayout methods={methods} onSubmit={onSubmit}>
  <FormGroup>
    <FieldMany2One
      name="userId"
      label="Usuario"
      model="user"
      searchFields={["login", "partner.name"]}
      displayName="[{login}] {partner.name}"
      columns={[{ field: "partner.name", label: "Contacto" }]}
      pageSize={10}
      onChange={(id, record) => console.log(id, record)}
    />
  </FormGroup>
</FormLayout>
```

- `model`: `user` o `partner`. Los valores predeterminados están en `src/lib/many2one/types.ts`.
- `searchFields`: campos de texto permitidos. Las palabras se combinan con AND; cada palabra puede coincidir con cualquiera de los campos (OR). Búsqueda sin distinguir mayúsculas; `%` y `_` se buscan como texto literal.
- `displayName`: plantilla con `{campo}` o `{relacion.campo}`. Las relaciones opcionales vacías se muestran sin errores.
- `columns`: columnas adicionales del modal, visibles desde `sm`; en móvil se conserva el nombre completo y la selección. Solo se pueden mostrar los datos públicos devueltos por el servidor; no amplía el `select`.
- `pageSize`: 5, 10 (predeterminado), 20 o 25. El desplegable rápido muestra hasta cinco coincidencias; el modal pagina y cuenta los resultados.
- `direction`, label opcional, `required`, `disabled`, `readOnly`, `placeholder`, `clearable` (predeterminado: true) y atributos de input compatibles.
- `onChange(id, record)` entrega el ID y el DTO público. Limpiar entrega `(null, null)`. RHF conserva solo el ID.
- `defaultValues`/`reset` aceptan IDs; resolverlos o escribir búsquedas no marca el formulario como dirty. Seleccionar y limpiar pasan por `field.onChange`.
- Flechas recorren las sugerencias; Enter selecciona o abre Buscar más; Escape cierra. El modal usa `<dialog>` con foco contenido y devuelve el foco al Field.
- FormLayout presenta errores Zod en toast. Los errores de conexión tienen reintento local. Una selección inaccesible no se valida silenciosamente.

## Presentación de solo lectura, fuera de RHF

```tsx
<FieldMany2One mode="display" label="Creado por" direction="inline"
  value={user ? { id: user.id, label: `[${user.login}] ${user.name}`, avatarUrl: user.avatarUrl } : null} />
```

`mode="display"` recibe una relación pública ya resuelta por el servidor y la
muestra con avatar/iniciales. No recibe `name`, `model`, `onChange` ni opciones de
búsqueda. No registra valores en RHF ni genera inputs, consultas o modal; funciona
también fuera de FormLayout. Con `null` muestra `emptyText` (por defecto «Sin
información»). Conserva dirección inline/block y ancho completo sin label.
El `readOnly` del modo editable anterior conserva su contrato RHF.

Ejemplo: `/sample#record-audit`. Contrato de auditoría:
[docs/auditoria-modelos.md](../../../../docs/auditoria-modelos.md).

## Servidor

`src/lib/many2one/actions.ts` contiene una sola acción para búsqueda, paginación y resolución por ID. Valida todas las props con Zod en el servidor. El registro en `registry.ts` define consultas tipadas y selects explícitos: nunca acepta `where`, `include`, selects arbitrarios ni contraseñas desde el cliente.

Para habilitar otro modelo, agregar su contrato público/defaults en `types.ts`, incorporarlo al enum/validación de `query.ts` y registrar su consulta con select, filtros y orden estable en `registry.ts`. No requiere otra Server Action.

La aplicación todavía no implementa sesiones ni aislamiento por empresa: los dos catálogos habilitados son consultables desde `/sample`. Al integrar autenticación, aplicar sus permisos y restricciones de filas en el registro del servidor, tanto para búsqueda como para resolución por ID. No aceptar esos permisos ni filtros de seguridad por props.

Ejemplo completo con Zod, relaciones, `reset`, `onChange` e `isDirty`: `/sample#field-many2one`. Usa los datos existentes; no inserta registros de demostración.
