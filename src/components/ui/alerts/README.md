# Alertas y modales

`AlertProvider` está instalado en el layout raíz. En un Client Component:

```tsx
import { useAlerts } from "@/components/ui/alerts/AlertProvider";

const alerts = useAlerts();
await alerts.info({ title: "Información", message: "Reporte preparado." });
await alerts.error({ title: "No se pudo completar", message: "Intenta nuevamente." });
await alerts.validation({ message: "Revisa el documento.", details: ["La referencia ya existe."] });

const accepted = await alerts.confirm({
  title: "Cancelar documento",
  message: "¿Deseas continuar?",
  confirmLabel: "Sí, cancelar",
  cancelLabel: "Volver",
  danger: true,
});
if (!accepted) return;
await cancelDocument();
```

Info, Error y Validation resuelven al cerrar; Confirm devuelve un booleano. Escape, el fondo y el botón × equivalen a cancelar. El foco inicial de Confirm está en Cancelar. Los diálogos se muestran en orden; no apiles llamadas con `await` si necesitas encolarlas de inmediato.

Los mensajes y detalles se renderizan como texto. Devuelve mensajes públicos desde el servidor; las excepciones inesperadas de FormView se muestran con un mensaje genérico, sin detalles técnicos internos.

## Cargando

```tsx
try {
  const report = await alerts.withLoading(() => prepareReport(id), {
    title: "Preparando reporte…",
    message: "Un momento, por favor.",
  });
  setReport(report);
} catch {
  await alerts.error({ message: "No se pudo preparar el reporte." });
}
```

`withLoading` siempre cierra su indicador y propaga los errores. Para controlar el ciclo manualmente, `const close = alerts.loading(options)` devuelve una función idempotente; llámala en `finally` y en la limpieza si se desmonta la vista. Cada indicador tiene identidad propia: cerrar una operación anterior no cierra la de otra. Cargando no admite Escape ni cierre desde el fondo.

No esperes una confirmación dentro del trabajo de `withLoading`: se encolaría detrás del indicador. Confirma antes de iniciar el trabajo y muestra los errores después de finalizarlo. Al desmontar el provider se resuelven las confirmaciones pendientes como `false`.

## Abrir registros en FormView

FormView muestra y guarda; `FormViewLoader` controla la obtención del registro. Usarlo en las rutas o modales que abran registros garantiza el mismo ciclo de carga:

```tsx
const load = useCallback(() => readDocument(id), [id]);

<FormViewLoader recordKey={id} load={load}>
  {record => <DocumentForm record={record} />}
</FormViewLoader>
```

`readDocument` puede ser una Server Action y devuelve `{ ok: true, values: record }` o `{ ok: false, kind: "server", error: "Mensaje público" }`. También admite `kind: "validation"`. Valida y autoriza el acceso en esa acción; el loader no conoce modelos ni permisos.

El formulario se monta únicamente después de recibir el registro; DocumentForm usa esos datos como `defaultValues` de RHF. Mantén `load` estable (`useCallback` o función importada) y cambia `recordKey` al cambiar de registro. Confirma antes si el registro actual tiene cambios pendientes.

Se muestra un diálogo «Cargando…» en cada carga y reintento. Si falla, se cierra el indicador, aparece un error y queda un botón Reintentar. Las respuestas anteriores se ignoran al cambiar de registro, reintentar o desmontar. El tiempo máximo es de 30 segundos (`timeoutMs` configurable); las respuestas que lleguen después se ignoran. Las Server Actions ya iniciadas no se cancelan en el servidor.

Un FormView con datos ya disponibles no ejecuta una petición ni inventa una espera. La vista rápida de ListView continúa mostrando los datos que ya posee; las futuras rutas de edición deben envolver la consulta con FormViewLoader. Para páginas renderizadas en servidor se puede complementar con el `loading.tsx` de su ruta.

## Validación de servidor en FormView

```ts
return {
  ok: false,
  kind: "validation",
  error: "Revisa los datos del documento.",
  fieldErrors: { reference: "Esta referencia ya existe." },
};
```

FormView muestra «Error de validación», registra los errores en RHF y conserva los cambios y el último punto de Revertir. Después de cerrar se enfoca el Field rechazado. Notebook sigue revelando las páginas que contengan errores. Si se omite `kind`, la existencia de `fieldErrors` indica validación; sin ellos se trata como un error general. Las excepciones muestran «No se pudo guardar» y permiten reintentar.

Los errores de tipo `server` se muestran en el diálogo y en el resumen del formulario, evitando repetir el mismo error en toast. Las validaciones locales de Zod y de los Fields conservan sus toasts. No se convierte automáticamente cualquier `toast.error` de la aplicación en modal.

## Modal personalizado

```tsx
import Modal from "@/components/ui/alerts/Modal";

<Modal open={open} title="Detalles" onClose={() => setOpen(false)}
  footer={<button type="button" onClick={() => setOpen(false)}>Listo</button>}>
  <YourContent />
</Modal>
```

Controlado con `open` y `onClose`; admite `icon`, `tone`, `size`, `initialFocusRef`, `closeOnEscape` y `closeOnBackdrop`. Usa un dialog nativo y un portal fuera de los fieldsets del formulario. Bloquea el fondo, contiene el foco y lo devuelve al elemento que abrió el diálogo si sigue disponible. Para formularios propios, incluye su propio FormLayout; no uses `method="dialog"` para cerrar un modal controlado.

Ejemplos en `/sample#alerts`. El FormView principal carga un documento de demostración desde el servidor; se añade una espera de 600 ms únicamente en esa acción de ejemplo para observar Cargando. No se escribe en la base de datos. La referencia DUPLICADO permite probar un rechazo de servidor y Cancelar documento usa Confirm.
