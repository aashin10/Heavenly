import { ServiceRequestStatus } from './management.model';

/**
 * These assertions exist because the admin status union carried a `rejected`
 * value the server has no concept of, and lacked `cancelled`, which it can
 * genuinely send. Both are silent until a real payload arrives — a type union
 * cannot be wrong at runtime, it can only leave the UI with no branch to take.
 *
 * The canonical set is ServiceRequestStatus.cs. `draft` is deliberately absent
 * here: a draft request lives in its own table and never reaches an admin queue.
 */
describe('ServiceRequestStatus', () => {
  it('is exactly the seven statuses an admin can see, no more, no fewer', () => {
    // A Record, not an array: TS errors on this object literal if the union
    // gains a member with no key here ("Property 'x' is missing"), and errors
    // on the key itself if the object has one the union doesn't. An array
    // typed as ServiceRequestStatus[] only checks its elements are valid
    // members — it would keep compiling if a member were silently dropped or
    // added, which is the exact failure this spec exists to catch.
    const ADMIN_VISIBLE: Record<ServiceRequestStatus, true> = {
      submitted: true,
      under_review: true,
      changes_required: true,
      approved: true,
      published: true,
      closed: true,
      cancelled: true,
    };
    expect(Object.keys(ADMIN_VISIBLE).length).toBe(7);
  });

  it('has no `rejected` status', () => {
    // The admin endpoints are start-review | approve | request-changes | close.
    // There is no reject, and `rejected` was never a state the server could
    // return — service-request-management.service.ts used to set it anyway.
    // A Record<ServiceRequestStatus, true> above would fail to compile with an
    // extra 'rejected' key (TS disallows excess properties on a fresh object
    // literal), so this runtime check is the belt to that compile-time brace —
    // it still catches a `rejected` re-added to the union AND listed correctly.
    const values: string[] = Object.keys({
      submitted: true, under_review: true, changes_required: true,
      approved: true, published: true, closed: true, cancelled: true,
    } satisfies Record<ServiceRequestStatus, true>);
    expect(values).not.toContain('rejected');
  });
});
