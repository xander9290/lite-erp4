# Sugerencias de Django para el framework

Fecha: 2026-11-23. Registradas a petición del usuario como sugerencias para evaluar;
no son implementaciones ni tareas activas. Adoptar sólo lo que resuelva necesidades
del ecosistema Next.js, React, TypeScript y Prisma, conservando TSX explícito,
servicios autorizados y transacciones. No requieren una refactorización general.

## Chequeos del proyecto

Inspiración: [System checks](https://docs.djangoproject.com/en/6.0/topics/checks/).
Evaluar un comando de diagnóstico que reúna validaciones ya existentes para
detectar referencias generadas desactualizadas, campos no publicados en vistas,
inserciones inválidas y conflictos entre módulos. Los problemas recientes de
publicación de campos y acciones justifican estudiarlo primero entre estas ideas;
esta recomendación no cambia las prioridades acordadas de implementación.

Criterio de aceptación: reutilizar validadores, informar ubicación y corrección
sugerida, distinguir errores de avisos y permitir revisión sin escrituras ni BD
cuando sea posible. Delimitar qué TSX se puede comprobar estáticamente sin prometer
análisis completo de vistas dinámicas ni duplicar TypeScript/ESLint.

## Operaciones después del commit

Inspiración: [on_commit](https://docs.djangoproject.com/en/6.0/topics/db/transactions/#performing-actions-after-commit).
Retomar cuando exista una necesidad real de correos, notificaciones o integraciones.
Separar los efectos externos de los hooks que deben permanecer dentro de la
transacción; un rollback no debe enviar un aviso de guardado exitoso.

Criterio de aceptación: definir orden, fallos y respuesta al usuario después del
commit, sin presentar un fallo externo como rollback de datos ya guardados.
Un callback en memoria no garantiza entrega ante caída del proceso: si el caso
exige entrega fiable, diseñar una bandeja transaccional persistente, idempotencia
y reintentos explícitos. No sustituir indiscriminadamente los hooks actuales.

## Consultas de negocio reutilizables

Inspiración: [Managers y QuerySets](https://docs.djangoproject.com/en/6.0/topics/db/managers/).
Evaluar funciones tipadas sobre Prisma y los servicios actuales cuando consultas
como contactos activos o documentos vencidos se repitan en consumidores reales.

Criterio de aceptación: reducir repetición comprobada, conservar contexto
transaccional, autorización, reglas de registro y proyecciones explícitas.
No introducir otro ORM, consultas perezosas ni filtros implícitos que oculten datos.
Complementa la [sugerencia sobre lecturas relacionales](rutas-reads.md), sin
reactivarla ni sustituir las consultas explícitas vigentes.

## Comandos propios de cada módulo

Inspiración: [Management commands](https://docs.djangoproject.com/en/6.0/howto/custom-management-commands/).
Evaluar un mecanismo para publicar tareas de mantenimiento, conciliación o
importación cuando una aplicación necesite un comando concreto.

Criterio de aceptación: argumentos tipados y validados, ayuda y errores uniformes,
identidad/contexto de ejecución explícitos y reutilización de servicios autorizados.
Definir límites de transacción y colisiones de nombres; ofrecer simulación cuando
el tipo de operación lo permita. No crear scripts que omitan reglas del servidor.

## Aplicaciones distribuibles

Inspiración: [Aplicaciones reutilizables](https://docs.djangoproject.com/en/6.0/intro/reusable-apps/).
Usar esa referencia para enriquecer el pendiente ya existente de distribución entre
proyectos, sin crear una segunda estrategia ni adelantar el empaquetado npm.

Alcance y aceptación continúan en [Módulos distribuibles](modulos-distribuibles.md):
compatibilidad, dependencias, extracción segura y migraciones propias del destino;
sin trasladar secretos, datos del ERP ni historial de migraciones.

## Al retomarlas

Contrastar cada sugerencia con el código vigente y un caso real. Presentar el
alcance concreto antes de implementar. Esta nota sólo registra propuestas:
no modifica APIs, permisos, configuración, base de datos ni aplicaciones.
