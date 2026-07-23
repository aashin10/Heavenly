import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ToastService } from './toast.service';
import { Vendor, VendorStatus } from '../models/service.model';

/**
 * Admin-side view of the vendor pool. Reads and writes the same
 * `heavenly_vendors` store that `ServiceAuthService` uses for the logged-in
 * vendor, but operates across *all* vendors for the verification queue (F8).
 *
 * Mirrors the backend contract: verification decisions are audited
 * (`vendor_verification_events`) and gate portal access, so every transition
 * records who did it, when, and why.
 */
const VENDORS_KEY = 'heavenly_vendors';

export interface VendorQueueStats {
  pending: number;
  verified: number;
  rejected: number;
  suspended: number;
}

@Injectable({ providedIn: 'root' })
export class VendorAdminService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastService = inject(ToastService);

  /** Backing signal so the queue re-renders after a decision. */
  private readonly vendorsSignal = signal<Vendor[]>(this.readVendors());

  readonly vendors = this.vendorsSignal.asReadonly();

  readonly stats = computed<VendorQueueStats>(() => {
    const vendors = this.vendorsSignal();
    return {
      pending: vendors.filter(v => v.verificationStatus === 'pending').length,
      verified: vendors.filter(v => v.verificationStatus === 'verified').length,
      rejected: vendors.filter(v => v.verificationStatus === 'rejected').length,
      suspended: vendors.filter(v => v.verificationStatus === 'suspended').length,
    };
  });

  /** Refresh from storage — call on entering the queue in case a vendor registered. */
  refresh(): void {
    this.vendorsSignal.set(this.readVendors());
  }

  getVendor(id: string): Vendor | null {
    return this.vendorsSignal().find(v => v.id === id) ?? null;
  }

  approve(id: string, actor: string): boolean {
    return this.transition(id, 'verified', actor, undefined, 'Vendor approved.');
  }

  reject(id: string, actor: string, reason: string): boolean {
    return this.transition(id, 'rejected', actor, reason, 'Vendor rejected.');
  }

  suspend(id: string, actor: string, reason: string): boolean {
    return this.transition(id, 'suspended', actor, reason, 'Vendor suspended.');
  }

  /** Reinstate a rejected/suspended vendor back to pending for another look. */
  reinstate(id: string, actor: string): boolean {
    return this.transition(id, 'pending', actor, undefined, 'Vendor returned to the queue.');
  }

  private transition(
    id: string,
    status: VendorStatus,
    actor: string,
    reason: string | undefined,
    successMessage: string
  ): boolean {
    const vendors = this.readVendors();
    const index = vendors.findIndex(v => v.id === id);
    if (index === -1) return false;

    const now = new Date();
    const current = vendors[index];
    // Seed the registration event the first time an admin acts, so the history
    // reads from the start rather than beginning at the admin's decision.
    const priorEvents = current.verificationEvents?.length
      ? current.verificationEvents
      : [{ status: 'pending' as VendorStatus, at: current.createdAt, note: 'Registered' }];
    vendors[index] = {
      ...current,
      verificationStatus: status,
      verifiedAt: status === 'verified' ? now : current.verifiedAt,
      rejectionReason: reason,
      reviewedBy: actor,
      verificationEvents: [...priorEvents, { status, at: now, actor, note: reason }],
    };

    this.writeVendors(vendors);
    this.vendorsSignal.set(vendors);
    this.toastService.success(successMessage);
    return true;
  }

  private readVendors(): Vendor[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const raw = localStorage.getItem(VENDORS_KEY);
      return raw ? (JSON.parse(raw) as Vendor[]) : [];
    } catch {
      return [];
    }
  }

  private writeVendors(vendors: Vendor[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(VENDORS_KEY, JSON.stringify(vendors));
  }
}
