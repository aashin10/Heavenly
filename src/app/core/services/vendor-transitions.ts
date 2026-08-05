import { VendorStatus } from '../models/service.model';

export type VendorAction = 'approve' | 'reject' | 'suspend' | 'reinstate';

/**
 * Which review actions the server will accept for a vendor in this status.
 *
 * Mirrors the transition guards in `Domain/Entities/Vendor.cs`. It lives here,
 * as a pure function with its own spec, rather than as conditions in a
 * template: the template version silently offered "Return to Queue" on a
 * rejected vendor, which the server refuses with a 409 every time (F9).
 *
 * Order matters — it is the order the buttons render in, primary action first.
 */
const LEGAL_ACTIONS: Record<VendorStatus, readonly VendorAction[]> = {
  pending: ['approve', 'reject'],
  verified: ['suspend'],
  rejected: ['approve'],
  suspended: ['reinstate'],
};

export function legalVendorActions(status: VendorStatus): readonly VendorAction[] {
  return LEGAL_ACTIONS[status] ?? [];
}
