# Notebook y NotebookPage

Pestañas dentro del body de FormView (también compatibles con FormLayout). Comparten su FormProvider y no crean otro formulario. Ejemplo con RHF y Zod: `/sample#notebook`.

```tsx
import Notebook from "@/components/ui/form/Notebook";
import NotebookPage from "@/components/ui/form/NotebookPage";

<FormView title="Contacto" methods={methods} onSubmit={saveContact}>
  <FormGroup legend="Datos generales">
    <FieldText name="name" label="Nombre" />
  </FormGroup>

  <Notebook defaultPage="notes" label="Información del contacto">
    <NotebookPage name="notes" label="Notas">
      <FormGroup>
        <FieldText name="notes" label="Notas" widget="long" />
      </FormGroup>
    </NotebookPage>
    <NotebookPage name="settings" label="Configuración" badge="2">
      <FormGroup>
        <FieldBoolean name="active" label="Activo" />
      </FormGroup>
    </NotebookPage>
  </Notebook>
</FormView>
```

Notebook ocupa todas las columnas del formulario. Cada página organiza sus FormGroup en una columna en móvil y dos cuando el contenedor tiene espacio. La barra de pestañas permite desplazamiento horizontal sin ensanchar el formulario.

## Props

- `Notebook`: `children`, `label` (nombre accesible del tablist), `id`, `className`, `defaultPage`, `activePage`, `onPageChange(name)`.
- `NotebookPage`: `name` único y no vacío, `label`, `children`, `icon`, `badge`, `disabled`, `className`.

Sin `activePage`, Notebook gestiona su selección y usa `defaultPage` o la primera página habilitada. Si la selección desaparece o se deshabilita, muestra la primera habilitada. Admite páginas condicionales y fragments; todos sus hijos deben ser NotebookPage.

Para controlarlo desde el formulario:

```tsx
const [page, setPage] = useState("notes");
<Notebook activePage={page} onPageChange={setPage}>...</Notebook>
```

En modo controlado, el padre debe actualizar `activePage` cuando recibe `onPageChange`, incluso cuando el cambio provenga de un error de validación.

## Valores, errores y foco

Las páginas inactivas permanecen montadas, con `hidden` e `inert`: mantienen valores, dirtyFields y estados internos de los Fields sin quedar expuestas al teclado ni a lectores de pantalla. Cambiar de página no dispara la validación ni cambia `isDirty`. Guardar valida todas las páginas y Revertir restaura también los Fields ocultos.

Cada pestaña muestra cuántos Fields contienen errores. Al enviar un FormLayout/FormView inválido, si el primer Field con error en el orden visual está dentro de un Notebook, se revelan sus páginas contenedoras y se enfoca mediante RHF. Los errores siguen apareciendo en los toasts existentes. Se admiten rutas anidadas y rangos. Los notebooks anidados reciben el mismo evento de revelado.

Los Fields compartidos usan `data-form-field={name}` en su wrapper. Añade ese atributo si creas un Field personalizado para que participe en el indicador y el revelado automático; su `ref` debe estar registrado en RHF para recibir foco. No es necesario enumerar los campos en cada NotebookPage.

`disabled` impide navegar a la página; no elimina ni deshabilita sus Fields, ni cambia el esquema Zod. Si no debe validarse su contenido, condiciona el esquema y los Fields según la regla de negocio. FormView de solo lectura permite seguir consultando sus pestañas.

## Teclado

Tab entra por la pestaña activa; flechas izquierda/derecha cambian de página y saltan las deshabilitadas, con recorrido circular. Home/End van a la primera/última habilitada. Enter o Espacio activan la pestaña. El contenido usa roles `tablist`, `tab` y `tabpanel` con sus identificadores asociados.
