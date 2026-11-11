/** Mexican national numbers, with optional country code. Preserve invalid input for validation. */
export function formatPhone(value: string): string {
  const trimmed = value.trim();
  const compact = trimmed.replace(/[\s().-]/g, "");
  const match = /^(?:\+?52)?(\d{2})(\d{4})(\d{4})$/.exec(compact);
  return match ? `+52 ${match[1]} ${match[2]} ${match[3]}` : trimmed;
}
