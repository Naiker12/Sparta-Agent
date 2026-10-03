/** Ordered writes with exact retries after an uncertain transport response. */
export class QueueCheckpointWriter<T> {
  private revision: number;
  private tail: Promise<void> = Promise.resolve();
  private uncertain: T | null = null;
  private readonly save: (snapshot: T, revision: number) => Promise<number>;

  constructor(
    save: (snapshot: T, revision: number) => Promise<number>,
    revision = 0,
  ) {
    this.revision = revision;
    this.save = save;
  }

  write(snapshot: T): Promise<void> {
    const next = this.tail.catch(() => undefined).then(async () => {
      if (this.uncertain !== null) {
        this.revision = await this.save(this.uncertain, this.revision);
        this.uncertain = null;
      }
      this.uncertain = snapshot;
      this.revision = await this.save(snapshot, this.revision);
      this.uncertain = null;
    });
    this.tail = next;
    return next;
  }
}
