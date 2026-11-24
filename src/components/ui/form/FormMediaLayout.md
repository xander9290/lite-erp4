# FormMediaLayout

Compone una imagen u otro contenido visual junto a los Fields de un formulario.
No monta un `<form>`, no registra valores y no modifica el contexto RHF, la
dirección de los Fields, permisos, validación ni guardado.

```tsx
import FormMediaLayout from "@/components/ui/form/FormMediaLayout";

<FormGroup legend="Datos personales">
  <FormMediaLayout
    media={<FieldImage<Values> name="image" widget="avatar" label="" />}
    position="left"
  >
    <FieldText<Values> name="name" direction="inline" />
    <FieldText<Values> name="emails" direction="inline" />
  </FormMediaLayout>
  <Stack>
    <FieldText<Values> name="vat" />
    <FieldText<Values> name="curp" />
  </Stack>
</FormGroup>
```

- `media`: contenido React de la columna visual. No se clona ni altera el Field.
- `children`: controles, grupos u otra composición React, separados por 16px.
- `position`: `left` por defecto o `right`, relativo a los campos en disposición lateral.
- `mediaWidth`: `auto` por defecto, ajustado al contenido; acepta una longitud CSS
  (`"10rem"`) o número en píxeles (`160`). Define la columna, no las dimensiones
  de la imagen. El consumidor debe elegir un ancho adecuado para su contenido.
- Admite atributos de `div`, `className` y `style` en el contenedor exterior.

Desde **32rem del ancho disponible del componente**, usa dos columnas alineadas
arriba con separación de 16px (8px con `density="compact"` en el formulario).
En tamaños menores siempre presenta el contenido
visual arriba y los campos debajo; no depende del ancho de la ventana. Se conservan
las mismas instancias de Fields al cambiar de posición o ancho. El orden de DOM y
tabulación es siempre contenido visual → campos; `right` sólo cambia su posición
visual en disposición lateral.

Con `id`, publica el ancla `media:<id>` para extensiones. `before` y `after`
insertan alrededor del layout completo; `replace` lo sustituye, incluida la imagen;
`inside` agrega después de los hijos en la columna de campos. Sin `id` no publica
ancla. Conserva las reglas compartidas de orden, dependencias y conflictos.

```tsx
// Formulario base
<FormMediaLayout id="form-media" media={<FieldImage name="image" widget="avatar" />}>
  <FieldText name="name" />
</FormMediaLayout>

// Archivo de inserciones de la extensión
<Inserter target="media:form-media" position="inside">
  <FieldText name="extensionField" />
</Inserter>
```

Las anclas existentes de Fields y FormGroup continúan disponibles dentro de la
composición. [Contrato de inserciones](../../../../docs/inserciones-vistas.md).

Integración real: Directorio, grupo Datos personales. Ejemplo RHF/Zod en
`/sample#form-media-layout`, con posición/ancho seleccionables, campo insertado
opcional, validación y reset.
La demo no persiste registros; las subidas usan el uploader existente de FieldImage.
