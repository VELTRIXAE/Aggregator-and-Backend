import { ServiceError } from './domain.js';

/** Per-transport bound across all callers, including nested pool reads. */
export class RpcLimiter {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private concurrency = 5, private maxQueue = 64, private timeoutMs = 10000) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) throw new Error('RPC concurrency must be between 1 and 10');
  }
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      if (this.queue.length >= this.maxQueue) throw new ServiceError('SERVICE_BUSY', 'RPC queue is full; retry shortly');
      await new Promise<void>((resolve, reject) => {
        const start = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => {
          const index = this.queue.indexOf(start);
          if (index >= 0) this.queue.splice(index, 1);
          reject(new ServiceError('RPC_TIMEOUT', 'RPC queue wait exceeded its time budget', 504));
        }, this.timeoutMs);
        this.queue.push(start);
      });
    } else this.active++;
    // A released slot is transferred directly to a queued caller.
    try { return await work(); }
    finally { const next = this.queue.shift(); if (next) next(); else this.active--; }
  }
}
