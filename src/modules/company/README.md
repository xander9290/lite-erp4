# Empresas y sucursales

Company es un catálogo de empresas propias y sucursales. No implementa empresa
activa en sesión, asignaciones de usuarios por empresa ni aislamiento multiempresa.
Guarda sus datos de contacto directamente y depende sólo de Ubicaciones. No crea
ni sincroniza contactos en Directorio.

## Identidad y jerarquía

- Código obligatorio y único global, máximo cinco caracteres. Nombre obligatorio,
  repetible, máximo 120. Ambos se recortan y convierten a mayúsculas al guardar.
- Una matriz tiene parentId vacío. Una sucursal apunta a una matriz sin padre.
  La constraint impide autorreferencias y convertir una matriz con sucursales en
  sucursal. El dominio de selección se revalida también en servidor.
- Empresas y Sucursales son pantallas filtradas del mismo modelo. Las sucursales
  se crean desde la pestaña Sucursales de la matriz, que propone parentId. El botón
  Nuevo se omite en las vistas de Sucursales; su ruta de alta muestra instrucciones.
  Son decisiones de navegación: la pantalla no cambia los permisos ni el modelo.
- Activo se administra por registro. Desactivar una matriz no modifica sus
  sucursales; los inactivos siguen consultables y filtrables. No se bloquea una
  relación existente por ese estado.
- Eliminar una matriz con sucursales conserva Restrict. La colección de hijos
  sigue siendo de consulta, con formularios independientes y paginación.

## Acceso y presentación

Grupos declarados: Administrador (crud), Auxiliar (cru) y Consulta (r), sólo sobre
company.company. Se asignan desde Ajustes → Grupos; declarar los perfiles no asigna
usuarios ni modifica sus overrides. Admin conserva bypass. No se concede entrada
directa a Ubicaciones: las referencias usan el acceso relacional del framework.

Ambas pantallas ofrecen Tarjetas y Lista. Nombre y código participan en búsqueda;
Activo está disponible como filtro y las tarjetas identifican los inactivos.
Notebook companyInfo publica generalInfo y branches para ocultación por grupo.
Las sucursales no habilitan su propia pestaña de sucursales.

El formulario usa densidad compacta y widgets existentes email/phone. El correo
se valida en servidor. Si el país seleccionado tiene código MX, CP exige cinco
dígitos y RFC una estructura de 12/13 caracteres con fecha posible. Estos valores
siguen opcionales; otros países no reciben reglas mexicanas. Es una comprobación
de formato, sin consulta fiscal. El widget phone conserva su formato mexicano
habitual y los números extranjeros que no reconoce.

## Migración de identidad (2026-11-27)

Preparada: `prisma/migrations/20261128032519_company_identity/migration.sql`.
Retira sólo company_company_name_key y company_company_code_name_key; conserva
company_company_code_key, tablas, columnas y datos. Incluye transacción, lock y
guardas de código. Esquema y ledger se actualizaron mediante el instalador,
sin editar hashes a mano. La base conserva las restricciones anteriores hasta
aplicar esta migración, por lo que todavía rechaza nombres duplicados.

Revisar el SQL y el historial pendiente antes de aprobar su aplicación manual
en desarrollo (`npm run db:deploy`). El retiro de índices compuestos continúa
fuera del SQL automático de orm:sync. No ejecutar deploy sólo para omitir una
advertencia: ver el [contrato de sincronización](../../../docs/sincronizar-aplicaciones.md).
No asumir su aplicación en otra máquina ni producción.

## Comprobación

`npm run test:modules` incluye los casos de Company: normalización, validación por
país, fechas imposibles, jerarquía, publicación de consultas y concesiones por grupo.
Las pruebas del instalador comprueban la preparación de ambos retiros de índice
y la conservación de propiedad/ledger en un proyecto temporal sin base de datos.
La evidencia de ejecución y las limitaciones están en
[continuidad](../../../docs/estado-proyecto.md).
