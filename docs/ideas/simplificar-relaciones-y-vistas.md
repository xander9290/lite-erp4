# Simplificar el desarrollo de relaciones y vistas

Registrado el 2026-11-11 a petición del usuario. Estado: pendiente; estas propuestas
no están implementadas ni fijan todavía una API definitiva.

## Problema observado

Una relación declarativa se configura en varios lugares: Field del modelo,
proveedor `--lookup`, formulario y acciones de colección. Actualmente el scaffold
reutiliza el proveedor del formulario para lista/kanban, pero en vistas existentes
se debe conectar `resolveListLabels` explícitamente. Many2one y Selection comparten
presentación en las colecciones y grupos; esa mejora ya existe.

## Prioridad inicial

1. **Encontrar proveedores por convención.** Resolver el lookup autorizado del
   modelo destino declarativo sin exigir `--lookup` en el caso habitual.
   Conservar ese argumento como alternativa explícita para proveedores propios.
   Aceptación: una relación estándar genera vistas sin repetir su proveedor;
   ambigüedad o ausencia produce un diagnóstico claro. No inferir autorización
   por el nombre del modelo ni omitir las comprobaciones del servidor.

2. **Centralizar las etiquetas en el servicio.** Declarar los proveedores una
   sola vez y aplicarlos a lista, grupos, kanban y acciones con dominios propios,
   evitando wrappers repetidos de `resolveListLabels`.
   Aceptación: reducir configuración de los consumidores manteniendo cargas por
   lotes, IDs como claves, aislamiento entre usuarios, errores explícitos y
   políticas de autorización. Definir la consistencia transaccional de las
   etiquetas; hoy lista y lookup se consultan en transacciones separadas.

## Siguientes mejoras por evaluar

3. **Derivar presentación desde Fields.** Reutilizar widget Many2one y opciones
   Selection sin repetirlos en cada vista. Mantener TSX editable y permitir
   personalizar orden, etiquetas, tamaño, visibilidad y renderizado. Aceptación:
   reducir metadatos duplicados sin ampliar `clientFields`, exponer sensibles ni
   imponer un renderizador automático.

4. **Tipar las dependencias de displayName.** Validar rutas e inferir la forma
   del registro desde las dependencias y nulabilidad, evitando escribir ese tipo
   manualmente. Aceptación: detectar rutas inválidas y tipos desalineados en TS,
   conservar privacidad, método síncrono y proyección limitada. Abordar después
   de los dos primeros puntos; evaluar el coste de complejidad de los tipos.

5. **Proponer actualizaciones de vistas existentes.** Detectar campos nuevos o
   cambios de configuración y mostrar un diff para formularios/columnas.
   Aceptación: revisión previa, aplicación explícita y conservación de código y
   personalizaciones; rechazar casos ambiguos. No regenerar ni sobrescribir
   archivos personalizados como mecanismo de actualización.

## Columnas declaradas dentro de la vista

Propuesta adicional del usuario, registrada el 2026-11-11; pendiente de diseño e
implementación. Permitir declarar columnas como hijos JSX para que `foo.list.ts`
deje de ser obligatorio. Sintaxis ilustrativa, todavía no disponible:

```tsx
<ListView model="FlotaModelo" load={listRecords}>
  <ListView.Field name="name" />
  <ListView.Field name="fabricanteId" groupable />
</ListView>
```

Preferir `ListView.Field` como nombre propuesto para distinguir metadatos de
columnas de los controles editables del formulario. El modelo aporta etiquetas,
tipos y opciones publicados; la vista elige campos y personaliza presentación.
Conservar `columns` como alternativa para configuraciones compartidas con
CardView/KanbanView y para consumidores existentes.

Resolver primero la dependencia actual del servicio respecto a `foo.list.ts`:
el servicio fija su proyección y los campos autorizados para consulta, búsqueda,
orden y agrupación a partir del modelo y de una política explícita del servidor.
Los hijos JSX no conceden permisos ni amplían la publicación. Por ejemplo,
`groupable` en la vista ofrece el control, mientras el servidor valida cada
petición contra su política. Mantener dominios, autorización, límites de páginas,
conteos SQL y transacciones.

Criterios de aceptación:

- Una lista sencilla se declara en un único archivo TSX, sin `foo.list.ts`
  obligatorio ni repetir metadatos del modelo.
- El servidor no importa la vista ni confía en columnas o permisos enviados
  desde el cliente; las peticiones manipuladas se rechazan.
- No exponer clases server-only, campos sensibles, callbacks privados o secretos
  para derivar metadatos del cliente.
- Preservar tipado, límites servidor/cliente, renderizados personalizados y
  compatibilidad con `columns`; definir comportamiento claro si se combinan ambas APIs.
- Actualizar scaffold, documentación y ejemplos ficticios; ofrecer una transición
  que preserve las vistas existentes, sin regenerarlas ni editar Flota por adelantado.

Evaluar este diseño junto con el punto 3 y la centralización del servicio, para
reducir configuración total en lugar de moverla íntegramente a otro archivo.

## Controles de formulario enlazados al contrato del modelo

Propuesta aceptada para registrar el 2026-11-11; pendiente de diseño e implementación.
Reutilizar en los Fields existentes los metadatos publicados del modelo, evitando
repetir etiqueta, obligatoriedad, longitud máxima, opciones Selection y proveedor
Many2one configurado. Sintaxis ilustrativa del uso deseado:

```tsx
<FormView {...formProps}>
  <FormGroup>
    <FieldText name="name" />
    <FieldMany2One name="fabricanteId" />
    <FieldSelect name="vehicleType" />
  </FormGroup>
</FormView>
```

El desarrollador sigue eligiendo los componentes, su distribución y props
personalizadas. Definir cómo se proporciona el contrato cliente al formulario y
la precedencia de props explícitas frente a los metadatos. Mantener RHF/Zod y los
límites servidor/cliente: los metadatos ayudan a la UI y no sustituyen la validación
ni autorización del servidor. Los proveedores autorizados se conectan explícitamente
o mediante la futura convención; no serializar callbacks del modelo ni secretos.

Criterios de aceptación:

- Cambiar `maxLength` en el modelo y regenerar el contrato actualiza el límite del
  input enlazado, sin mantener un segundo valor manual en el formulario.
- Etiquetas, required y opciones se reutilizan sin ampliar la publicación de campos
  ni importar clases server-only en el cliente.
- Conservar Fields independientes y formularios manuales sin modelo, personalizaciones,
  accesibilidad, autocomplete off e integración de errores y cambios pendientes.
- Incluir un ejemplo funcional RHF/Zod en `/sample` y verificar que las props de UI
  personalizadas no permiten eludir la validación del servidor.

Priorizar esta integración sobre los componentes actuales. Un futuro
`<FormView.Field name="name" />` que seleccione automáticamente el control queda
como alternativa posterior por evaluar, no como requisito ni API decidida.

## Al retomar

Diseñar primero la resolución de proveedores y la configuración central de
etiquetas con ejemplos antes/después de código de aplicación. Comparar pasos y
repetición reales; conservar permisos, transacciones, concurrencia y errores.
Probar el framework en proyectos temporales y no adelantar ediciones de Flota.

Contratos existentes: [Modelos y vistas](../modelos-y-vistas.md),
[Nombres de presentación](../nombres-presentacion.md),
[Colecciones](../vistas-colecciones.md) y [Agrupación](../agrupacion-listas.md).
