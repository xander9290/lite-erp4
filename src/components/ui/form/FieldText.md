# FieldText

`mode="display"` muestra un Text de recordUI.readFields (compute/related), sin
registrarlo en RHF ni crear un input. Hereda label y conserva direction inline/block.
Ejemplo: `<FieldText mode="display" name="resumen" />`.
Contrato y demo en [Campos calculados](../../../../docs/campos-calculados.md).

Campo de texto integrado con RHF. `widget` es la única opción para elegir su uso;
se retiran la prop `type` y el antiguo nombre `widget="input"`.

| widget | Control y comportamiento |
| --- | --- |
| `text` (por defecto) | Input de texto. |
| `password` | Contraseña oculta con botón accesible para mostrar/ocultar. |
| `long` | Textarea; admite rows. |
| `phone` | Teléfono mexicano, con formato al salir del campo. |
| `email` | Input email con teclado de correo; no transforma el texto. |
| `header` | Valor RHF como `h1` de sólo lectura, sin label ni input. |

Todos mantienen `autoComplete="off"`, RHF, errores y `data-form-field`.
`header` no crea un control editable: conserva el valor en RHF y sigue sus cambios
al cargar, resetear o guardar. No necesita `readOnly`; ignora el label visible y
`direction` para ocupar el ancho disponible. Soporta `className`, `style` y
`placeholder` (por defecto «Nuevo registro») cuando el valor es vacío o null.
El placeholder sólo es visual: no sustituye el valor ni evita la validación Zod.
Los errores conservan `aria-invalid`, `aria-describedby` y el foco programático.
Se usa para campos persistentes del formulario, sin `mode="display"` (reservado
a compute/related). No calcula el nombre ni lo actualiza antes del guardado.

```tsx
<FieldText<Values> name="name" widget="header" />
```

Demo RHF/Zod en `/sample#field-text-header`: editar, validar y resetear el título.

Para migrar, sustituye `type="password"` por `widget="password"` y
`widget="input"` por `widget="text"` o elimina widget. `type` queda reservado
al control HTML interno y no se acepta en la API del componente.

```tsx
<FieldText name="phone" label="Teléfono" widget="phone" direction="inline" />
<FieldText name="password" label="Contraseña" widget="password" />
<FieldText name="email" label="Correo" widget="email" />
```

Phone usa `type="tel"`, teclado telefónico y `autoComplete="off"`. Al salir del
campo convierte `3321659874`, `523321659874`, `+523321659874` o `(33) 2165-9874`
en `+52 33 2165 9874`. Actualiza RHF y notifica `onChange` si cambia el valor,
antes de notificar `onBlur`. Durante la escritura conserva el texto y el cursor.
Los valores de reset/carga se formatean al salir del campo, sin ensuciar RHF al
montar. Los controles readOnly no modifican su valor.

El agrupamiento es fijo 2–4–4 para los diez dígitos nacionales; no identifica
códigos de área ni verifica que exista la línea. Conserva valores incompletos,
extranjeros o con extensiones para que el esquema los rechace sin perder dígitos.
Vacío se mantiene como string vacío. No admite contraseña en esta variante.

El widget formatea; la validación corresponde al esquema del formulario y del
servidor. `formatPhone` en `phone.ts` es puro y se puede reutilizar en ambos.
Ejemplo RHF/Zod con normalización también al enviar en `/sample#field-text-phone`.
No cambia automáticamente los campos de Contactos, Usuarios o Perfil.

Cada variante conserva la validación del esquema que la consume: password no
impone una longitud propia ni email sustituye la validación del servidor.
Ejemplos RHF/Zod: `/sample#field-text` (text/password), `#field-text-long`,
`#field-text-phone` y `#field-text-email`.
