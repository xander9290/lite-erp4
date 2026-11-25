# Pantallas nombradas por modelo

Estado: primera versión implementada el 2026-11-25. Contrato vigente, decisiones
tomadas (404 para IDs desconocidos, precedencia de defaults, pantalla default para
relaciones) y límites en [Pantallas nombradas](../pantallas-modelos.md). Este
documento conserva el diseño y los criterios originales; la sintaxis de abajo ya
coincide con la API, salvo que `list.fields` sigue siendo del modelo. Avance en
[continuidad](../estado-proyecto.md).

## Motivo y separación

Un mismo modelo necesita varias pantallas: por ejemplo, Contactos y Direcciones
sobre Partner, cada una con listas, tarjetas y formularios diferentes. Hoy sólo
hay una vista registrada por tipo en el modelo y un dominio principal compartido.
No duplicar el modelo ni sus validaciones para conseguir esas variantes.

Tomar de Odoo la separación funcional entre modelo, presentación y navegación,
adaptándola a TypeScript/TSX. Primera versión: la pantalla reúne configuración de
navegación; no añadir todavía una capa separada de acciones de navegación. Los
métodos de negocio con @action conservan su significado e implementación.

- Modelo: datos, reglas, servicios, publicación de campos y permisos.
- Pantalla: ID estable, etiqueta, dominio servidor, defaults de creación,
  presentación inicial y mapa views con list/card/kanban/form/modal.
- Menú: referencia a modelo + pantalla, sin duplicar dominio ni componentes.
- Vista TSX: columnas o controles elegidos dentro del contrato autorizado.

Usar un objeto screens indexado por ID, en vez de un array con viewName. Separar
screen (grupo de presentaciones) de view (list/card/kanban seleccionada). Loaders
siempre diferidos; no importar estáticamente React/vistas desde el manifest.

## Sintaxis ilustrativa, no implementada

```ts
partner: {
  model: Partner,
  // Conservar aquí la política list.fields del modelo.
  defaultScreen: "contacts",
  screens: {
    contacts: {
      label: "Contactos",
      view: "card",
      domain: d => d.eq("type", "contact"),
      defaults: { type: "contact" },
      views: {
        card: () => import("./views/PartnerCard"),
        list: true,
        form: () => import("./views/PartnerForm"),
        modal: () => import("./views/PartnerModal"),
      },
    },
    addresses: {
      label: "Direcciones",
      view: "list",
      domain: d => d.in("type", ["delivery", "invoice"]),
      defaults: { type: "delivery" },
      views: {
        list: () => import("./views/AddressList"),
        form: () => import("./views/AddressForm"),
        modal: () => import("./views/PartnerModal"),
      },
    },
  },
},
```

Los archivos AddressList/AddressForm son ejemplos futuros, no fuentes existentes.
La declaración de menús propuesta sería:

```ts
menu: {
  Contactos: { model: "partner", screen: "contacts" },
  Direcciones: { model: "partner", screen: "addresses" },
},
```

Se prefiere una referencia validada/tipada por ID frente a autorreferenciar
models.partner.screens dentro del mismo literal. Los nombres finales y la forma
de convivencia entre opciones nuevas/actuales se concretarán al implementar.

## Alcance inicial y criterios de aceptación

1. Contrato de manifest y compilación: validar IDs, modelos, referencias de menú,
   pantalla por defecto, loaders y presentación inicial disponible. Buscar tipado
   y autocompletado de las referencias, conservando validación del registro.
2. Compatibilidad: los manifests actuales con views/view/domain continúan como
   pantalla default implícita; los menús por string y agrupaciones actuales siguen
   funcionando. Rechazar mezclas ambiguas; no regenerar vistas personalizadas.
3. Navegación: resolver una identidad estable de pantalla en servidor y conservarla
   al cambiar list/card/kanban, crear, abrir, guardar, recargar y volver. Ejemplo de
   URL por evaluar: ?screen=addresses&view=list. Conservar returnTo seguro y guards.
   No cargar rutas/imports arbitrarios desde la URL. Definir el manejo de IDs de
   pantalla desconocidos o inaccesibles antes de cerrar ese contrato.
4. Fuente: el dominio pertenece a la pantalla seleccionada y se aplica en servidor
   a filtros, conteos, páginas, grupos y Kanban. No sustituye autorización ni reglas
   de registro. La corrección actual de consultas readonly conserva su alcance:
   childIds se vincula por inverse/padre y no hereda accidentalmente el dominio de
   la pantalla principal. Un cambio de pantalla no amplía permisos de datos.
5. Defaults: sólo propuestas para creación de campos admitidos, con validación
   servidor. Editar carga datos guardados; el navegador no decide actor/permisos,
   dominios o fuentes ejecutables. Concretar precedencia entre defaults de pantalla,
   inversa de una colección y propuestas explícitas de apertura.
6. Presentación: cada pantalla elige componentes; form y modal resuelven su layout
   dentro de esa pantalla, con fallback modal → form. Compartir el modelo mantiene
   validaciones, required, hooks, concurrencia e historial; ocultar un control no
   elimina su regla de negocio. No ampliar los límites/publicación de list.fields
   para satisfacer una vista ni introducir publicación por pantalla implícitamente.
7. Formularios modales y colecciones: preservar la pantalla de origen/retorno y
   decidir explícitamente qué pantalla usa el destino relacionado; no heredar por
   accidente la pantalla del padre. Conservar guardado independiente y borradores.
8. Consumidores/herramientas: adaptar registro, menús, rutas, ModelCollection,
   formularios/slots, generadores y eject:view donde corresponda, conservando los
   comandos actuales. Documentar la selección de pantalla al expulsar una vista.
9. Verificación: fixtures independientes de Directorio; pruebas de compatibilidad,
   dos pantallas del mismo modelo, dominios aislados, defaults, formularios distintos,
   retorno correcto, modal y restricciones de permisos/campos. Después probar el
   caso real Contactos/Direcciones sin duplicar entidades ni consultar BD para tests
   unitarios. Sin migración de datos por esta función en sí misma.

## Punto de partida y límites

Rama de referencia al guardar: codex/partner, HEAD 4821b76 con cambios locales de
la guía de Otras direcciones y la separación del dominio principal/childIds.
La guía está cerrada; conservar esas ediciones. El manifest real aún usa la API
plana y domain type=contact; no contiene screens/defaultScreen ni menús screen.

La primera implementación se limita a pantallas nombradas y su navegación. No
iniciar acciones de navegación independientes, nuevos permisos por pantalla,
otro diseñador de vistas, XML, duplicación de modelos ni cambios de BD por guardar
esta propuesta. La solicitud actual sólo fija el siguiente pendiente.
