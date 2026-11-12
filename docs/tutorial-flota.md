# Flota: nueva tutoría

Punto de partida actualizado el 2026-11-12. La aplicación anterior se retiró por
petición del usuario, incluidos sus datos locales. El framework compartido y las
demos permanecen disponibles. Las migraciones anteriores se conservan como
historial; no se hace reset de toda la base.

El usuario ejecuta los ejercicios. Explicar y comprobar un paso cada vez, sin
generar por adelantado modelos, relaciones, vistas ni reglas de negocio.

## Avance actual

El usuario completó create:app -- Flota y retiró los menús/rutas activos y
mis-registros. Después ejecutó create:model -- flota Fabricante. Se verificaron
Fabricante.ts con name obligatorio (120, tracking) y active (true, tracking), su
publicación en clientFields y su registro en manifest. Después ejecutó create:views;
se verificaron la entrada Fabricantes en manifest y el README de lista/formulario.
Ya se verificó Fabricantes dentro del grupo Configuración del manifest y el registro
instalado de FlotaRecord/FlotaFabricante. El usuario compartió orm:sync exitoso y
confirmó guardar/reabrir un fabricante. Siguiente ejercicio:
El usuario ya creó Modelo; se verificaron su declaración inicial y registros.
Se verificó fabricanteId Many2one obligatorio a FlotaFabricante, con Restrict,
tracking y publicación en clientFields. Modelo ya tiene vistas/menú y artefactos
de sincronización; el usuario confirmó guardar/reabrir y validación de fabricante
obligatorio. El usuario eligió Vehicle y ya lo creó, con name Many2one obligatorio
a FlotaModelo (label Modelo, Restrict/tracking), active y clientFields name/active.
Se verificó sin modificar su aplicación; conservar su elección de usar name como FK.
Vehicle ya tiene vistas, menú principal y redirección raíz. El usuario completó
orm:sync y mostró un registro guardado. Por petición expresa se añadió
@displayName("nameRecord.name") y la metadata de lectura/guardado que alimenta su
breadcrumb. Más tarde el método vehicleLabel pasó a
@displayName("nameRecord.fabricante.name", "nameRecord.name") y produce
«Fabricante · Modelo». Después se unificó la presentación del framework en read/save, lookups
y colecciones; los formularios restantes de Flota ya consumen metadata. Los modelos
nuevos del scaffold nacen con displayName devolviendo name para personalizarlo.
Siguiente: verificar en Flota el nombre y su actualización tras guardar otro Modelo.
No añadir campos por anticipación.
El comando de
vistas de Fabricante completado fue:

```bash
npm run create:views -- flota Fabricante --label Fabricantes
```

Primero se preparan Fabricantes y Modelos bajo Configuración; después Vehículos,
con relaciones vehículo → modelo → fabricante. No añadir enlaces a rutas ausentes.

## Inicio del recorrido (completado)

```bash
npm run create:app -- Flota --dry-run
```

Este comando sólo muestra el plan. El usuario ejecutó después create:app -- Flota;
su manifest, modelo inicial, contrato cliente, vistas y servicio ya están presentes.

## Recorrido previsto

1. Crear y entender la aplicación mínima.
2. Declarar campos y reglas de negocio en el modelo del servidor.
3. Presentarlos en formularios y colecciones con los contratos del modelo.
4. Revisar y sincronizar la persistencia; probar el primer guardado.
5. Añadir otro modelo, relaciones, imágenes y related con un caso real.
6. Practicar cálculos, reacciones, agrupaciones y vistas alternativas a su ritmo.

Los pasos concretos se eligen con el usuario. No restaurar automáticamente los
modelos o las personalizaciones del ejercicio anterior.

Guías: [Crear aplicaciones](crear-aplicaciones.md),
[Modelos y vistas](modelos-y-vistas.md),
[Contratos de vistas](contratos-vistas.md) y
[Sincronizar aplicaciones](sincronizar-aplicaciones.md).
