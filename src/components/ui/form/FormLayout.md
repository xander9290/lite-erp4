# FormLayout y densidad

FormLayout aporta un formulario y su contexto RHF, validadores de Fields,
reacciones y revelado de errores en Notebook. Conserva `autoComplete="off"`.
FormView y ModelForm lo reutilizan.

## Densidad opcional

Los tres componentes admiten `density="normal" | "compact"`. El valor por defecto
es `normal`; los formularios existentes conservan su presentación.

```tsx
<ModelForm config={config} id={id} density="compact">
  <FormGroup legend="Contacto">
    <FieldText name="name" direction="inline" />
    <FieldText name="emails" direction="inline" />
  </FormGroup>
</ModelForm>
```

En formularios manuales se declara igual en FormView o FormLayout, junto a sus
props habituales (`methods`, `onSubmit`, etc.).

Compact modifica las medidas compartidas:

- Inputs de texto, número, fecha, Many2one y selects: 2rem (32px con raíz de 16px).
- Etiquetas y texto de controles conservan sus 14px habituales.
- FormGroup: padding de 12px y separación de 8px entre hijos.
- FormMediaLayout, Stack, páginas de Notebook y grilla predeterminada de FormLayout:
  separación de 8px. FormView ya separa sus grupos por 8px.
- Fields con label en bloque: separación de 4px. En línea mantienen label de
  7rem, gap de 8px y alineación vertical centrada.
- Radios de FieldSelect: mínimo de 32px, padding horizontal de 8px y vertical de 4px.
- FieldBoolean: fila mínima de 32px, conservando el tamaño del switch.
- FieldRelationTag: buscador/acciones de 24px dentro de un control de mínimo 32px;
  las etiquetas siguen envolviendo y el control crece cuando lo necesita.

Textareas conservan su altura multilínea, y las imágenes, botones de guardado,
statebar, menús y auditoría mantienen sus dimensiones. Las clases explícitas de
tamaño de un consumidor siguen aplicando; las celdas One2many conservan su diseño
compacto propio. El control de densidad no sustituye layouts personalizados.

La implementación usa variables CSS locales a cada `<form>`, sin contexto React
nuevo. Cada formulario inicializa o restablece sus variables: un formulario
independiente en un portal elige su propia densidad. No cambia validación,
permisos, revisión, guardado ni borradores. Cambiar density no remonta los Fields.

Demo RHF/Zod `/sample#form-density`: selector normal/compact, texto, radios,
select, número, fecha, Many2one y Many2many con datos ficticios, booleano, imagen
readonly, Stack y Notebook. Validación local sin persistencia ni subidas.
