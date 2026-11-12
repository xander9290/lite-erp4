/** Shares one confirmation across active forms and actions such as signing out. */
export class UnsavedChanges {
  private sources = new Map<symbol, { dirty: () => boolean; discard: () => void }>();
  private pending: Promise<boolean> | null = null;
  private bypass = 0;
  private running = false;
  private revision = 0;

  constructor(private readonly ask: () => Promise<boolean>) {}

  register(dirty: () => boolean, discard: () => void = () => {}) {
    const key = Symbol();
    this.sources.set(key, { dirty, discard });
    this.revision++;
    return () => { if (this.sources.delete(key)) this.revision++; };
  }

  blocked = () => this.bypass === 0 && [...this.sources.values()].some(source => source.dirty());

  discard = () => {
    for (const source of this.sources.values()) if (source.dirty()) source.discard();
  };

  leave = async () => {
    if (!await this.confirm()) return false;
    this.discard();
    return true;
  };

  confirm = (ask?: () => Promise<boolean>): Promise<boolean> => {
    // A generic leave prompt must never authorize a different destructive action.
    if (this.pending) return ask ? Promise.resolve(false) : this.pending;
    if (!ask && !this.blocked()) return Promise.resolve(true);
    const revision = this.revision;
    this.pending = Promise.resolve().then(ask ?? this.ask)
      .then(accepted => accepted && revision === this.revision, () => false)
      .finally(() => { this.pending = null; });
    return this.pending;
  };

  /** Ask before the side effect, and avoid asking again for its router navigation. */
  run = async (action: () => void | Promise<void>, ask?: () => Promise<boolean>): Promise<boolean> => {
    if (this.running) return false;
    this.running = true;
    try {
      if (!await this.confirm(ask)) return false;
      this.bypass++;
      try { await action(); this.discard(); } finally { this.bypass--; }
      return true;
    } finally { this.running = false; }
  };
}
