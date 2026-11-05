export type AlertOptions = { title?: string; message?: string; details?: readonly string[]; confirmLabel?: string };
export type ConfirmOptions = AlertOptions & { cancelLabel?: string; danger?: boolean };
export type AlertKind = "info" | "error" | "validation" | "confirm" | "loading";
export type AlertEntry = ConfirmOptions & { id: number; kind: AlertKind; title: string };

const titles: Record<AlertKind, string> = { info: "Información", error: "Ocurrió un error", validation: "Error de validación", confirm: "Confirmar acción", loading: "Cargando…" };
const empty: readonly AlertEntry[] = [];

/** Each request owns its completion; finishing a queued load cannot close another dialog. */
export class AlertQueue {
  private entries: readonly AlertEntry[] = empty;
  private listeners = new Set<() => void>();
  private resolvers = new Map<number, (value: boolean) => void>();
  private nextId = 0;
  private active = true;
  getSnapshot = () => this.entries;
  getServerSnapshot = () => empty;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  activate() { this.active = true; }
  private emit() { for (const listener of this.listeners) listener(); }
  private append(kind: AlertKind, options: ConfirmOptions) {
    const entry = { ...options, id: ++this.nextId, kind, title: options.title ?? titles[kind] };
    this.entries = [...this.entries, entry]; this.emit();
    return entry.id;
  }
  private request(kind: Exclude<AlertKind, "loading">, options: ConfirmOptions) {
    if (!this.active) return Promise.resolve(false);
    return new Promise<boolean>(resolve => {
      // Register completion before publishing the snapshot to subscribers.
      const id = this.nextId + 1;
      this.resolvers.set(id, resolve);
      this.append(kind, options);
    });
  }
  info = async (options: AlertOptions) => { await this.request("info", options); };
  error = async (options: AlertOptions) => { await this.request("error", options); };
  validation = async (options: AlertOptions) => { await this.request("validation", options); };
  confirm = (options: ConfirmOptions) => this.request("confirm", options);
  loading = (options: AlertOptions = {}) => {
    if (!this.active) return () => {};
    const id = this.append("loading", options);
    return () => this.settle(id, false);
  };
  withLoading = async <T>(task: () => Promise<T>, options: AlertOptions = {}): Promise<T> => {
    const close = this.loading(options);
    try { return await task(); } finally { close(); }
  };
  settle(id: number, accepted: boolean) {
    if (!this.entries.some(entry => entry.id === id)) return;
    this.entries = this.entries.filter(entry => entry.id !== id);
    const resolve = this.resolvers.get(id);
    this.resolvers.delete(id);
    this.emit(); resolve?.(accepted);
  }
  dispose() {
    this.active = false;
    this.entries = empty;
    const resolvers = [...this.resolvers.values()]; this.resolvers.clear();
    this.emit(); for (const resolve of resolvers) resolve(false);
  }
}

export type AlertsApi = Pick<AlertQueue, "info" | "error" | "validation" | "confirm" | "loading" | "withLoading">;
