# Acciones de formulario

Pendiente solicitado el 2026-11-13. **Prioridad para la próxima sesión, prevista
para el 2026-11-14**, antes de continuar la tutoría de Flota. Este documento
registra el acuerdo; FormHeader y FormButton todavía no están implementados.

## Problema y objetivo

FormView ya ofrece headerActions, menuActions, statebar y un ciclo de guardado.
ModelForm todavía no expone esos slots a las vistas expulsadas. Una acción como
«Confirmar» obliga hoy a repetir coordinación de RHF, validación, guardado,
identidad/revisión, bloqueo, errores y actualización del registro.

Crear FormHeader y FormButton para expresar la cabecera en JSX y compartir esa
coordinación. Conservar FormView y los contratos existentes; no reescribir sus
slots ni duplicar formularios/providers. La lógica de negocio sigue en el servidor.

## API ilustrativa acordada

```tsx
<ModelForm config={config} id={id}>
  <FormHeader>
    <FormButton action={confirmarVenta}>
      Confirmar
    </FormButton>

    <FieldSelect<Values> name="estado" widget="statebar" />
  </FormHeader>

  <FormGroup legend="Datos de la venta">
    {/* Fields */}
  </FormGroup>
</ModelForm>
```

Es una propuesta de consumo, no código disponible. Ventas todavía no existe.
Preferencia por componentes independientes FormHeader/FormButton, coherentes con
FormGroup/Stack, en lugar de exigir Form.Header. FormHeader coloca botones y el
Field de estado en la cabecera dentro del contexto RHF. Preservar la distribución
de acciones principales y estado, Guardar/Revertir y el menú general existente.
El statebar sigue siendo de consulta por defecto.

FormButton debe aceptar invisibilidad/condiciones React y reutilizar el estado del
formulario (dirty, busy, readOnly), sin repetir ese control en cada vista. El diseño
debe permitir que componentes hijos usen useFormContext/useWatch; el ejemplo de
callback de FormHeader con ese contexto es una alternativa discutida, no una
segunda API obligatoria ni ya implementada.

## Secuencia predeterminada del botón

1. Un único bloqueo cubre todo el proceso, incluidos clics repetidos, otros botones
   y Guardar. Usar type="button" para evitar submits dobles. Respetar modo de
   consulta y el estado de la navegación/cambios pendientes.
2. Ejecutar primero el ciclo del formulario: esperar las reacciones pendientes y
   sus errores, validaciones RHF/Zod y auxiliares, y el guardado normal si es nuevo
   o tiene cambios. Reutilizar FormView/ModelForm y sus hooks de servidor; no crear
   otro pipeline ni disparar requestSubmit sin esperar su resultado.
3. Si el formulario rechaza validación/guardado, detenerse. La acción del botón no
   se invoca y el borrador/errores se conservan.
4. Sólo tras éxito, ejecutar la acción propia del botón con el ID y la revisión
   recién persistidos. Un registro existente sin cambios puede reutilizar su
   identidad vigente, sin escritura redundante, conservando la validación.
5. Procesar el resultado autorizado del servidor. En éxito, actualizar los valores
   RHF y la identidad/revisión, auditoría y displayName cuando corresponda. En
   fallo, mostrar los errores y conservar el estado correcto; liberar el bloqueo
   siempre. Evitar redirects, remounts u onSaved prematuros al crear que impidan
   ejecutar la acción o la ejecuten dos veces.

La separación acordada es **ciclo del formulario → acción del botón**, sin necesitar
saveBefore en cada botón. El contrato exacto de action y del resultado compartido
se debe tipar al implementar. Pasar referencias explícitas a Server Actions, nunca
nombres arbitrarios de métodos que el navegador pueda ejecutar remotamente.

## Servidor, fallos y persistencia

Guardar y ejecutar la acción son dos operaciones secuenciales; no hay rollback
automático del guardado si falla la acción posterior. En ese caso, el formulario
debe conservar el registro ya guardado y su revisión nueva, sin volver a la
identidad antigua ni presentar la acción como exitosa. No reintentar a ciegas una
mutación con resultado de red desconocido.

Cada acción de negocio debe autorizar al actor, verificar ID/revisión y transición
válida dentro de su transacción, y devolver el resultado canónico. El botón no
autoriza por estar visible ni sustituye reglas de negocio. No crear una acción
genérica que permita escribir cualquier estado/campo o saltarse hooks y constraints.
Una operación que necesite guardar y confirmar atómicamente requiere un contrato
de servidor específico; esa atomicidad no forma parte de esta coordinación UI.

## Criterios de aceptación

- FormHeader funciona en ModelForm y se integra con FormView sin provider/form
  adicionales. El statebar lee RHF, y botones/Fields funcionan al personalizar TSX.
- Registro nuevo: validar, guardar y ejecutar exactamente una vez con ID/revisión
  nuevos. Registro modificado: la acción recibe la revisión posterior al guardado.
  Registro limpio: no se escribe de nuevo por defecto.
- Errores locales, reacciones pendientes/fallidas o guardado rechazado impiden la
  acción. Fallo de acción después de guardar conserva el registro guardado.
- Clics repetidos/acciones simultáneas se bloquean durante toda la cadena; errores
  de red no producen éxito aparente ni reintento automático de una mutación.
- Mantener alertas/errores por campo, guard de navegación, historial, auditoría,
  displayName, creación, recarga, eliminación y acciones actuales compatibles.
- Demo RHF/Zod en /sample con datos ficticios, sin modificar registros de Flota
  ni crear Ventas. Probar éxito, errores de cada fase, identidad/revisión, doble
  clic, modo consulta y navegación al crear. Checks proporcionales al cambio.
- Actualizar guías y continuidad antes de retomar Flota. Adaptar aplicaciones sólo
  en un ejercicio acordado con el usuario; no adelantarlas durante la implementación.

## Referencias para implementar

- `src/components/ui/form/FormView.tsx` y `FormView.md`.
- `src/components/ui/form/FormLayout.tsx`, reacciones y validadores auxiliares.
- `src/components/modules/ModelForm.tsx` y acciones de módulos.
- `src/app/sample/FormViewSample.tsx`: Confirmar/Cancelar como ejemplo existente
  sin persistencia; no confundirlo con un flujo completo de Ventas.
