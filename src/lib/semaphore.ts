export class Semaphore {
  private active = 0;

  private queue: Array<() => void> = [];
  constructor(private readonly limit: number) {}
  async acquire() {
    if (this.active < this.limit) {
      this.active++;
      return;
    }
    console.log('Semaphore.acquire() waiting');
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }
  release() {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }

  idle(): boolean {
    return this.active == 0;
  }
}
