# Estado del proyecto

Última actualización: 2026-11-10.

Documento de continuidad entre agentes y máquinas. Leer primero [AGENTS.md](../AGENTS.md)
y [README](../README.md); contrastar este resumen con Git y el código relevante.
Actualizar el estado vigente, evitando acumular una transcripción de sesiones.

## Dirección y funcionalidades

- Framework ERP en TypeScript, Next.js, React, Prisma 7 y PostgreSQL.
  Modelos/Fields declarativos, contratos Zod, vistas TSX editables y herramientas
  para crear aplicaciones, generar contratos, instalar esquemas y enlazar Prisma.
  Procedimiento y límites en [Flujo del framework](flujo-framework.md).
- Aplicaciones con manifest, dependencias y menús de navegación; servicios con
  autorización, validación, transacciones, concurrencia y hooks de negocio.
  Contactos, Usuarios, Citas y Flota aportan casos reales con alcances distintos;
  no asumir que todos usan el mismo adaptador o política de acceso.
- ListView con selección y eliminación por lote desde «Acciones»; dominios fijos
  de servidor combinados con filtros visibles. Los dominios filtran consultas y
  no sustituyen reglas de acceso. Ver [Dominios](dominios-listas.md).
- Auditoría de creador/fechas separada de los valores editables del formulario.
  Ver [Auditoría](auditoria-modelos.md).
- Empaquetar como dependencia npm es una meta futura, conservando Next.js y Prisma.
  Primero madurar contratos y aplicaciones. Ver [Idea y alcance](ideas/aplicaciones-modulares.md).

## Tutoría de Flota

El usuario ejecuta los ejercicios; el agente explica y verifica sin editar su
aplicación por adelantado. Guía: [README de Flota](../src/app/(auth)/erp/flota/README.md).

- Modelo actual con `name`, `plate`, `brand` opcional y `active`, más auditoría.
  La instalación, migraciones y enlace de Prisma se realizaron durante la tutoría
  en la máquina original; comprobar el entorno local al cambiar de máquina.
- `beforeSave` convierte placas a mayúsculas, exige marca para vehículos activos
  y requiere desactivar y guardar antes de cambiar las placas de un vehículo activo.
  La prueba temporal de rollback de `afterSave` permanece comentada.
- El código contiene las listas general, «Mis vehículos» y «Mis vehículos activos».
  Esta última combina `createBy = actor.id` AND `active = true`.
  En esta actualización se inspeccionaron dominio, Server Actions, variante de
  RecordList, página y entrada del dropdown: todos están presentes.
- Pendiente: confirmación funcional del usuario de «Mis vehículos activos».
  No dar por realizada esa prueba sólo porque exista el código.

## Siguiente paso concreto

Retomar con la prueba de la nueva vista: comparar las tres listas, filtrar por
placas y limpiar filtros; el dominio debe mantenerse. `Activo = No` debe devolver
cero registros en «Mis vehículos activos». Registros ajenos o con creador nulo
deben quedar fuera. Conservar permisos admin y personalizaciones del usuario.

## Último trabajo y verificaciones

- Documentadas la maduración continua, la detección de verbosidad y la futura
  distribución npm. Añadido el protocolo de continuidad y este documento;
  corregido el estado obsoleto del ejercicio de dominios en las instrucciones y
  el README de Flota.
- Alcance de esta tarea: documentación e inspección de los archivos citados.
  Verificación: `git diff --check`. No se ejecutaron pruebas funcionales, consultas
  a la base, migraciones ni cambios de código en esta tarea.
- AGENTS.md recoge verificaciones históricas del framework. No equivalen a una
  ejecución nueva sobre el checkout actual. Comandos disponibles en el README.
- El estado del servidor dev y de la base local no se verificó en esta tarea.

## Oportunidades de mejora pendientes

- Evaluar si declarar nuevas listas con dominio requiere demasiados cambios entre
  servicio, acción, variante, página y menú. Motivo: el ejercicio muestra pasos
  repetitivos. Criterio de aceptación: reducir código o pasos conservando TSX
  editable, autorización de servidor, tipado, manejo de errores y personalizaciones.
  Es una oportunidad por estudiar; no hay una API nueva decidida ni implementada.

## Mantenimiento

Al cerrar una tarea, actualizar lo completado, evidencia de comprobación, pendientes
y siguiente paso; trasladar decisiones duraderas a AGENTS.md y detalles a sus guías.
Compartir estos archivos junto con el código mediante Git cuando el usuario lo
indique. No copiar secretos, datos del ERP ni identificadores de procesos locales.
