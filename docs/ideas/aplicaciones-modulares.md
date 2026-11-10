# Idea pendiente: aplicaciones modulares y scaffold

Estado: iniciado por fases. Ya existen manifests, registro explícito, dependencias,
propiedad de modelos, acceso a aplicaciones y el contrato, operaciones y vistas
de lista/formulario de Contactos y Citas odontológicas. Guía vigente en
[desarrollo-aplicaciones.md](../desarrollo-aplicaciones.md). El primer contrato
Model/Fields, validación Zod e inferencia de tipos ya está implementado; guía en
[modelos-typescript.md](../modelos-typescript.md). La generación de propuestas Prisma,
validación cliente y SQL sin ejecutar ya funciona para Flota; guía en
[generador-modelos.md](../generador-modelos.md). `create:app` ya prepara el módulo,
rutas, vistas editables y registro; guía en [crear-aplicaciones.md](../crear-aplicaciones.md).
`orm:install` ya incorpora modelos nuevos e inversas al esquema activo sin ejecutar
SQL; guía en [instalar-modelos.md](../instalar-modelos.md). La evolución de modelos
instalados ya admite adiciones explícitas con `--update`. `orm:bind` genera el acceso
tipado y los cascarones incluyen servicios/lista/formulario conectados. Flujo base
probado en [flujo-framework.md](../flujo-framework.md); el catálogo de activación,
permisos granulares y cambios destructivos siguen fuera del alcance inicial.

## Objetivo

Agilizar el desarrollo de aplicaciones del ERP mediante un scaffold inspirado en la organización de módulos de Odoo, adaptado a Next.js, TypeScript y Prisma. Mantener la visión **lite**: ligero, profesional y apoyado en los componentes existentes.

## Dirección futura: distribución como paquete npm

Idea acordada: cuando el framework haya madurado, evaluar su distribución como
`lite-erp`, instalable en un proyecto Next.js, con un comando de configuración que
prepare las integraciones y permita continuar con el scaffold de aplicaciones.
El nombre es provisional; no se ha comprobado su disponibilidad en npm.

Conservar Next.js como aliado para rutas, renderizado y comunicación con el servidor,
y Prisma para persistencia y migraciones. La propuesta es empaquetar nuestra capa de
ERP, manteniendo React y las librerías conocidas que ya utilizamos.

Una separación posible, todavía por validar, sería núcleo de modelos/domains/reglas,
integración con Prisma, componentes React, CLI e integración con Next.js. Mantener
límites claros facilitaría soportar otros entornos en el futuro sin exigir esa
extracción ahora.

**Prioridad actual: madurar el framework dentro de este proyecto.** Antes de
extraerlo, consolidar sus contratos mediante aplicaciones reales, comprobar permisos,
transacciones y evolución de esquemas, mejorar documentación y pruebas, y definir
compatibilidad, configuración y actualizaciones. El empaquetado, el instalador y la
publicación en npm quedan pendientes; esta idea no inicia una reestructuración.

## Dirección acordada: modelos TypeScript y vistas TSX

El usuario eligió explícitamente mantener el ecosistema JavaScript/TypeScript y
adoptar la metodología de declaración de modelos de Django, junto con la organización
de aplicaciones y vistas de Odoo. Esta decisión define el diseño del futuro scaffold;
el contrato declarativo, el generador revisable y la creación de cascarones ya existen.
No instalan modelos físicos ni generan un CRUD operativo automáticamente.

- **Modelos:** clases que extiendan una base `Model` y declaren campos mediante
  `Fields`, con tipos, relaciones, restricciones y valores iniciales. Los nombres
  de la API inicial y su alcance se documentan en la guía de modelos TypeScript.
- **Fuente declarativa común:** a partir de esas clases se derivarán los modelos
  Prisma, los esquemas Zod, los tipos y los valores iniciales del formulario. El
  desarrollador no deberá mantener manualmente dos declaraciones equivalentes de campos.
- **Persistencia:** Prisma continuará ejecutando consultas y migraciones. Declarar
  una clase no crea ni altera tablas durante una petición; los cambios pasan por
  generación, revisión de migraciones, Prisma Client y build/despliegue.
- **Reglas:** las restricciones compatibles se aplican en base de datos; Zod valida
  entradas y relaciones entre campos; los servicios comprueban permisos y reglas que
  requieren consultas o transacciones. El resolver de RHF usa el Zod generado y el
  servidor vuelve a validar antes de guardar.
- **Vistas:** archivos TSX escritos y compuestos por el desarrollador con nuestros
  ListView, FormView, FormGroup, Fields y Notebook. El modelo aporta datos y
  restricciones; cada vista decide qué mostrar y cómo distribuirlo.
- **Extensión de vistas:** composición de React, props, slots y componentes compartidos.
  Mantener la organización modular de Odoo sin introducir XML ni un sistema de
  herencia de XML.
- **Scaffold de vistas:** puede producir un cascarón TSX inicial editable. No construir
  una capa de renderizado automático de formularios a partir de metadatos ni obligar
  a usar una vista generada.
- **Personalización:** separar artefactos regenerables de vistas y reglas de negocio
  editables; regenerar no debe sobrescribir personalizaciones del desarrollador.

Introducir abstracciones a partir de lo demostrado por Contactos y Citas, conservando
el enfoque lite. No se incorporarán Python, Django u Odoo como dependencias del ERP.

## Experiencia deseada

- Definir una aplicación con identificador, nombre, icono, versión y dependencias mediante un manifest.
- Organizar su cascarón bajo una ruta de `src/app/(auth)/erp/`, con modelos, esquemas, vistas y acciones.
- Declarar campos y relaciones comunes en clases TypeScript: many2one, one2many, many2many y one2one.
- Escribir listas y formularios en TSX con nuestros componentes; el scaffold puede preparar sus archivos iniciales.
- Contar con un catálogo de aplicaciones desde el frontend para instalar o activar módulos.
- Permitir relaciones entre modelos pertenecientes a distintas aplicaciones y declarar esas dependencias.

## Organización ilustrativa

```text
erp/contactos/
├── manifest.ts
├── models/
├── schemas/
├── views/
│   ├── ContactList.tsx
│   └── ContactForm.tsx
├── actions/
└── page.tsx
```

La organización por carpetas ya se utiliza en los módulos piloto. La clase base y
seis Fields iniciales están en `src/lib/orm`; ya generan propuestas Prisma en
`src/generated/orm/flota`, fuera del esquema activo. Para aplicaciones creadas,
`orm:install` publica modelos nuevos en `prisma/models/orm-<id>.prisma` e inserta
inversas gestionadas en sus destinos. La migración y generación del cliente son
pasos explícitos posteriores. El ejemplo de Flota permanece sin instalar.

## Alcance inicial propuesto

La declaración de modelos con clases y Fields en TypeScript alimentaría un generador
de desarrollo que produzca:

- Modelos Prisma y relaciones con sus inversas, claves y restricciones.
- Esquemas Zod y valores iniciales.
- Cascarones opcionales de vistas Lista y Formulario como TSX editable, sin motor de renderizado automático.
- Consultas y operaciones tipadas del servidor con validación y reglas de acceso.
- Entradas de navegación, catálogo de aplicaciones y registro de búsquedas relacionales.

Reutilizar FieldMany2One para selección simple, FieldRelationTag para selección
múltiple y FieldOne2many para editar líneas directamente en la tabla; los tres ya existen.

## Generación e instalación

Distinguir activar un módulo ya incluido en el despliegue de introducir código o tablas nuevos. El panel puede solicitar la generación, pero los cambios estructurales necesitan un proceso de generación de código, revisión de migraciones, regeneración de Prisma Client y construcción/despliegue.

No tratar la activación de una ruta como equivalente a crear un modelo físico en la base de datos. Las dependencias entre aplicaciones también deben respetarse al instalar o desactivar módulos.

## Decisiones por resolver al retomar

- Completar el contrato de clases `Model`/`Fields`, mapeo a Prisma y su integración con el manifest existente.
- Límites entre archivos generados y personalizaciones para regenerar sin sobrescribir lógica propia.
- Reglas de acceso y alcance por aplicación/modelo.
- Flujo de migraciones, versiones y dependencias.
- Cómo se activan los módulos preparados y qué solicita el panel al generar uno nuevo.

Un diseñador visual y la creación de entidades en producción sin reconstrucción requerirían un motor de metadatos y almacenamiento dinámico de mayor alcance. Dejarlos para evaluar después del scaffold inicial.

## Conceptos acordados para diseñar por fases

1. Herencia y extensión de campos/métodos entre modelos y módulos.
2. Relaciones inversas, modelos intermedios y política de borrado.
3. Ciclo de vida: validar, crear, actualizar y eliminar; hooks que puedan rechazar operaciones.
4. Campos calculados, dependencias, valores iniciales y cálculos persistidos o de consulta.
5. Permisos por operación, registro y campo, comprobados en servidor.
6. Contexto de ejecución: usuario, empresa y transacción; decidir el alcance multiempresa.
7. Métodos invocables desde el cliente, DTOs y contratos de error; no exponer todos los métodos automáticamente.
8. Eventos cliente con callbacks/hooks React y useWatch; distinguir captura, setValue, carga y reset para evitar ciclos.
9. Regeneración, renombrados y evolución del esquema conservando datos y personalizaciones.
10. Auditoría, archivado, eliminación y restauración según el modelo.
11. Efectos externos y su ejecución respecto al commit de la transacción.
12. Pruebas, validación de declaraciones y vista previa de los cambios generados.

La lógica de negocio se declarará en la clase o servicios llamados por ella; su
ejecución será de servidor con permisos/transacciones. La vista administra interacción
y presentación. Se admite que el desarrollador cree sus propios types/interfaces/DTOs;
la inferencia aporta una base, no impone todos los tipos de la aplicación.

Prioridad: contrato de modelos/Fields, ciclo de vida, contexto/permisos y límites
entre artefactos generados y personalizados. No dar estos puntos por implementados
porque ya exista la primera clase base.
