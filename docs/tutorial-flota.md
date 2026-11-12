# Flota: nueva tutoría

Punto de partida actualizado el 2026-11-12. La aplicación anterior se retiró por
petición del usuario, incluidos sus datos locales. El framework compartido y las
demos permanecen disponibles. Las migraciones anteriores se conservan como
historial; no se hace reset de toda la base.

El usuario ejecuta los ejercicios. Explicar y comprobar un paso cada vez, sin
generar por adelantado modelos, relaciones, vistas ni reglas de negocio.

## Primer paso pendiente

```bash
npm run create:app -- Flota --dry-run
```

Revisar juntos los archivos propuestos. Este comando sólo muestra el plan; todavía
no se ha recreado la aplicación. Después se podrá ejecutar `create:app -- Flota`
y recorrer su manifest, modelo inicial, contrato cliente, vistas y servicio.

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
