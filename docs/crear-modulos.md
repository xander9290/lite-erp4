# Crear módulos

Un módulo reúne modelos, menús y permisos de una aplicación. Defines sus datos
en clases TypeScript y el framework ofrece lista, formulario y operaciones de
servidor por convención. Puedes personalizar las vistas más adelante.

En esta guía crearás dos aplicaciones independientes: un bloc de notas y una
biblioteca con libros y autores. Los ejemplos son instrucciones para practicar;
consultar esta página no crea archivos, tablas ni registros.

## Antes de empezar

Trabaja desde la raíz del repositorio, con las dependencias instaladas y la base
de desarrollo configurada en `.env.local`. Usa una cuenta administradora para la
primera comprobación. El servidor de desarrollo se inicia con `npm run dev`.

El recorrido es: **crear módulo → crear modelos → personalizar → sincronizar → probar**.

- ID de módulo: minúsculas, sin espacios ni guiones, por ejemplo `notas`.
- Clase de modelo: PascalCase, por ejemplo `Nota`.
- Clave del modelo: la clase en minúsculas, por ejemplo `nota`.
- `--dry-run` muestra los archivos propuestos sin escribirlos. El módulo debe
  existir antes de ejecutar el dry-run de uno de sus modelos.

Los comandos rechazan nombres ocupados y conservan los archivos existentes.
Elige otros IDs si ya utilizaste los de estos ejemplos.

## Ejemplo 1: un bloc de notas

Crearás la aplicación **Notas**. Cada nota tendrá título, contenido y una marca
de activo. Basta un modelo; no necesitas escribir componentes React.

### 1. Crear el módulo y su modelo

Primero revisa y crea el módulo:

```bash
npm run create:module -- notas --dry-run
npm run create:module -- notas
```

Después revisa y crea el modelo:

```bash
npm run create:model -- notas Nota --dry-run
npm run create:model -- notas Nota
```

El generador crea `src/modules/notas/manifest.ts` y `models/nota.ts` dentro del
módulo. También registra el módulo en `src/modules/index.ts` e importa Nota en
el manifest. Estos comandos todavía no modifican la base de datos.

### 2. Definir los campos

Edita `src/modules/notas/models/nota.ts`:

```ts
import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class Nota extends Model {
  name = Fields.Text({
    label: "Título", required: true, maxLength: 120, tracking: true,
  });
  contenido = Fields.Text({ label: "Contenido", maxLength: 1000, tracking: true });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });

  displayName(record: DisplayRecord<Nota, "name">): string {
    return record.name;
  }
}
```

`required` exige el título y `maxLength` limita su longitud. `default` propone
el valor inicial al crear. `tracking` incluye los cambios guardados en el
historial. `displayName` define el texto con el que se identifica una nota.
Las validaciones definitivas también se ejecutan en el servidor.

### 3. Definir nombre, menú y acceso

Edita `src/modules/notas/manifest.ts`:

```ts
import "server-only";
import { defineModule } from "@/lib/modules/define";
import { Nota } from "./models/nota";

export default defineModule({
  id: "notas",
  name: "Notas",
  icon: "notebook-pen",
  groups: { editor: "Editor" },
  access: [{ group: "editor", models: "nota", perms: "crud" }],
  models: { nota: Nota },
  menu: { Notas: "nota" },
});
```

`models` registra la clase y `menu` publica su enlace. `icon` es el nombre de un
icono de Lucide, escrito como texto. `crud` concede crear, leer, actualizar y
eliminar al grupo Editor; no asigna usuarios automáticamente. Sin grupos ni
concesiones, el módulo permanece disponible sólo para administradores.

### 4. Sincronizar y probar

Revisa primero el plan de fuentes; este comando no consulta la base ni escribe:

```bash
npm run orm:sync -- notas --plan
```

Después ejecuta la sincronización en desarrollo:

```bash
npm run orm:sync -- notas
```

Revisa el SQL y el historial pendiente que muestra el comando antes de aprobar.
`orm:sync` coordina el esquema, las migraciones, Prisma Client y la comprobación
de TypeScript. Si falla un paso, revisa el error antes de continuar; los pasos
ya completados no se revierten automáticamente. Reinicia el proceso de
desarrollo después de sincronizar.

Abre `/erp/notas/nota`. Crea una nota titulada «Mi primera nota», guárdala y
ábrela de nuevo. Comprueba que el contenido se conserva y que el título vacío
se rechaza. La lista y el formulario ya están disponibles sin `create:views`.

Para probar con otra cuenta, entra como administrador a **Ajustes → Grupos**,
abre **Notas → Editor** y añade al usuario. Después comprueba el acceso con esa
cuenta. Un usuario puede tener un grupo explícito por módulo; puede participar
en otros módulos con sus respectivos grupos.

## Ejemplo 2: libros y autores

Crearás otra aplicación, **Biblioteca**, con dos modelos. Cada libro pertenece
a un autor mediante una relación Many2one: varios libros pueden compartir autor.
Este ejemplo no depende del módulo Notas.

### 1. Crear el módulo y los dos modelos

Puedes revisar cada creación añadiendo `--dry-run` antes de ejecutar su comando
sin esa opción. Crea primero el módulo y después sus modelos:

```bash
npm run create:module -- biblioteca
npm run create:model -- biblioteca Autor
npm run create:model -- biblioteca Libro
```

### 2. Definir el autor

Edita `src/modules/biblioteca/models/autor.ts`:

```ts
import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class Autor extends Model {
  name = Fields.Text({
    label: "Nombre", required: true, maxLength: 120, tracking: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });

  displayName(record: DisplayRecord<Autor, "name">): string {
    return record.name;
  }
}
```

### 3. Relacionar el libro con su autor

Edita `src/modules/biblioteca/models/libro.ts`:

```ts
import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class Libro extends Model {
  name = Fields.Text({
    label: "Título", required: true, maxLength: 120, tracking: true,
  });
  autorId = Fields.Many2one("BibliotecaAutor", {
    label: "Autor", required: true, onDelete: "Restrict", tracking: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });

  displayName(record: DisplayRecord<Libro, "name">): string {
    return record.name;
  }
}
```

El destino `BibliotecaAutor` combina el ID del módulo y la clase: es el nombre
del modelo Prisma, no una ruta ni el ID público `biblioteca.autor`. El formulario
resuelve su buscador autorizado automáticamente. `Restrict` impide eliminar un
autor mientras algún libro lo referencie. No necesitas una inversa One2many
para utilizar esta relación.

### 4. Registrar modelos y menús

Edita `src/modules/biblioteca/manifest.ts`:

```ts
import "server-only";
import { defineModule } from "@/lib/modules/define";
import { Autor } from "./models/autor";
import { Libro } from "./models/libro";

export default defineModule({
  id: "biblioteca",
  name: "Biblioteca",
  icon: "library",
  groups: { gestor: "Gestor" },
  access: [{ group: "gestor", models: ["autor", "libro"], perms: "crud" }],
  models: { autor: Autor, libro: Libro },
  menu: { Libros: "libro", Autores: "autor" },
});
```

Ambos modelos pertenecen al mismo módulo: no hace falta declarar `depends`.
Cuando una relación apunte a otro módulo declarativo, ese módulo debe estar
registrado y aparecer en `depends`; los modelos nativos de `core` son una
dependencia implícita.

### 5. Sincronizar y comprobar la relación

```bash
npm run orm:sync -- biblioteca --plan
npm run orm:sync -- biblioteca
```

Revisa y aprueba el SQL propuesto, espera a que termine y reinicia desarrollo.
Después realiza estas comprobaciones:

1. Abre `/erp/biblioteca/autor` y crea «Autor de prueba».
2. Abre `/erp/biblioteca/libro`, crea «Libro de prueba» y selecciona ese autor.
3. Guarda y vuelve a abrir el libro: debe conservar la relación y mostrar su nombre.
4. Prueba guardar otro libro sin autor: debe rechazarlo por ser obligatorio.
5. Si necesitas acceso con otra cuenta, asígnala a **Biblioteca → Gestor** desde
   Ajustes → Grupos y repite la consulta con ella.

## Cuándo personalizar una vista

Empieza con las vistas por defecto. Si necesitas reorganizar campos, añade una
vista editable del formulario, por ejemplo después de completar Biblioteca:

```bash
npm run eject:view -- biblioteca libro form --dry-run
npm run eject:view -- biblioteca libro form
```

El comando copia el formulario a `src/modules/biblioteca/views/` y registra su
carga en el manifest. Conserva el cableado del servicio y no ejecuta SQL.
Personaliza ese TSX; el generador rechaza sobrescribir una vista existente.
Para nuevas aplicaciones de `src/modules`, no necesitas `create:views` ni
declarar `clientFields`: pertenecen al flujo anterior de aplicaciones.

## Acciones de formulario tipadas

Continuando el ejemplo de **Notas**, añade un botón **Archivar**. El método del
modelo aplica la regla de negocio; el formulario sólo presenta el botón mediante
una referencia tipada. Este ejercicio requiere haber completado y sincronizado
Notas. Es una guía: leerla no modifica tus módulos.

### 1. Declarar la acción en el modelo

Edita `src/modules/notas/models/nota.ts`, conservando sus campos:

```ts
import "server-only";
import {
  action, Fields, Model, ModelValidationError,
  type ActionRecord, type ActionPatch, type DisplayRecord,
} from "@/lib/orm";

export class Nota extends Model {
  name = Fields.Text({
    label: "Título", required: true, maxLength: 120, tracking: true,
  });
  contenido = Fields.Text({ label: "Contenido", maxLength: 1000, tracking: true });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });

  displayName(record: DisplayRecord<Nota, "name">): string {
    return record.name;
  }

  @action({ label: "Archivar" })
  archivar(record: ActionRecord<Nota>): ActionPatch<Nota> {
    if (!record.active) {
      throw new ModelValidationError("La nota ya está archivada.");
    }
    return { active: false };
  }
}
```

`@action` publica el método. Recibe el registro guardado y devuelve los campos
que cambian; el servicio valida y persiste el resultado en su transacción. No hay
que escribir otra Server Action por botón. Archivar reutiliza el campo `active`
existente, por lo que este cambio no requiere una migración.

### 2. Generar las referencias tipadas

```bash
npm run orm:generate -- notas --actions-only --write
```

Este comando no consulta la base ni aplica SQL. Genera
`src/generated/orm/actions/notas/NotasNota.actions.ts`, con el export
`NotasNotaActions`. El nombre `NotasNota` combina el módulo y la clave del modelo.
No edites el archivo generado: vuelve a ejecutar el comando si añades, renombras
o retiras una acción. `orm:sync` también genera estas referencias al sincronizar.

### 3. Añadir el botón al formulario

Si todavía usas el formulario automático, revisa y genera su TSX editable:

```bash
npm run eject:view -- notas nota form --dry-run
npm run eject:view -- notas nota form
```

El comando crea `src/modules/notas/views/NotaForm.tsx` y registra su loader en el
manifest. Si ya tienes una vista personalizada, añade los imports y FormHeader
a esa vista, conservando tu diseño; eject no sobrescribe archivos existentes.
Un formulario completo para este ejemplo sería:

```tsx
"use client";

import ModelForm, { ModelExtensions } from "@/components/modules/ModelForm";
import FormHeader from "@/components/ui/form/FormHeader";
import FormButton from "@/components/ui/form/FormButton";
import FormGroup from "@/components/ui/form/FormGroup";
import FieldText from "@/components/ui/form/FieldText";
import FieldBoolean from "@/components/ui/form/FieldBoolean";
import { NotasNotaActions as notaActions } from "@/generated/orm/actions/notas/NotasNota.actions";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { FormValues } from "@/lib/orm/model";
import type { Nota } from "../models/nota";

type Values = FormValues<typeof Nota>;

export default function NotaForm({ config, id }: { config: ModelClientConfig; id?: string }) {
  return (
    <ModelForm config={config} id={id}>
      <FormHeader>
        <FormButton action={notaActions.archivar} />
      </FormHeader>
      <FormGroup legend="Datos de la nota">
        <FieldText<Values> name="name" />
        <FieldText<Values> name="contenido" widget="long" />
        <FieldBoolean<Values> name="active" />
      </FormGroup>
      <ModelExtensions />
    </ModelForm>
  );
}
```

El botón hereda el texto «Archivar» del modelo. `notaActions.archivar` ofrece
autocompletado; escribir `notaActions.archvar` produce un error de TypeScript.
`FormButton` ya no acepta `action="archivar"`. La vista importa sólo la referencia
generada y el tipo del modelo; el método de negocio permanece en el servidor.

### 4. Comprobar el comportamiento

Comprueba los tipos y reinicia desarrollo si tenías el proceso abierto:

```bash
npx tsc --noEmit
```

1. Abre `/erp/notas/nota`, crea una nota activa o abre una existente y cambia su contenido.
2. Pulsa **Archivar**: si el registro es nuevo o tiene cambios, el framework valida
   y guarda primero; después ejecuta la acción con el ID y la revisión guardados.
   Si el guardado falla, la acción no se ejecuta.
3. Comprueba que Activo queda desmarcado y que el contenido se conserva al reabrir.
4. Pulsa Archivar otra vez: el servidor rechaza la operación con «La nota ya está
   archivada». Si la acción falla después de guardar, ese guardado previo se conserva.

El botón sólo aparece con la acción publicada para el usuario y el formulario
editable. El servidor revalida permisos, reglas y revisión en cada ejecución;
una referencia tipada no concede acceso. ModelForm comparte el bloqueo de
Guardado/acciones y protege los cambios pendientes.

Puedes probar el flujo con datos ficticios en el
[ejemplo de acciones de formulario](/sample#form-actions).

## Personalizar el formulario de un One2many en modal

Una relación One2many de consulta (`readonly: true`) presenta registros independientes.
Con `<ModelChildCollections name="childIds" openIn="modal" />`, Nuevo y las filas
abren el formulario del hijo sobre el principal. Sus líneas editables siguen inline.

Para darle un diseño distinto al formulario de página, usa el tipo `modal`:

```bash
npm run eject:view -- biblioteca libro modal --dry-run
npm run eject:view -- biblioteca libro modal
```

Genera `views/LibroModal.tsx` y registra `models.libro.views.modal`. Usa Fields,
FormGroup o Notebook dentro de ModelForm para cambiar su presentación; el framework
conserva carga, permisos, validación y guardado. Sin views.modal reutiliza views.form.
Este comando sólo personaliza el formulario: no añade una relación One2many al modelo.

Si tu módulo extiende un modelo ajeno, indica su ID completo. Caso ya generado
en este proyecto:

```bash
npm run eject:view -- contactosextra core.partner modal
```

El archivo `src/modules/contactosextra/views/CorePartnerModal.tsx` queda en el
extensor y su manifest registra `extends["core.partner"].views.modal`. Edita ese
archivo; repetir eject rechaza la sobrescritura. La página principal de Contactos
conserva su formulario e inserciones. Para personalizar inserciones del modal se
usa `insertions.modal`, separada de `insertions.form`. No requiere sincronización
de la base de datos. Puedes comparar diseños en la [demo ficticia](/sample#form-dialog).

## Comprobar lo aprendido

En Notas has definido campos y acceso para un solo modelo. En Biblioteca has
registrado dos modelos y resuelto una relación Many2one con el formulario
automático. En ambos casos, las rutas nacen de las claves del manifest.

- Datos y validaciones: clases de `models/`.
- Nombre, modelos, grupos y menús: `manifest.ts`.
- Persistencia: sincronización revisada con `orm:sync`.
- Presentación a medida: vistas opcionales obtenidas con `eject:view`.
- Botones de negocio: métodos `@action` y referencias tipadas en FormButton.

Importar/exportar es una capacidad adicional: se activa manualmente con
`transfer` en el manifest y permisos `import`/`export`. Ninguno de estos dos
ejemplos lo habilita ni necesita `uniqueTogether`, porque no define una clave
compuesta de negocio.

La referencia completa está en `docs/modulos-declarativos.md`; los detalles de
sincronización en `docs/sincronizar-aplicaciones.md` y los grupos en
`docs/ideas/access-manager.md`. Puedes explorar los componentes de formulario
en el [catálogo de ejemplos](/sample).
