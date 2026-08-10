import { signal, Signal } from '@angular/core';

/**
 * The state every async call in this app needs: whether one is in flight,
 * whether the last one failed, and whether a given response is still the newest.
 *
 * It deliberately does **not** own the data. Its first consumer writes two
 * independent signals from one response (vendor rows and server-side counts),
 * and the review page's decision guard writes none — a primitive holding a
 * single `data` signal would have to be worked around at both.
 *
 * Three rules, each because its absence produced a real bug here:
 *
 * 1. **Only the newest request may write anything — success *or* failure.**
 *    Guarding just the success path let a fast-failing request overwrite a
 *    slower one that had already succeeded.
 * 2. **A failure records an error; it never fabricates data.** The catch in
 *    `refreshAsync` used to write an empty list and all-zero counts, so a 403
 *    rendered as a confident "0 pending — no vendors here". Zeros must come
 *    from a server that said zero.
 * 3. **`loading` is true from `begin()` until the matching settle**, so a screen
 *    can say "loading" instead of an empty state asserting there is nothing.
 */
export interface RequestState {
  readonly loading: Signal<boolean>;
  readonly error: Signal<string | null>;
  /** Marks a new request in flight and clears any previous error. Returns its id. */
  begin(): number;
  /** Whether `id` is still the most recently issued request. */
  isCurrent(id: number): boolean;
  succeed(id: number): void;
  fail(id: number, message: string): void;
}

export function createRequestState(): RequestState {
  const loading = signal(false);
  const error = signal<string | null>(null);
  let latestId = 0;

  const isCurrent = (id: number) => id === latestId;

  return {
    loading: loading.asReadonly(),
    error: error.asReadonly(),

    begin(): number {
      loading.set(true);
      error.set(null);
      return ++latestId;
    },

    isCurrent,

    succeed(id: number): void {
      if (!isCurrent(id)) return;
      loading.set(false);
    },

    fail(id: number, message: string): void {
      if (!isCurrent(id)) return;
      loading.set(false);
      error.set(message);
    },
  };
}
