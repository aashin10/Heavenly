import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { ToastService } from './toast.service';
import { environment } from '../../../environments/environment';
import { VendorAdminApiService } from '../api/services-portal/vendor-admin-api.service';
import { VendorSummaryDto } from '../api/services-portal/vendor-admin-api.models';
import { VendorDto } from '../api/services-portal/vendor-api.models';
import { mapVendorDto } from '../api/services-portal/vendor-dto.mapper';
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

  /** Client-computed from the loaded page only — `queueStats` below is what callers should read. */
  private readonly stats = computed<VendorQueueStats>(() => {
    const vendors = this.vendorsSignal();
    return {
      pending: vendors.filter(v => v.verificationStatus === 'pending').length,
      verified: vendors.filter(v => v.verificationStatus === 'verified').length,
      rejected: vendors.filter(v => v.verificationStatus === 'rejected').length,
      suspended: vendors.filter(v => v.verificationStatus === 'suspended').length,
    };
  });

  private readonly api = inject(VendorAdminApiService);

  readonly useRealApi = environment.useRealApi;

  /** Server-supplied counts. Null in mock mode, where `stats` computes them. */
  private readonly serverStatsSignal = signal<VendorQueueStats | null>(null);

  /**
   * Counts come from the server when it is authoritative: it counts the whole
   * queue, while the client only holds the current page, so computing them
   * locally would report "3 pending" when 3 is simply the page size.
   */
  readonly queueStats = computed<VendorQueueStats>(
    () => this.serverStatsSignal() ?? this.stats()
  );

  private refreshRequestId = 0;

  /** Replaces the queue from the API. `status` omitted or 'all' fetches every vendor. */
  async refreshAsync(status?: VendorStatus | 'all'): Promise<void> {
    if (!this.useRealApi) {
      this.refresh();
      return;
    }

    // A newer call can resolve before an older one — e.g. rapid filter-tab
    // clicks. Only the response matching the most recently *issued* call may
    // update state; an older one that resolves late is discarded rather than
    // overwriting a fresher result.
    const requestId = ++this.refreshRequestId;

    try {
      const dto = await firstValueFrom(
        this.api.queue({
          status: status && status !== 'all' ? status : undefined,
          pageSize: 100,
        })
      );
      if (requestId !== this.refreshRequestId) return;
      this.vendorsSignal.set(dto.items.map(item => this.summaryToVendor(item)));
      this.serverStatsSignal.set({
        pending: dto.stats.pending,
        verified: dto.stats.verified,
        rejected: dto.stats.rejected,
        suspended: dto.stats.suspended,
      });
    } catch {
      if (requestId !== this.refreshRequestId) return;
      // A 403 here means the signed-in admin lacks ServiceAdmin — show an
      // empty queue rather than a crashed page, exactly as F2.4 handles the
      // unverified-vendor 403 on tender browse.
      this.vendorsSignal.set([]);
      this.serverStatsSignal.set({ pending: 0, verified: 0, rejected: 0, suspended: 0 });
      this.toastService.error('Could not load the vendor queue.');
    }
  }

  async getVendorAsync(id: string): Promise<Vendor | null> {
    if (!this.useRealApi) return this.getVendor(id);

    try {
      return mapVendorDto(await firstValueFrom(this.api.getById(id)));
    } catch {
      return null;
    }
  }

  /** Legal from pending or rejected. `actor` is only used in mock mode — the real API derives the actor from the caller's token. */
  approveAsync(id: string, actor: string): Promise<Vendor | null> {
    return this.decide(
      id,
      () => this.api.approve(id),
      () => this.approve(id, actor),
      'Vendor approved.'
    );
  }

  /** Legal from pending only. The reason is shown to the vendor. */
  rejectAsync(id: string, reason: string, actor: string): Promise<Vendor | null> {
    return this.decide(
      id,
      () => this.api.reject(id, reason),
      () => this.reject(id, actor, reason),
      'Vendor rejected.'
    );
  }

  /** Legal from verified only. */
  suspendAsync(id: string, reason: string, actor: string): Promise<Vendor | null> {
    return this.decide(
      id,
      () => this.api.suspend(id, reason),
      () => this.suspend(id, actor, reason),
      'Vendor suspended.'
    );
  }

  /** Legal from suspended only — and returns the vendor to *verified*. */
  reinstateAsync(id: string, actor: string): Promise<Vendor | null> {
    return this.decide(
      id,
      () => this.api.reinstate(id),
      () => this.reinstate(id, actor),
      'Vendor reinstated.'
    );
  }

  /**
   * Sends one decision and returns the updated vendor, in either mode.
   *
   * Mock mode calls the existing synchronous mock method and re-reads the
   * result — mirroring `refreshAsync`/`getVendorAsync`, which already branch
   * this way. Every *Async method is therefore safe to call regardless of
   * `useRealApi`; nothing at a call site needs to know which mode is active.
   *
   * A 409 in real-API mode means the client offered an action the server's
   * transition rules forbid — `legalVendorActions` exists to make that
   * unreachable, so seeing this message means the two have drifted apart.
   */
  private async decide(
    id: string,
    call: () => Observable<VendorDto>,
    mockCall: () => boolean,
    successMessage: string
  ): Promise<Vendor | null> {
    if (!this.useRealApi) {
      if (!mockCall()) {
        this.toastService.error('That vendor could not be found.');
        return null;
      }
      return this.getVendor(id);
    }

    try {
      const previousStatus = this.vendorsSignal().find(v => v.id === id)?.verificationStatus;
      const vendor = mapVendorDto(await firstValueFrom(call()));
      this.toastService.success(successMessage);
      // Keep the queue consistent with the decision without a second read.
      this.vendorsSignal.update(list =>
        list.map(v => (v.id === vendor.id ? vendor : v))
      );
      if (previousStatus) this.adjustServerStats(previousStatus, vendor.verificationStatus);
      return vendor;
    } catch (error) {
      const status = (error as { status?: number })?.status;
      this.toastService.error(
        status === 409
          ? 'That action is not allowed for this vendor’s current status.'
          : 'The decision could not be saved.'
      );
      return null;
    }
  }

  /**
   * Keeps `queueStats`' server-supplied counts in sync with a decision made
   * against the currently-loaded page, without a full requery (which would
   * defeat the reason `refreshAsync` fetches counts separately from rows —
   * see its own docs). A no-op before any refresh has landed, since updating
   * a `null` signal via `.update()` is safe and the next real refresh will
   * compute correct counts from scratch anyway.
   */
  private adjustServerStats(from: VendorStatus, to: VendorStatus): void {
    if (from === to) return;
    this.serverStatsSignal.update(stats => {
      if (!stats) return stats;
      return { ...stats, [from]: stats[from] - 1, [to]: stats[to] + 1 };
    });
  }

  /**
   * Queue rows are summaries, not full profiles. The fields the queue renders
   * are filled from the summary and the rest left empty — the review page
   * fetches the full profile by id when it opens.
   */
  private summaryToVendor(item: VendorSummaryDto): Vendor {
    return {
      id: item.id,
      businessName: item.businessName,
      businessType: item.businessType,
      panNumber: '',
      yearEstablished: 0,
      primaryContactPerson: item.primaryContactPerson ?? '',
      designation: '',
      email: item.email ?? '',
      phone: item.phone ?? '',
      registeredAddress: '',
      city: item.city ?? '',
      state: item.state ?? '',
      pinCode: '',
      serviceCapabilities: item.serviceCapabilities,
      serviceAreas: [],
      verificationStatus: item.verificationStatus,
      documentsUploaded: {},
      bankDetails: { accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '' },
      createdAt: new Date(item.createdAt),
      verifiedAt: item.verifiedAt ? new Date(item.verifiedAt) : undefined,
      isEmailVerified: false,
    };
  }

  /** Refresh from storage — call on entering the queue in case a vendor registered. */
  refresh(): void {
    this.vendorsSignal.set(this.readVendors());
  }

  getVendor(id: string): Vendor | null {
    return this.vendorsSignal().find(v => v.id === id) ?? null;
  }

  approve(id: string, actor: string): boolean {
    return this.transition(id, 'verified', actor, undefined, 'Vendor approved.', true);
  }

  reject(id: string, actor: string, reason: string): boolean {
    return this.transition(id, 'rejected', actor, reason, 'Vendor rejected.', false);
  }

  suspend(id: string, actor: string, reason: string): boolean {
    return this.transition(id, 'suspended', actor, reason, 'Vendor suspended.', false);
  }

  /**
   * Lifts a suspension, returning the vendor to verified — matching
   * `Vendor.Reinstate` on the server. This previously set 'pending', which no
   * server transition produces; a reinstated vendor went back into the review
   * queue in mock mode and straight to verified against the real API.
   *
   * Does not stamp `verifiedAt` — the server's own `Reinstate()` doesn't
   * either, only `Approve()` does. The original verification date survives a
   * suspend/reinstate round trip.
   */
  reinstate(id: string, actor: string): boolean {
    return this.transition(id, 'verified', actor, undefined, 'Vendor reinstated.', false);
  }

  private transition(
    id: string,
    status: VendorStatus,
    actor: string,
    reason: string | undefined,
    successMessage: string,
    stampVerifiedAt: boolean
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
      verifiedAt: stampVerifiedAt ? now : current.verifiedAt,
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
