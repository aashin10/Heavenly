import { createRequestState } from './request-state';

describe('createRequestState', () => {
  it('is loading between begin and succeed', () => {
    const state = createRequestState();
    expect(state.loading()).toBe(false);

    const id = state.begin();
    expect(state.loading()).toBe(true);

    state.succeed(id);
    expect(state.loading()).toBe(false);
    expect(state.error()).toBeNull();
  });

  it('records the message on failure', () => {
    const state = createRequestState();
    const id = state.begin();

    state.fail(id, 'Could not load the vendor queue.');

    expect(state.loading()).toBe(false);
    expect(state.error()).toBe('Could not load the vendor queue.');
  });

  it('clears a previous error when a new request begins', () => {
    const state = createRequestState();
    state.fail(state.begin(), 'boom');

    state.begin();

    expect(state.error()).toBeNull();
  });

  it('reports a superseded request as no longer current', () => {
    const state = createRequestState();
    const first = state.begin();
    const second = state.begin();

    expect(state.isCurrent(first)).toBe(false);
    expect(state.isCurrent(second)).toBe(true);
  });

  it('ignores a stale success — it must not clear a newer request loading flag', () => {
    const state = createRequestState();
    const first = state.begin();
    const second = state.begin();

    state.succeed(first);

    // The newer request is still in flight; the older one landing late must
    // not tell the screen the work is done.
    expect(state.loading()).toBe(true);

    state.succeed(second);
    expect(state.loading()).toBe(false);
  });

  it('sequences each instance independently', () => {
    const a = createRequestState();
    const b = createRequestState();
    const idA = a.begin();
    b.begin();                        // must not supersede a's request
    expect(a.isCurrent(idA)).toBe(true);
    a.succeed(idA);
    expect(a.loading()).toBe(false);
  });

  it('ignores a stale failure — it must not overwrite a newer success', () => {
    // The subtler half, and a real bug this replaces: VendorAdminService
    // guarded its success path with a request id but the failure path could
    // still write. A fast-failing request could therefore overwrite the result
    // of a slower one that had already succeeded.
    const state = createRequestState();
    const first = state.begin();
    const second = state.begin();

    state.succeed(second);
    state.fail(first, 'late failure');

    expect(state.error()).toBeNull();
    expect(state.loading()).toBe(false);
  });
});
