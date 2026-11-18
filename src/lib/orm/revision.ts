/** Advance persisted revisions even for writes in the same millisecond. */
export function nextRevision(...previous: readonly Date[]): Date {
  return new Date(Math.max(Date.now(), ...previous.map(date => date.getTime() + 1)));
}
