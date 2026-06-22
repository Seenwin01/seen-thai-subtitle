// ---------------------------------------------------------------------------
// Tiny in-process job queue with a concurrency limit, so heavy ffmpeg/Whisper
// jobs don't all run at once. Dependency-free + unit-testable.
// ---------------------------------------------------------------------------

export interface Queue {
  enqueue<T>(fn: () => Promise<T>): Promise<T>;
  readonly active: number;
  readonly pending: number;
}

export function createQueue(limit: number): Queue {
  const max = Math.max(1, limit);
  let active = 0;
  const waiting: Array<() => void> = [];

  function pump() {
    if (active >= max) return;
    const start = waiting.shift();
    if (!start) return;
    active++;
    start();
  }

  return {
    get active() {
      return active;
    },
    get pending() {
      return waiting.length;
    },
    enqueue<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = () => {
          Promise.resolve()
            .then(fn)
            .then(resolve, reject)
            .finally(() => {
              active--;
              pump();
            });
        };
        waiting.push(start);
        pump();
      });
    },
  };
}

let singleton: Queue | null = null;

/** Shared queue, sized by JOB_CONCURRENCY (default 2). */
export function getQueue(): Queue {
  if (!singleton) {
    singleton = createQueue(Math.max(1, Number(process.env.JOB_CONCURRENCY) || 2));
  }
  return singleton;
}
