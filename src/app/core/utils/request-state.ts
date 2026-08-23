import { signal, Signal } from '@angular/core';

/**
 * The state every async call in this app needs: whether one is in flight,
 * whether the last one failed, and whether a given response is still the newest.
 *
 * It deliberately does **not** own the data. Its first consumer writes two
 * independent signals from one response (vendor rows and server-side counts) —
 * a primitive holding a single `data` signal would have to be worked around
 * for that. The review page's decision guard deliberately does **not** use
 * this primitive: a click-guard needs to block a second call outright, where
 * `begin()` here *supersedes* an in-flight call rather than blocking it —
 * correct for a superseded fetch, wrong for a click-guard. They're sibling
 * patterns on the same two screens, not one shared implementation.
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
 *
 * **A `false` return from `succeed`/`fail` is not the same as an early
 * return.** It tells the caller the call was a no-op on *this primitive's own*
 * signals — it does not, and cannot, guard any other code the caller runs.
 * Callers must still gate their own side effects (toasts, writes to other
 * signals, etc.) behind their own `isCurrent(id)` check *before* running them.
 * `vendor-admin.service.ts`'s `refreshAsync` catch block needed exactly this
 * guard restored in Slice 3's fix round, after a first attempt assumed
 * calling `fail()` alone was sufficient and let a stale-request toast fire
 * unconditionally.
 */
export interface RequestState {
  readonly loading: Signal<boolean>;
  readonly error: Signal<string | null>;
  /** Marks a new request in flight and clears any previous error. Returns its id. */
  begin(): number;
  /** Whether `id` is still the most recently issued request. `0` is never current, even on a fresh instance. */
  isCurrent(id: number): boolean;
  /** Returns whether the call took effect — false when `id` is stale. See the file-level doc: this is not a guard for the caller's own side effects. */
  succeed(id: number): boolean;
  /** Returns whether the call took effect — false when `id` is stale. See the file-level doc: this is not a guard for the caller's own side effects. */
  fail(id: number, message: string): boolean;
}

export function createRequestState(): RequestState {
  const loading = signal(false);
  const error = signal<string | null>(null);
  let latestId = 0;

  // `id !== 0` guards a fresh instance (latestId starts at 0) from reporting
  // a stray `0` argument as current — reachable by accident, since the exact
  // pattern this primitive replaces (`private requestId = 0`) makes `0` a
  // plausible-looking uninitialized id to pass in.
  const isCurrent = (id: number) => id !== 0 && id === latestId;

  return {
    loading: loading.asReadonly(),
    error: error.asReadonly(),

    begin(): number {
      loading.set(true);
      error.set(null);
      return ++latestId;
    },

    isCurrent,

    succeed(id: number): boolean {
      if (!isCurrent(id)) return false;
      loading.set(false);
      return true;
    },

    fail(id: number, message: string): boolean {
      if (!isCurrent(id)) return false;
      loading.set(false);
      error.set(message);
      return true;
    },
  };
}
