# FieldNumber

Field numérico con RHF y formato integer, float o monetary. El tipo persistente
del ORM actual es Integer; los formatos de UI no añaden Float al ORM.

`mode="display"` presenta un Integer de recordUI.readFields sin registrarlo en
RHF ni crear un input; mantiene el formato numérico elegido. Ejemplo:

```tsx
<FieldNumber mode="display" name="total" type="integer" direction="inline" />
```

El modo editable predeterminado conserva su integración RHF, validación y
autoComplete off. Contrato y demo de lectura en
[Campos calculados](../../../../docs/campos-calculados.md).
