/** adapter-pg 7 binds/reads DateTime values assuming a UTC PostgreSQL session. */
export function prismaConnectionOptions(connectionString: string) {
  const url = new URL(connectionString);
  const existingOptions = url.searchParams.get("options")?.trim();
  // Append last so a URL-provided TimeZone cannot silently shift appointment instants.
  url.searchParams.set("options", `${existingOptions ? `${existingOptions} ` : ""}-c timezone=UTC`);
  return { connectionString: url.toString(), schema: url.searchParams.get("schema") ?? "public" };
}
