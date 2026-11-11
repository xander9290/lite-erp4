# FieldText

Campo de texto integrado con RHF. Variantes: `widget="input"` (por defecto),
`widget="long"` (textarea) y `widget="phone"` (teléfono mexicano).

```tsx
<FieldText name="phone" label="Teléfono" widget="phone" direction="inline" />
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
