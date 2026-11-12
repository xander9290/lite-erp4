# Reacciones de formulario y posibles decoradores

Análisis del 2026-11-11, solicitado por el usuario. Actualización posterior:
implementado un primer alcance de registro explícito, @onchange, @constraint,
@displayName y @depends de lectura; [API y límites](../reacciones-modelos.md).
Este documento conserva el análisis previo como antecedente. El registro explícito,
el motor y los cuatro decoradores descritos ya están disponibles en el primer alcance;
los cálculos persistidos y @action siguen como propuestas. Para el contrato vigente
usar la guía enlazada, no las sintaxis ilustrativas de este análisis.

## Qué se observó al analizar (estado previo a la implementación)

- `src/lib/orm/model.ts` reconoce Fields, displayFields y métodos de ciclo de vida.
  `defineModel` valida y congela el contrato. Un objeto `onchange` añadido hoy a una
  clase sería rechazado como dato que no fue declarado con Fields.
- `src/lib/orm/service.ts` concentra sesión/admin, revisión, normalización, Zod,
  hooks, guardado e historial dentro de la transacción. Un decorador no debe
  sustituir ni duplicar este circuito.
- `createQueryActions` ya reduce wrappers y conserva exports async explícitos en
  módulos use-server. No hace falta un decorador sólo para renombrar ese helper.
- `withDisplayName` ya comprueba rutas/dependencias y aporta inferencia de tipos.
  Una alternativa debe conservar esa comprobación, nulabilidad y proyección.
- `FormLayout`/`FormView` y recordUI heredan presentación desde el contrato cliente;
  no importan clases del servidor. Los eventos del navegador requieren un puente
  autorizado; el decorador por sí solo no establece esa comunicación.
- tsconfig no habilita decoradores legacy. La compatibilidad de la modalidad que
  se elija con TypeScript, tsx de los CLI, Turbopack, build y herencia no está
  comprobada en esta tarea. No añadir flags o dependencias por anticipado.

## Procesos candidatos, en orden de utilidad

Las sintaxis siguientes son ilustrativas, no APIs disponibles.

| Proceso | Posible sintaxis | Repetición que puede reducir | Decisión |
| --- | --- | --- | --- |
| Reaccionar a campos del borrador | `@onchange("name")` | useWatch/callbacks, petición, control de respuestas y aplicación de patch repetidos en formularios | Primer candidato, después del motor explícito. |
| Restricciones entre campos | `@constraint("start", "end")` | Condiciones independientes acumuladas en beforeSave, con errores por campo | Segundo candidato; requiere primero un registro de reglas explícito. |
| Nombre de presentación | `@displayName("plate", "modelo.name")` | Separación entre dependencias y método que construye la etiqueta | Comparar con withDisplayName; conservar el helper si proporciona mejor tipado. |
| Cálculos de lectura o de borrador | `@depends("quantity", "price")` | Wiring repetido para recalcular valores derivados | Posterior: necesita un contrato de cálculo y dependencias, no sólo sintaxis. |
| Comandos de negocio | `@action({id:"confirm", ...})` | Registro repetido de métodos de confirmar/cancelar y su conexión a acciones | Posterior, cuando existan varios casos reales; exposición, permisos y transacciones siempre explícitos. |

### Restricciones de negocio

Separar métodos como validarFechas y validarEstado puede mejorar clases con muchas
reglas. Un registro explícito debe fijar su ejecución después de normalize,
beforeSave y la revalidación Zod, antes de escribir, en la misma transacción.
La primera versión debería ejecutar todas las reglas al guardar; las dependencias
servirían para diagnóstico, sin omitir reglas por una optimización prematura.
Devolver errores mediante ModelValidationError/fieldErrors, conservar borradores
y ejecutar las mismas reglas desde guardado y kanban. Las restricciones de BD
siguen siendo necesarias para unicidad y concurrencia.

Registrar una regla no crea una validación remota disponible al público ni cambia
los permisos de read/save. Resolver herencia, overrides y orden determinista antes
de permitir múltiples métodos; evitar ejecutar una regla dos veces.

### Campos derivados

Distinguir tres contratos: presentación de lectura (avatar del fabricante),
valor temporal del borrador y valor persistido calculado por el servidor. No
convertir automáticamente un cálculo de pantalla en otra columna Prisma.
Los cálculos persistidos necesitan reglas de actualización cuando cambian registros
relacionados: guardar sólo Vehicle no detecta cambios posteriores en Fabricante.
Un decorador no resuelve esas dependencias, su invalidación ni las migraciones.

Los valores derivados del guardado deben calcularse en servidor aunque la UI los
haya sugerido. Inicialmente mantener beforeSave para asegurar ese resultado.

### Acciones de negocio

Puede resultar útil registrar confirmar/cancelar con sus contratos de entrada,
operaciones permitidas y validación de revisión. No exponer métodos por el nombre
recibido del navegador, ni convertir todos los métodos decorados en endpoints.
Una acción requiere una autorización real del servidor y un contrato por operación;
no asumir que @action concede acceso. Mantener los exports async de Next y su
invalidación explícita mientras no exista un generador que preserve sus requisitos.
No usar esta propuesta como una autorización para reestructurar acciones actuales.

## Qué conservaría sin decoradores

- Fields.Text/Many2one/Image: ya describen tipo, opciones y valores en una línea y
  permiten inferir Prisma/Zod/tipos. @field, @required o @tracked duplicarían esa
  declaración y pueden separar información que hoy se mantiene junta.
- normalize, beforeSave y afterSave: sus nombres ya indican cuándo corren; un
  decorador sin múltiples métodos o composición probada aporta poco.
- Permisos y transacciones: el servicio ya impone sus límites. @adminOnly o
  @transaction no debe ocultar comprobaciones dentro de SQL ni permitir eludirlas.
- Cachés: no introducir @cache en consultas con sesión/borradores; clave, alcance e
  invalidación deben definirse y probarse primero. Nunca cachear por modelo sin actor.
- Efectos externos: afterSave ocurre antes del commit. No disfrazarlo de afterCommit
  con un decorador; una futura cola/outbox necesita otro contrato y manejo de fallos.
- Diseño de vistas y menús: conservar TSX y manifests explícitos; no inferir permisos
  ni construir pantallas automáticamente desde decoradores.

## Primer motor explícito de onchange

Caso piloto: seleccionar FlotaModelo desde `FlotaVehicle.name`, consultar su
fabricante y sugerir el valor al borrador. El campo actual se llama name y guarda
un ID; no renombrarlo como parte del experimento. Añadir fabricanteId almacenado
es una decisión independiente porque duplica una relación derivable. El avatar
puede permanecer como presentación de lectura, con DTO propio; no hay actualmente
un modo display en FieldImage que admita un value independiente de RHF.

El registro deberá declarar disparadores, dependencias de entrada, método y campos
de salida permitidos; un string de método sin whitelist de salida no basta.
El decorador futuro deberá producir exactamente ese mismo registro, una sola vez
al construir el modelo. No envolver cada llamada con otro transporte o autorización.

Flujo propuesto:

1. El formulario registra un cambio relevante y envía una petición acotada a una
   acción fija de esa aplicación/modelo. No enviar DOM events, tx, métodos libres,
   campos sensibles, where ni una selección arbitraria de datos relacionados.
2. Autorizar sesión, revalidar actor en la transacción y aplicar los permisos sobre
   el registro y los destinos consultados. Un ID/revisión recibido no prueba acceso.
3. Validar una proyección estricta del borrador: puede haber otros campos obligatorios
   todavía vacíos. No usar sin más el schema completo de save, ni aceptar cualquier
   campo sólo por ser un borrador. Límites de tamaño y tipos en cada petición.
4. Ejecutar sólo el handler registrado y consultas permitidas, sin guardar el borrador.
   Considerar transacción PostgreSQL read-only como protección de BD; una interfaz
   TS readonly por sí sola no impide escrituras. Ninguna de ellas aísla efectos
   externos que el código local intente realizar: eso sigue siendo un contrato
   de los handlers, no una promesa de sandbox.
5. Validar el patch contra campos de salida publicados/editables y sus schemas.
   Excluir id, revision, auditoría, permisos y campos sensibles. Los datos de preview
   requieren un DTO separado y autorizado, sin mezclarlos con values/Zod/RHF.
6. Aplicar sólo una respuesta vigente para ese formulario/registro/dependencias;
   ignorar respuestas anteriores y evitar sobrescribir un campo editado desde la
   petición. Marcar cambios del borrador como pendientes de guardar y conservar
   errores/borradores si el servidor rechaza o la red falla.
7. Inicialmente no encadenar onchange automáticamente por patches del servidor.
   Definir por separado montaje, reset/revertir, edición del usuario y borrado de
   selección. Evitar bucles; cualquier cascada futura necesita límites y detección
   de ciclos. La normalización o la revalidación Zod no deben disparar eventos de UI.

Los métodos de onchange ayudan al usuario; las reglas definitivas permanecen en
save/beforeSave. Omitir la petición o manipular su respuesta no debe permitir
persistir combinaciones inválidas. Ni onchange ni un decorador autorizan por sí solos.

## Cómo evaluar función y rendimiento

No se midió rendimiento ni se comprobó soporte de decoradores en este análisis.
La hipótesis es que la sintaxis puede simplificar el registro, pero no elimina
peticiones HTTP, autorizaciones o consultas SQL; debe verificarse con datos.

Primero obtener una base con la implementación explícita y repetir el mismo caso
con el decorador, mismo dataset, misma máquina, consultas y comportamiento. Medir:

- Peticiones por selección y por ráfaga de escritura, distinguiendo valores vacíos,
  selección repetida, apertura de un registro y reset del formulario.
- Latencia cliente/servidor, p50/p95, consultas de negocio separadas de las de
  autorización y tiempo de transformación/validación del patch.
- Inicio/carga de módulos y coste de registrar metadatos; memoria en ejecuciones
  repetidas. Guardar sólo configuración inmutable, nunca actor ni borradores globales.
- Respuestas descartadas, errores, ausencia de bucles y número de renders relevantes.
  Para texto evaluar debounce configurable; no retrasar todas las relaciones sin
  medir la experiencia. Cancelar/ignorar una respuesta no garantiza cancelar trabajo SQL.
- Código real eliminado en aplicación frente al coste añadido en framework,
  tipado, diagnóstico, documentación y generadores.

Criterios para aceptar el decorador: mismo registro normalizado y mismas pruebas de
permisos/patch/integridad; ninguna petición o consulta adicional por su sintaxis;
comportamiento y distribución de latencias comparables bajo condiciones repetidas;
herencia sin duplicados, tipado conservado y compilación de todos los entry points.
Fijar umbrales numéricos después de medir la base; no inventar una mejora porcentual.

Pruebas funcionales mínimas del motor: usuario sin sesión/inactivo/sin permiso,
registro o relación inaccesible, handler/campo falsificado, borrador parcial,
patch no permitido, cambios A→B con respuestas invertidas, borrado de selección,
edición simultánea de un destino, reset/navegación, error/red caída y guardado
sin ejecutar onchange. Pruebas de negocio y concurrencia en datos temporales.

## Compatibilidad y secuencia

1. Motor y registro explícitos, bridge RHF, acción autorizada y caso piloto en
   fixtures/sample; no instalar columnas ni cambiar Flota por anticipado.
2. Medir utilidad/rendimiento y corregir verbosidad, errores o consultas redundantes.
3. Spike pequeño y aislado de decoradores: elegir modalidad, probar TypeScript,
   CLI tsx con react-server, generación, Turbopack dev/build y React Compiler.
   No depender de reflexión de tipos para sustituir Fields ni exponer metadata
   privada al cliente. No prometer inferencia sólo por decorar un método.
4. Si mejora el código, implementar @onchange como adaptador del registro existente;
   mantener la configuración explícita y diagnosticar registros duplicados.
5. Reconsiderar @constraint; después @displayName y cálculos. @action sólo con
   un contrato de comandos probado y varios ejemplos que justifiquen su coste.

Guías actuales: [Ciclo de modelos](../ciclo-modelos.md),
[Contratos de vistas](../contratos-vistas.md),
[Nombres de presentación](../nombres-presentacion.md).
