# Acciones del modelo con parámetros

Implementado el 2026-11-17. Los parámetros describen datos transitorios necesarios
para una acción; no son campos del formulario principal ni se guardan por sí solos.
Su declaración con Fields deriva Zod, metadatos públicos y el diálogo de FormButton.

## Declaración en la clase

```ts
import {
  Fields, Model, action, ModelValidationError,
  type ActionRecord, type ActionParams,
} from "@/lib/orm";

const cierreParams = {
  nota: Fields.Text({
    label: "Nota de resolución",
    required: true,
    minLength: 10,
    maxLength: 2000,
  }),
};

export class Ticket extends Model {
  name = Fields.Text({ required: true });
  estado = Fields.Selection([
    { value: "abierto", label: "Abierto" },
    { value: "cerrado", label: "Cerrado" },
  ], { required: true, default: "abierto" });
  resolucion = Fields.Text({ label: "Resolución", maxLength: 2000, tracking: true });

  @action({ label: "Cerrar ticket", params: cierreParams })
  cerrar(record: ActionRecord<Ticket>, params: ActionParams<typeof cierreParams>) {
    if (record.estado === "cerrado") {
      throw new ModelValidationError("El ticket ya está cerrado.");
    }
    return { estado: "cerrado", resolucion: params.nota };
  }
}
```

La firma nueva es `(record, params, context)`: el tercer argumento, si se necesita,
es el ActionContext habitual con actor, tx y nombre de acción. Las acciones sin
`params` conservan `(record, context)`; no hay que migrarlas ni desplazar su contexto.
`ActionParams<typeof cierreParams>` deriva los tipos de salida, incluidos nulls y
valores literales de Selection. El registro, los parámetros y el contexto se
entregan como snapshots inmutables. `groups` conserva su política actual.

## FormButton

En el formulario personalizado bajo ModelForm:

```tsx
// Ejemplo para un modelo soporte.ticket con contrato SoporteTicket.
import { SoporteTicketActions as ticketActions } from "@/generated/orm/actions/soporte/SoporteTicket.actions";

<FormHeader>
  <FormButton action={ticketActions.cerrar} />
</FormHeader>
```

No se escribe otro esquema ni un modal por aplicación. ModelForm transmite el
contrato autorizado; FormButton abre el diálogo con los Fields existentes.
Las referencias se generan con `orm:sync` o
`npm run orm:generate -- soporte --actions-only --write`, sin BD en este último caso.
[Tipado y formularios manuales](ideas/acciones-formulario.md#referencias-tipadas-y-generación-2026-11-22).

1. Se solicitan y validan los parámetros con su propio RHF/Zod. Cancelar, Escape o
   cerrar no ejecuta guardado ni acción. Los lookups pueden hacer lecturas autorizadas.
2. Confirmar cierra el diálogo y conserva los argumentos; si el documento es nuevo
   o está modificado, se valida/guarda primero mediante el flujo existente de FormView.
3. Sólo si ese guardado termina bien, se ejecuta la acción con el ID y revisión
   persistidos. Si el documento ya está limpio, se ejecuta directamente.
4. La respuesta actualiza el documento como antes. Si la acción falla después del
   guardado, ese guardado previo se conserva: son dos operaciones distintas.

Un único bloqueo cubre parámetros → guardado → acción y evita clics duplicados.
El diálogo vive como hermano del formulario principal, con Modal/portal y su propio
FormLayout; no hay forms anidados ni se mezclan sus valores con RHF del documento.
Los controles conservan autocomplete off, a11y, foco y las validaciones existentes.

Tras un rechazo, se conservan los argumentos confirmados y sus errores en memoria
mientras viva esa instancia de FormView, para reabrir y corregir. Se eliminan al
completar la acción. No se guardan en localStorage ni se promete conservarlos al
recargar, cambiar de registro o navegar después de crear uno nuevo.

## Errores de parámetros y del registro

Zod y las referencias inválidas devuelven `parameterErrors`, separado de
`fieldErrors`. El formulario principal no registra campos ficticios como nota.
Para una regla adicional del propio método:

```ts
throw new ActionParameterError("Revisa la nota.", {
  nota: "Explica la solución antes de continuar.",
});
```

`ActionParameterError` se importa de `@/lib/orm`. FormView muestra el rechazo y al
reabrir presenta los errores sobre los parámetros conservados. Las reglas que
corresponden al documento siguen usando ModelValidationError y fieldErrors.

## Llamada directa y formularios manuales

```ts
await modelAction("soporte.ticket", {
  action: "cerrar",
  id,
  revision,
  params: { nota: "Se reemplazó la pieza y se verificó el funcionamiento." },
});
```

Para un FormView propio con un runner manual, reenviar el tercer argumento:

```tsx
runAction={(action, target, params) =>
  modelAction(config.id, { action, ...target, params })
}
```

ModelForm ya lo hace. El navegador nunca proporciona actor, repositorio, esquema ni
métodos arbitrarios. Los parámetros no se mezclan automáticamente con los campos
persistentes: sólo el patch que devuelve el método pasa al guardado normal.

## Many2one y tipos admitidos

`params` admite Text, Integer, Boolean, Selection, DateTime y Many2one:

```ts
const reasignacion = {
  tecnicoId: Fields.Many2one("SoporteTecnico", {
    label: "Técnico",
    required: true,
  }),
};
```

El destino debe ser un modelo declarativo registrado, con depends directo si es de
otro módulo. El diálogo usa su lookup autorizado; el servidor exige lectura del
destino, con sus reglas, en la misma transacción de la acción. User/Partner manuales
no tienen proveedor automático en este contrato inicial. Las acciones declaradas
por extensiones resuelven sus dependencias y grupos respecto del módulo extensor.

Hasta ocho parámetros y 16.000 caracteres JSON de valores validados. Se rechazan
objetos con prototipos personalizados, getters, claves desconocidas y tipos ajenos;
no se ejecuta toJSON del input. Los defaults escalares literales se aplican al
omitir campos; los opcionales vacíos se normalizan según su Field. Un requerido
sin default válido debe enviarse. El formulario muestra esos mismos defaults.

Sin imágenes/subidas, One2many/Many2many, sequence, related, compute, sensitive,
unique, tracking ni defaults de función en parámetros. Las notas con maxLength
mayor de 250 usan FieldText long en el diálogo. No hay maquetación personalizada
para cada diálogo ni un modelo persistente de asistentes todavía.

## Seguridad y ejecución

La transacción Serializable revalida sesión, write/reglas del registro, grupos de
la acción y revisión antes de invocar el método. Los parámetros se validan después
de esa autorización, se comprueban las referencias Many2one y sólo entonces se
llama al método publicado. El patch reutiliza normalize, hooks, constraints,
permisos, historial y concurrencia del guardado; un fallo revierte esa operación.

Los argumentos no se incorporan al historial ni se persisten automáticamente. Si
el método guarda la nota en resolucion, ese campo sigue su política de tracking.
No se reintentan acciones automáticamente ante fallos de red o commit desconocido.
No hacer efectos externos desde métodos/hooks transaccionales: no son afterCommit.

Las transiciones Kanban no pueden usar una acción con params; se rechaza al compilar
la configuración. No hay diálogo de parámetros durante arrastre. Usar FormButton o
una llamada explícita de la acción, sin omitir sus argumentos para forzar la transición.

## Comandos y pruebas

Cambiar sólo el decorador/argumentos no requiere SQL ni orm:sync. Si se agregan
campos persistentes como resolucion, sincronizar el modelo por el flujo habitual.
Recargar la vista/reiniciar dev si conserva metadatos anteriores.

Demo `/sample#action-parameters`, con datos en memoria: cancelar, validar nota,
modificar título y comprobar guardado → acción, rechazo con «rechazar», reabrir con
argumentos conservados y corrección. No escribe en BD ni envía avisos.

```bash
npm run test:orm
npm run test:modules
npm run test:form-model
npm run test:action-parameters:integration
```

La integración instala un módulo ficticio y cuentas en un proyecto/esquema temporal,
comprueba tipos/defaults, campos extra, permisos/grupos/reglas, referencias ocultas o
inexistentes, revisión, sesión, firma legacy, errores de argumentos y rollback de
hooks/historial. Elimina esos recursos sin usar datos del ERP.
