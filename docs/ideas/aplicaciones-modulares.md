# Idea pendiente: aplicaciones modulares y scaffold

Estado: propuesta para una versión futura. El usuario pidió conservarla, sin implementarla por ahora.

## Objetivo

Agilizar el desarrollo de aplicaciones del ERP mediante un scaffold inspirado en la organización de módulos de Odoo, adaptado a Next.js, TypeScript y Prisma. Mantener la visión **lite**: ligero, profesional y apoyado en los componentes existentes.

## Experiencia deseada

- Definir una aplicación con identificador, nombre, icono, versión y dependencias mediante un manifest.
- Organizar su cascarón bajo una ruta de `src/app/(auth)/erp/`, con modelos, esquemas, vistas y acciones.
- Declarar campos y relaciones comunes: many2one, one2many, many2many y one2one.
- Generar listas y formularios usando nuestros Fields, FormLayout, FormGroup, RHF, Zod y DaisyUI.
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

La estructura es orientativa; aún no es una convención implementada. El generador debe publicar los modelos Prisma donde los descubra la configuración vigente del proyecto.

## Alcance inicial propuesto

Una definición declarativa en TypeScript alimentaría un generador de desarrollo que produzca:

- Modelos Prisma y relaciones con sus inversas, claves y restricciones.
- Esquemas Zod y valores iniciales.
- Vistas Lista y Formulario; formularios como JSX editable.
- Consultas y operaciones tipadas del servidor con validación y reglas de acceso.
- Entradas de navegación, catálogo de aplicaciones y registro de búsquedas relacionales.

Reutilizar FieldMany2One para selección simple y FieldRelationTag para selección múltiple. Un editor de líneas one2many sería un componente futuro; no existe todavía.

## Generación e instalación

Distinguir activar un módulo ya incluido en el despliegue de introducir código o tablas nuevos. El panel puede solicitar la generación, pero los cambios estructurales necesitan un proceso de generación de código, revisión de migraciones, regeneración de Prisma Client y construcción/despliegue.

No tratar la activación de una ruta como equivalente a crear un modelo físico en la base de datos. Las dependencias entre aplicaciones también deben respetarse al instalar o desactivar módulos.

## Decisiones por resolver al retomar

- Contrato del manifest y de las definiciones de campos/modelos/vistas.
- Límites entre archivos generados y personalizaciones para regenerar sin sobrescribir lógica propia.
- Reglas de acceso y alcance por aplicación/modelo.
- Flujo de migraciones, versiones y dependencias.
- Cómo se activan los módulos preparados y qué solicita el panel al generar uno nuevo.

Un diseñador visual y la creación de entidades en producción sin reconstrucción requerirían un motor de metadatos y almacenamiento dinámico de mayor alcance. Dejarlos para evaluar después del scaffold inicial.
