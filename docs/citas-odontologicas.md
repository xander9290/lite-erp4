# Guía: Citas odontológicas

## Lo que estamos construyendo

Una agenda para un odontólogo, con pacientes, motivos de consulta, fecha/hora,
observaciones e historial de tratamientos aplicados.
La lista indicará los días que faltan o los días de atraso de las citas programadas;
las atendidas y canceladas mostrarán su estado.

## Qué existe en este paso

- Módulo `citas`, registrado con manifest y dependencia de Contactos.
- Modelo Prisma `DentalAppointment` y su relación con Partner.
- Estados Programada, Atendida y Cancelada.
- Esquema Zod, valores iniciales y conversiones de datos del formulario.
- Modelo `DentalTreatment`: líneas por cita con fecha/hora, procedimiento, observaciones y orden.
- Validación de la colección completa, preparación de escrituras anidadas y DTO de historial.
- Acciones para abrir/guardar citas y consultar el historial paginado, con permisos de servidor.
- ListView con avatar del paciente, teléfono, fecha/hora, motivo, estado y días pendientes/de atraso.
- FormView con statebar, edición de tratamientos en tabla y pestaña de historial paginado.

La práctica base ya permite registrar pacientes en Contactos, programar citas,
registrar tratamientos y consultar el historial desde la interfaz.

## Los archivos que debes conocer

```text
prisma/models/
├── partner.prisma                 # Incluye la relación inversa dentalAppointments
├── dental-appointment.prisma      # Cita y estados persistidos
└── dental-treatment.prisma        # Líneas de tratamientos de cada cita

src/app/(auth)/erp/citas/
├── manifest.ts                   # Identidad, dependencia y acceso del módulo
├── settings.ts                   # Zona horaria del consultorio
├── layout.tsx                    # Acceso del módulo
├── page.tsx                      # Lista de citas
├── nuevo/page.tsx                # Nueva cita
├── [id]/page.tsx                 # Abrir una cita guardada
├── list.config.ts                # Columnas y orden inicial
├── agenda.ts                     # Días del consultorio y presentación de fechas
├── views/AppointmentList.tsx     # ListView y badges de seguimiento
├── views/AppointmentForm.tsx     # FormView, Fields y tratamientos en tabla
├── views/PatientHistory.tsx      # Historial de consulta, paginado
├── actions/appointment.actions.ts # Entradas del servidor: abrir, guardar, historial
├── models/appointment.ts         # Select, DTO y escrituras anidadas del servidor
├── models/appointment.service.ts # Permisos, transacciones, revisiones e historial
├── models/appointment.list.ts    # Consulta clínica de la lista y sus filtros
├── models/access.ts              # Revalidación compartida de permisos clínicos
├── models/treatment.ts           # Plan de líneas y select/DTO del historial
├── schemas/appointment.schema.ts # Validación del padre y su colección completa
├── schemas/history.schema.ts     # Paciente y paginación permitida del historial
└── schemas/treatment.schema.ts   # Validación y valores iniciales de cada línea
```

El módulo aparece a administradores en `/erp`. Su acceso inicial es `admin`, hasta
definir los roles del consultorio. Todas las acciones comprueban esos permisos en
servidor y el servicio los revalida en su transacción; proteger un layout no autoriza
consultas ni escrituras.
Los datos clínicos no deben añadirse a los DTO públicos de Contactos o búsquedas
relacionales generales.

## Cómo se guarda una cita

| Campo Prisma | Significado |
| --- | --- |
| `patientId` | Contacto que actúa como paciente en esta cita. |
| `patient` | Relación many2one con Partner. |
| `reason` | Motivo obligatorio, hasta 1000 caracteres. |
| `scheduledAt` | Instante de la cita, almacenado con zona horaria en PostgreSQL. |
| `observations` | Observaciones del odontólogo para esta cita; opcionales. |
| `status` | `SCHEDULED`, `ATTENDED` o `CANCELLED`; inicia como programada. |
| `createdAt` / `updatedAt` | Fechas de creación y revisión del registro. |

El nombre, teléfono y correo permanecen en Partner. El mismo paciente puede tener
muchas citas y cada cita apunta a un paciente. La relación usa `onDelete: Restrict`
para impedir que se elimine un contacto que tenga citas asociadas.

No se creó un segundo registro de paciente ni se copiaron los datos de contacto a
la cita. Más adelante se podrá añadir información propia del rol de paciente si el
consultorio la necesita.

## Del formulario a la base de datos

`appointment.schema.ts` exporta:

- `AppointmentInput`: datos de los controles, que pueden estar vacíos antes de validar.
- `AppointmentValues`: resultado válido; paciente, motivo y fecha/hora son requeridos.
- `newAppointmentDefaults`: paciente y fecha vacíos, observaciones vacías y estado Programada.
- `appointmentStatusOptions`: valores y etiquetas para FieldSelect/statebar.
- `treatments`: arreglo obligatorio, inicialmente vacío. La cita puede programarse sin tratamientos.

El modelo no impide registrar citas pasadas: esto permitirá cargar citas anteriores.
No se han definido todavía duración ni reglas de solapamiento de horarios.

El ID y la revisión se omiten/vacían al crear y se reciben del servidor al editar.
El contrato rechaza propiedades adicionales, modificaciones anidadas del paciente
y campos de credenciales/permisos.

`appointmentFormValues` convierte fechas de Prisma a ISO UTC y observaciones `null`
a texto vacío; incluye las líneas ordenadas. `appointmentCreateData` prepara una
cita nueva y sus tratamientos. `appointmentUpdateData` prepara los campos permitidos
y las altas, modificaciones y bajas de líneas. Los helpers no ejecutan consultas ni
autorizan operaciones por sí solos.

## Segundo paso: tratamientos e historial

La relación es `Partner → DentalAppointment → DentalTreatment`: el paciente tiene
muchas citas, y cada cita puede tener muchos tratamientos. No se duplica `patientId`
en las líneas. Así, dos citas del mismo paciente aportarán tratamientos a su historial.

| Campo de tratamiento | Significado |
| --- | --- |
| `appointmentId` | Cita propietaria; se deriva del padre en servidor. |
| `performedAt` | Fecha y hora en que se realizó; ISO UTC y `TIMESTAMPTZ(3)`. |
| `procedure` | Procedimiento obligatorio, hasta 1000 caracteres. |
| `observations` | Texto opcional, hasta 10000 caracteres en el contrato. |
| `position` | Posición del arreglo, calculada en servidor; conserva el orden de la tabla. |
| `createdAt` / `updatedAt` | Fechas del registro; no se aceptan desde el cliente. |

`createTreatment()` devuelve una fila nueva con fecha vacía, procedimiento vacío y
observaciones vacías. La fecha se elige explícitamente, porque puede registrarse
un procedimiento anterior; no se copia automáticamente la fecha de la cita.

El formulario enviará `treatments` como **colección completa**, con un máximo de
100 filas por cita, compatible con FieldOne2many. Las nuevas no llevan `id`; las
existentes conservan el suyo. Zod rechaza IDs duplicados, campos adicionales y
tratamientos existentes al crear una cita. El ID de la cita y el orden no se toman
de cada línea enviada.

`saveAppointmentRecord` valida el esquema y, dentro de una transacción Serializable:

1. Revalidar la sesión y leer la cita, su revisión y **todas** sus líneas.
2. Comparar la revisión del formulario y controlar conflictos de concurrencia.
3. Pasar las líneas leídas a `appointmentUpdateData(values, current.treatments)`.
4. Guardar padre y cambios anidados juntos, avanzando la revisión del padre.
5. Devolver el DTO completo para que FormView haga `reset` con los IDs del servidor.

El plan reutiliza `planOne2manyChanges` y rechaza IDs ajenos o que ya no existen.
Las escrituras anidadas mantienen las operaciones bajo la cita propietaria. Una línea
omitida significa baja; `[]` significa quitar todas las líneas de esa cita. Por eso
no debe enviarse una colección paginada, filtrada o incompleta como formulario de edición.
La baja sólo ocurre al guardar; quitar una fila en la interfaz es reversible.

La clave foránea usa `onDelete: Restrict`: no se puede borrar una cita que conserve
tratamientos. No se ha creado ninguna acción de borrado de citas.

`treatmentHistorySelect`, `treatmentHistoryOrder` y `treatmentHistoryValues` preparan
una consulta ordenada por fecha de realización descendente y una respuesta serializable
con la referencia de la cita. El servicio filtra por `appointment: { patientId }` y
exige autorización clínica antes de consultar. Estos datos no se incorporan a
Contactos ni al lookup genérico. La pestaña de historial lo consulta sin modificar
las líneas editables ni marcar el formulario como modificado.

## Tercer paso: operaciones del servidor

Las vistas usarán estas funciones de `actions/appointment.actions.ts`:

| Acción | Uso |
| --- | --- |
| `readAppointment(id)` | Abrir la cita con todas sus líneas y su revisión. Compatible con FormViewLoader. |
| `saveAppointment(values)` | Crear o editar la cita, incluyendo estado y colección completa de tratamientos. |
| `readPatientHistory({ patientId, page?, pageSize? })` | Consultar tratamientos de todas las citas de ese paciente. |

No se envía el usuario ni sus permisos desde el formulario. Cada acción obtiene la
cuenta con `requireAdmin`; el servicio vuelve a consultar `active`, `isAdmin` y
`sessionVersion` dentro de la transacción. Una sesión revocada o una cuenta sin
permisos no puede leer datos clínicos ni guardar.

El guardado comprueba que exista el paciente, valida que los IDs de líneas pertenezcan
a la cita y compara `revision` con `updatedAt`. La actualización también condiciona
la escritura a esa revisión. Un conflicto de Prisma por escrituras simultáneas se
traduce al aviso «La cita cambió desde que la abriste…», sin reintentar con datos antiguos.
La revisión avanza incluso si sólo se modifican líneas o ambas ediciones ocurren
en el mismo milisegundo.

Los estados Programada, Atendida y Cancelada se guardan junto con el resto del
formulario: no hay una acción separada que cambie el estado y descarte cambios
pendientes. No se añadieron transiciones obligatorias ni cambios automáticos de estado.

El resultado de guardar es `{ ok: true, values, message }` con el DTO completo e
IDs persistidos. FormView podrá hacer `reset(values)`. Un rechazo de datos devuelve
`kind: "validation"` y, cuando corresponde, `fieldErrors`, por ejemplo
`treatments.0.procedure`; un error de sesión/servidor usa `kind: "server"`.
La acción invalida las rutas bajo `/erp/citas` tras guardar.

El historial devuelve `{ ok: true, values: { patient, rows, total, page, pageSize,
pageCount } }`. Usa 10 filas por defecto, acepta entre 1 y 50, ordena por fecha de
realización descendente y usa el ID para desempatar. Si se pide una página más allá
de la última, devuelve la última disponible. Un paciente sin tratamientos tiene
`rows: []`, `total: 0` y página 1. La paginación es de consulta; nunca se debe usar
esa página como colección editable de tratamientos de la cita.

Las lecturas usan RepeatableRead para obtener datos, totales y permisos de una misma
instantánea. Los servicios sólo devuelven los campos seleccionados y fechas ISO UTC.
Las operaciones y vistas no requieren cambios del modelo ni una migración adicional.

## Cuarto paso: usar las vistas

1. Registra el paciente en **Contactos**, con nombre, teléfono y correo.
2. En **Citas odontológicas**, pulsa **Nueva cita** y selecciónalo. El selector admite
   búsqueda por nombre, teléfono o correo; no crea contactos al escribir.
3. Completa motivo y fecha/hora. Puedes guardar sin tratamientos para agendar la visita.
4. Al atenderlo, añade filas en **Tratamientos**, con fecha/hora, procedimiento y notas.
   Se editan en la misma tabla; puedes quitar o reordenar filas antes de guardar.
5. Cambia el statebar a **Atendida** y guarda. El estado también participa en `isDirty`.
6. Consulta **Historial del paciente** para ver los tratamientos guardados de todas sus
   citas, con cinco por página. Se carga al abrir la pestaña y se actualiza tras guardar.

Las observaciones generales de la cita tienen su propia pestaña. Guardar devuelve
IDs persistidos y limpia los cambios pendientes; Revertir restaura también las líneas.
Salir, abrir otra cita o registrar un contacto activa la protección de cambios pendientes.
El engrane permite **Recargar registro**, también protegido; **Nueva cita** abre un
formulario limpio desde un registro existente.

La lista ocupa la altura disponible y su tabla tiene scroll; el formulario conserva
su ancho máximo y altura de contenido. En móvil los grupos y las líneas se apilan.
Los filtros se abren desde los encabezados de Paciente, Teléfono, Fecha/hora y Motivo.
El estado es ordenable, sin filtro textual por ser un enum. Los filtros, orden y página
se conservan al abrir un registro y volver mediante el enlace superior.

La lista usa el registro genérico `dentalAppointment`, pero su consulta está dentro
del módulo y revalida permisos de administrador/sesión dentro de la transacción.
No devuelve observaciones ni tratamientos completos. `renderCell` de ListView permite
personalizar badges y fechas desde un componente cliente; no viaja al servidor ni
modifica las columnas permitidas para consultas.

## Quinto paso: días de agenda

`appointmentAgenda` compara **días de calendario** en `dentalClinicTimeZone`:
**Faltan X días**, **Hoy** o **X días de atraso**. Una cita de ayer aparece atrasada
aunque hayan pasado menos de 24 horas. Atendidas y canceladas muestran su estado.
El indicador se calcula al consultar/actualizar la lista, sin temporizador adicional.

## Fechas y zona horaria

La cita viaja como ISO UTC con `Z`, por ejemplo `2026-11-06T15:00:00.000Z`.
`scheduled_at` usa PostgreSQL `TIMESTAMPTZ(3)`. La configuración del consultorio
está en `settings.ts`; inicialmente es `America/Mexico_City`. La lista usa
esa zona para determinar el día del consultorio, en lugar de depender del navegador
de quien consulte. La lista y el historial presentan fechas en esa zona. FieldDate
captura horas locales del navegador y las convierte a ISO UTC. Los filtros de día
completo conservan el comportamiento compartido de ListView: usan la zona del navegador,
indicada en el control del filtro.

Las conexiones compartidas de Prisma fijan `TimeZone=UTC`, preservando los demás
parámetros de conexión. Es una medida para el comportamiento de fechas del adaptador
pg instalado; la [incidencia de Prisma](https://github.com/prisma/orm/issues/28629)
describe el problema con sesiones PostgreSQL que usan otra zona. La prueba de
integración comprueba el ISO y el instante real en SQL, incluso si la URL solicita
otra zona de conexión. Esta configuración no modifica la zona del consultorio.

## Cómo seguimos la guía

1. **Cita y paciente:** modelo, relación, estados y contrato de datos. Completado.
2. **Tratamientos:** modelo, contrato, plan de guardado y base de historial por paciente. Completado.
3. **Operaciones:** abrir, crear, guardar, cambiar estados e historial paginado con permisos y concurrencia. Completado.
4. **Vistas:** lista, formulario y edición de tratamientos sobre la tabla. Completado.
5. **Indicador de agenda:** faltan X días, Hoy o X días de atraso, según estado y zona del consultorio. Completado.

## Verificación y despliegue

La migración `dental_appointments` crea la tabla, enum, índices y la clave foránea.
Está aplicada en la base local y Prisma Client está regenerado. En otro entorno,
aplicar las migraciones con `npm run db:deploy` antes de publicar la versión.
La migración `dental_treatments` también está aplicada: añade la tabla de líneas,
sus índices y la clave foránea, sin modificar los datos existentes.

```sh
npm run test:appointments
npm run test:applications
# Requiere la base local; usa paciente, citas y tratamientos temporales y los elimina:
npm run test:appointments:integration
npm run test:appointments:service
```

La integración verifica altas, cambios, bajas, orden de filas, historial entre dos
citas, aislamiento de líneas ajenas y rollback de un cambio anidado inválido.
La prueba de servicios añade permisos, sesión revocada, validación con rutas de error,
guardados simultáneos, avance de revisión al editar líneas y paginación aislada por paciente.
También verifica la consulta de lista con filtros temporales/relacionales y permisos.
Las pruebas unitarias cubren medianoche en México, cambios de mes/año y años bisiestos.
