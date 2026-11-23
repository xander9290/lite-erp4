# Acciones de formulario

Pendiente solicitado el 2026-11-13 y ampliado el 2026-11-14. **Implementado el
2026-11-14** (ver «Contrato implementado»); las secciones siguientes conservan el
acuerdo original y sus criterios de aceptación. Ventas y acciones en Flota siguen
sin crearse.

## Contrato implementado (2026-11-14)

Kanban también puede ejecutar estos métodos mediante transiciones declaradas
from/to/action. Comparte la ejecución autorizada y persistencia de la acción
con el botón, dentro de la transacción del movimiento. No hay borrador de
formulario que guardar en ese flujo. [Contrato Kanban](../modulos-declarativos.md#kanban-mediante-acciones-publicadas).

Actualización del 2026-11-22: la vista usa una **referencia tipada generada**,
`<FormButton action={ventaActions.confirmar} />`. El botón resuelve su nombre sólo
si la referencia corresponde al modelo del formulario y la acción sigue publicada
en el snapshot efectivo. El navegador envía ese nombre con ID/revisión a la Server
Action fija (`modelAction`); el servidor conserva su whitelist y autorización.
La referencia es un dato `{model, name}`, no una función ejecutable ni un permiso.

```ts
@action({ label: "Confirmar", groups: ["gerente"] }) // groups opcional
confirmar(record: ActionRecord<Venta>, context: ActionContext): ActionPatch<Venta> {
  if (record.estado !== "borrador") throw new ModelValidationError("Sólo borradores.");
  return { estado: "confirmada" };
}
```

- Publicación: sólo métodos con `@action` (máx. 20). Nombres reservados
  (normalize, beforeSave, afterSave, displayName, constructor) se rechazan al
  definir el modelo; label obligatorio; groups no vacío, `clave` del módulo o
  `modulo.clave`.
- Método: recibe el registro persistido congelado y `{tx, actor, action}`; puede
  leer con `context.tx`. Devuelve un patch parcial de campos declarados (o nada).
  Lanzar `ModelValidationError` expresa una transición inválida.
- Ejecución (`service.action`): transacción Serializable; permiso de escritura y
  regla de registro; grupos de la acción (el superusuario pasa); revisión vigente.
  El patch recorre el mismo `persist` del guardado (normalize, Zod, beforeSave,
  constraints, afterSave, tracking). Cualquier error revierte la acción. El
  historial registra «Acción: <label>» aunque no haya cambios rastreados. La
  respuesta es la misma que save, con el mensaje «<label>: acción completada.».
- Cliente: `FormHeader` (portal en la cabecera de FormView, dentro de RHF) y
  `FormButton` (`type="button"`, label publicado por defecto, oculto en consulta).
  FormView coordina con un bloqueo síncrono: si el registro es nuevo o tiene
  cambios, envía el formulario y espera el resultado del ciclo normal; si falla,
  se detiene. Después ejecuta `runAction(name, {id, revision})` con la revisión
  guardada. El fallo de la acción conserva lo guardado y llama `onSaved` con ello;
  un error de red no presenta éxito ni reintenta.
- ModelForm conecta `runAction` y `actions` desde `ModelClientConfig`
  automáticamente, incluyendo `actionModel={config.name}` para limitar las referencias.
  Demo ficticia en `/sample#form-actions`.

## Referencias tipadas y generación (2026-11-22)

Después de declarar/renombrar/eliminar un método `@action`, generar sus referencias:

```bash
npm run orm:generate -- ventas --actions-only --write
```

El ejemplo supone un modelo `ventas.venta` con nombre de contrato `VentasVenta`:

```tsx
import { VentasVentaActions as ventaActions } from "@/generated/orm/actions/ventas/VentasVenta.actions";

<FormHeader>
  <FormButton action={ventaActions.confirmar} />
</FormHeader>
```

`ventaActions.confimar` produce error de TypeScript y autocompletado de las acciones
publicadas al generar. `FormButton` exige `ModelActionReference`: ya no admite
strings ni objetos escritos a mano. La marca es sólo de tipos; cada referencia
es inmutable y serializable. No importa la clase server-only en el navegador.
Las referencias sólo contienen el nombre del contrato del modelo y el método:
sin cuerpos, campos privados, labels, grupos, parámetros ni concesiones estáticas.
El label, parámetros y disponibilidad continúan viniendo del snapshot efectivo.

Salida: `src/generated/orm/actions/<modulo>/<NombreContrato>.actions.ts`, export
`<NombreContrato>Actions`. Incluye acciones heredadas publicadas. Las extensiones
generan `<NombreCompañera>Actions` en su propio módulo, pero cada referencia apunta
al contrato base (p. ej. `Partner`), no a la fila compañera. Los modelos sin acciones
generan un mapa vacío. En core se admite `orm:generate -- core --actions-only` para
las referencias nativas; no instala ni sincroniza tablas de infraestructura.

`orm:sync` genera estas referencias al sincronizar contratos, también para módulos
declarativos runtime. `orm:generate` completo también las incluye. `--actions-only`
evita Prisma, instalación y acceso a BD: sin --write revisa; con --check devuelve 2
si hay diferencias, sin escribir. Conserva hashes, rechazo de symlinks y protección
contra cambios manuales mediante el writer existente. Regenerar tras cambios del
modelo; el servidor permanece seguro aunque un contrato cliente quede desactualizado.
Los archivos generados deben compartirse en Git junto con sus consumidores, como
los demás contratos versionados; no asumir que existen en otra máquina.

Para FormView manual con FormButton, declarar explícitamente `actionModel` con el
nombre del contrato, `actions` autorizado y `runAction`. Una demo/servicio manual
puede usar `defineActionReferences("SampleSale", ["confirmar", "cancelar"])` de
`@/lib/orm/action-reference` para su conjunto finito; no registrar de nuevo los
métodos de modelos declarativos en TSX. Sin modelo/snapshot, referencia ajena,
acción omitida o formulario de consulta, el botón se oculta. La pertenencia al modelo
se comprueba en ejecución; TypeScript comprueba las claves de la referencia, pero
no deduce el modelo del provider React padre.

Migración: sustituir `action="nombre"` por el miembro del contrato generado y,
en formularios manuales, añadir `actionModel`. Las demos y pruebas existentes ya
están adaptadas. `runAction` interno y endpoints siguen recibiendo el nombre como
string validado; grupos, parámetros, revisión y transacción no cambian.

## Antecedentes históricos: problema y objetivo

FormView ya ofrece headerActions, menuActions, statebar y un ciclo de guardado.
ModelForm todavía no expone esos slots a las vistas expulsadas. Una acción como
«Confirmar» obliga hoy a repetir coordinación de RHF, validación, guardado,
identidad/revisión, bloqueo, errores y actualización del registro.

Crear FormHeader y FormButton para expresar la cabecera en JSX y compartir esa
coordinación. Conservar FormView y los contratos existentes; no reescribir sus
slots ni duplicar formularios/providers. La lógica de negocio sigue en el servidor.

## Acciones en la clase del modelo (acuerdo del 2026-11-14)

La regla de negocio de una acción como confirmar pertenece a un método de Venta,
no a un servicio separado que deba crearse por cada botón. El framework aporta
la ejecución compartida: publicación explícita de acciones, autorización y sesión
vigentes, lectura del registro, comprobación de ID/revisión, transacción, validación
y persistencia del resultado, avance de revisión, historial y respuesta canónica.
El método comprueba la transición de negocio y expresa sus cambios.

ModelForm conecta FormButton con ese método mediante la Server Action fija
modelAction, sin duplicar reglas de negocio. Sólo se
pueden ejecutar métodos publicados como acciones; normalize, beforeSave, afterSave
y auxiliares permanecen internos. No permitir invocación arbitraria de métodos
ni escritura libre de campos desde el navegador.

@action, ActionRecord y la firma record/context ya están implementados según el
contrato superior (record/params/context cuando hay parámetros declarados).
La coordinación FormHeader/FormButton reutiliza el ciclo existente. Ventas y
estados/acciones de Flota no se crean por documentar este ejemplo.

## Ejemplo de composición

```tsx
import { VentasVentaActions as ventaActions } from "@/generated/orm/actions/ventas/VentasVenta.actions";

<ModelForm config={config} id={id}>
  <FormHeader>
    <FormButton action={ventaActions.confirmar}>
      Confirmar
    </FormButton>

    <FieldSelect<Values> name="estado" widget="statebar" />
  </FormHeader>

  <FormGroup legend="Datos de la venta">
    {/* Fields */}
  </FormGroup>
</ModelForm>
```

Es la API vigente aplicada a un modelo hipotético; Ventas todavía no existe.
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

- La acción de negocio se define en la clase del modelo. El adaptador no repite
  esa lógica; métodos no publicados se rechazan. Probar permisos/sesión, revisión
  obsoleta, transición inválida, rollback de la acción y resultado canónico con
  revisión/historial, preservando el guardado previo si la acción falla.
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
