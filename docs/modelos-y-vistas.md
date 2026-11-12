# Modelo primero, vistas después

La metodología conserva modelos y negocio en TypeScript, y vistas React editables.
El scaffold escribe las conexiones repetitivas una vez; no añade XML ni un motor
que renderice formularios automáticamente en producción.

## Recorrido habitual

En una aplicación existente, por ejemplo Flota:

```bash
npm run create:model -- flota Mantenimiento
```

Crea models/Mantenimiento.ts con la clase FlotaMantenimiento, campos iniciales
name/active y su defineModel. Registra el import y clientFields en orm.config.ts,
y el nombre del modelo en manifest.models. No crea tablas ni toca vistas existentes.

Después personaliza el modelo: campos, restricciones, normalize, beforeSave,
afterSave y displayName cuando corresponda. Mantén la publicación explícita en
clientFields y declara las dependencias de relaciones entre aplicaciones.

Cuando sus campos estén definidos:

```bash
npm run create:views -- flota Mantenimiento --label Mantenimientos
npm run orm:sync -- flota
```

create:views genera por defecto lista y formulario en página. orm:sync se encarga
de contratos, esquema, migraciones revisadas, cliente Prisma y bindings. Hasta
completar la sincronización, las rutas nuevas pueden tener imports de contratos o
bindings aún pendientes; no asumir que crear vistas habilita su persistencia.

El nombre puede ser Mantenimiento o FlotaMantenimiento; ambos resuelven el mismo
modelo registrado. Los nombres son PascalCase; el comando aplica el prefijo del
ID de aplicación y usa un segmento de ruta kebab-case, sin pluralizar por idioma.
En este ejemplo la colección abre en /erp/flota/mantenimiento.

## Qué archivos prepara create:views

- models/mantenimiento.service.ts: modelo, repositorio, columnas y autorización
  del servicio compartido, con auditoría y actividad.
- schemas/mantenimiento.schema.ts: reexports del contrato generado, sin duplicar
  Zod, tipos ni defaults.
- actions/mantenimiento.actions.ts: consultas con createQueryActions, y mutaciones
  con requireAdmin e invalidación explícita sólo tras éxito.
- views/mantenimiento.list.ts: columnas y búsquedas compartidas. Las opciones de
  Selection se leen del contrato cliente del modelo; formulario, filtros y kanban
  las reutilizan. La lista inicial publica hasta doce columnas y busca hasta seis
  Text; el formulario incorpora todos los campos publicados.
- Vistas TSX seleccionadas, formulario con RHF/Zod, loader, errores/reintentos,
  keys de navegación, Revertir, Nuevo, recarga protegida, historial y notas.
- Rutas de colección y, si se elige form, nuevo y [id]; menús dentro del manifest.
- Un README del recurso con sus vistas y siguiente paso.

Los exports internos son consistentes entre recursos (recordService, listRecords,
readRecord, saveRecord, lookupRecords…), separados por archivo. Los componentes
se nombran con el modelo, por ejemplo MantenimientoList y MantenimientoForm.
El formulario usa los Fields existentes para Text, Integer, Boolean, Selection,
DateTime y Many2one. DateTime conserva su contrato ISO UTC.
Image genera FieldImage que importa el uploader gestionado de
`src/generated/orm/uploads/<app>/<Modelo>.images.ts`, preparado por orm:sync o
orm:generate. La acción autoriza cada campo y la carpeta procede del contrato
Image del servidor, nunca del navegador. No necesita
--lookup ni configuración de callbacks. Las credenciales del servidor se
comprueban al solicitar la subida, no al generar fuentes. Ver
[Campos de imagen](ideas/campos-imagen.md).
Las columnas Image usan miniaturas en las tres colecciones. Sync actualiza
helpers/contratos, pero no inserta controles o columnas en vistas personalizadas.

## Elegir vistas y modo de formulario

```bash
# Tarjetas y formulario en página.
npm run create:views -- flota Mantenimiento --views card,form

# Colección en lista y formulario modal.
npm run create:views -- flota Mantenimiento --views list,form --form modal

# Lista, tarjetas, tablero y formulario.
npm run create:views -- flota Mantenimiento --views list,card,kanban,form --group state
```

Son alternativas para la primera generación de las vistas, no comandos que debas
ejecutar consecutivamente. La primera colección elegida ocupa la ruta base; las
demás usan /lista, /tarjetas o /tablero. Se preparan navegación y menús para ellas.
Se puede generar sólo una colección o sólo form. Modal requiere una colección
de fondo y form; conserva URL propia, loader y confirmación de cambios al cerrar,
incluido Escape. El cierre ejecuta la navegación dentro de useFormNavigation.run.

Kanban exige un Selection obligatorio de hasta doce opciones. El comando lo
detecta si sólo hay uno elegible; si hay varios, especifica --group. Configura el
servicio y usa sus operaciones kanban/move: revisiones, permisos y hooks permanecen
en la misma transacción. No inventa estados ni cambia el modelo para habilitarlo.
No crea orden manual de tarjetas ni relaciones nuevas.

## Many2one y privacidad

Para Partner y User reutiliza los proveedores manuales existentes y sus límites.
Para otra entidad debes elegir una Server Action de lookup autorizada:

```bash
npm run create:views -- flota Mantenimiento --lookup 'fabricanteId=@/app/(auth)/erp/flota/actions/fabricante.actions#lookupRecords'
```

El archivo y su export async nombrado deben existir en un módulo use-server.
El ejemplo supone que el proveedor ya fue preparado; su ubicación real puede ser
otra. No es una instrucción para renombrar las acciones actuales de la tutoría.
La acción generada lookupRecords del modelo relacionado publica ID/label usando
su displayName. La vista no duplica plantillas ni recibe modelos/where arbitrarios.
Las reglas que autorizan referencias al guardar siguen siendo responsabilidad del
servicio o negocio; un selector o dominio no concede permiso sobre una relación.

Las vistas iniciales requieren todos los campos declarados publicados y sin
sensitive. Si falta una publicación o hay datos privados, el comando rechaza el
scaffold; no amplíes la exposición sólo para superar ese rechazo. Usa contratos,
servicios y vistas propios para esos casos. No cambia la política admin por leer
otro access en el manifest, ni convierte todos los métodos del modelo en endpoints.

## Revisar y conservar personalizaciones

Ambos comandos admiten --dry-run:

```bash
npm run create:model -- flota Mantenimiento --dry-run
npm run create:views -- flota Mantenimiento --dry-run
```

El plan no escribe archivos ni aplica SQL. create:views necesita que el modelo
ya esté declarado y registrado. Los comandos reales tampoco ejecutan SQL ni
modifican hashes o registros gestionados del ORM/catálogo de aplicaciones.

Se editan únicamente arrays/objetos literales reconocibles de orm.config.ts y
manifest.ts, conservando imports, comentarios, exportaciones y menús existentes.
Configuraciones ambiguas, spreads, duplicados, colisiones, enlaces simbólicos y
archivos de destino existentes detienen el proceso antes de escribir. Los exports
de modelos existentes se respetan cuando están importados explícitamente en el
perfil desde un archivo local de models. No se adivinan convenciones personalizadas.

La generación es inicial, sin --force: después los archivos son tuyos. Elegir
otras vistas al repetir sobre un recurso existente no sustituye ni fusiona su
servicio/formulario. Para ampliar uno personalizado, compón sus vistas TSX a mano.
La práctica manual de Fabricante se retiró después a petición del usuario para
probar este flujo desde cero, con respaldo y migración inversa revisada; eso fue
una operación específica, no una opción --force ni un desinstalador genérico.

Hay preflight, lock compartido con create:app, staging y restauración ante fallos
ordinarios; una interrupción o restauración incompleta puede requerir revisión.
No ejecutar comandos de scaffold/sync en paralelo ni prometer atomicidad global.
Las pruebas usan recursos temporales, nunca datos reales de Flota.

Guías relacionadas: [Sincronizar](sincronizar-aplicaciones.md),
[Ciclo de modelos](ciclo-modelos.md), [Presentación](nombres-presentacion.md)
y [Vistas de colecciones](vistas-colecciones.md).


El contrato enlazado y las nuevas APIs de presentación se documentan en
[Contratos de vistas](contratos-vistas.md).
