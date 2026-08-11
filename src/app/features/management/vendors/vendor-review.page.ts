import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VendorAdminService } from '../../../core/services/vendor-admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { VendorAction, legalVendorActions } from '../../../core/services/vendor-transitions';
import {
  Vendor,
  VendorVerificationEvent,
  VENDOR_STATUSES,
  VendorStatus,
} from '../../../core/models/service.model';
import { getCategoryShortLabel } from '../../../shared/utils/service-category.util';
import { humanizeEnum } from '../../../shared/utils/humanize.util';
import { maskAccountNumber } from '../../../shared/utils/vendor-profile-completion.util';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AppDateTimePipe } from '../../../shared/pipes/app-date.pipe';

const DOCUMENT_LABELS: Record<string, string> = {
  businessCertificate: 'Business Certificate',
  gstCertificate: 'GST Certificate',
  tradeLicense: 'Trade License',
  insuranceCertificate: 'Insurance Certificate',
};

/** Which reason-gated action the inline panel is collecting for. */
type PendingAction = 'reject' | 'suspend' | null;

@Component({
  selector: 'app-vendor-review-page',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent, StatusBadgeComponent, AppDateTimePipe],
  templateUrl: './vendor-review.page.html',
  styleUrl: './vendor-review.page.scss',
})
export class VendorReviewPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorAdmin = inject(VendorAdminService);
  private readonly authService = inject(AuthService);

  vendor = signal<Vendor | null>(null);
  notFound = signal(false);
  pendingAction = signal<PendingAction>(null);
  reasonText = signal('');

  /**
   * True while any decision is in flight. Guards all five controls, Cancel
   * included: cancelling only hides the panel, it cannot recall a request
   * already sent, so leaving Cancel live let an admin dismiss the panel and
   * then act again on a vendor whose decision had already landed.
   */
  deciding = signal(false);

  readonly documentLabels = DOCUMENT_LABELS;

  documents = computed(() => {
    const v = this.vendor();
    if (!v) return [];
    const uploaded = v.documentsUploaded ?? {};
    return Object.keys(DOCUMENT_LABELS).map(key => ({
      key,
      label: DOCUMENT_LABELS[key],
      fileName: (uploaded as Record<string, string | undefined>)[key],
    }));
  });

  serviceLabels = computed(() =>
    (this.vendor()?.serviceCapabilities ?? []).map(id => getCategoryShortLabel(id))
  );

  timeline = computed<VendorVerificationEvent[]>(() => {
    const v = this.vendor();
    if (!v) return [];
    if (v.verificationEvents?.length) return v.verificationEvents;
    // Fall back to registration for vendors with no recorded history yet.
    return [{ status: 'pending', at: v.createdAt, note: 'Registered' }];
  });

  maskedAccount = computed(() => maskAccountNumber(this.vendor()?.bankDetails?.accountNumber));

  statusDescription = computed(() => {
    const status = this.vendor()?.verificationStatus;
    return status ? VENDOR_STATUSES[status].description : '';
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      return;
    }
    await this.reload(id);
  }

  businessType(): string {
    return humanizeEnum(this.vendor()?.businessType ?? '');
  }

  private actor(): string {
    return this.authService.user()?.name ?? 'Administrator';
  }

  /**
   * Whether the server would accept this action for the vendor's current
   * status. The template previously hard-coded a @switch that offered
   * "Return to Queue" (reinstate) on a rejected vendor — a guaranteed 409,
   * since the server allows reinstate from `suspended` alone.
   */
  can(action: VendorAction): boolean {
    const status = this.vendor()?.verificationStatus;
    return status ? legalVendorActions(status).includes(action) : false;
  }

  private async reload(id: string): Promise<void> {
    const vendor = await this.vendorAdmin.getVendorAsync(id);
    if (!vendor) {
      this.notFound.set(true);
      return;
    }
    this.vendor.set(vendor);
    this.pendingAction.set(null);
    this.reasonText.set('');
  }

  async approve(): Promise<void> {
    const v = this.vendor();
    if (!v || this.deciding()) return;
    this.deciding.set(true);
    try {
      const updated = await this.vendorAdmin.approveAsync(v.id, this.actor());
      if (updated) this.vendor.set(updated);
    } finally {
      this.deciding.set(false);
    }
  }

  async reinstate(): Promise<void> {
    const v = this.vendor();
    if (!v || this.deciding()) return;
    this.deciding.set(true);
    try {
      const updated = await this.vendorAdmin.reinstateAsync(v.id, this.actor());
      if (updated) this.vendor.set(updated);
    } finally {
      this.deciding.set(false);
    }
  }

  startReject(): void {
    this.pendingAction.set('reject');
    this.reasonText.set('');
  }

  startSuspend(): void {
    this.pendingAction.set('suspend');
    this.reasonText.set('');
  }

  cancelReason(): void {
    if (this.deciding()) return;
    this.pendingAction.set(null);
    this.reasonText.set('');
  }

  async confirmReason(): Promise<void> {
    const v = this.vendor();
    const action = this.pendingAction();
    const reason = this.reasonText().trim();
    if (!v || !action || !reason || this.deciding()) return;

    this.deciding.set(true);
    try {
      const updated =
        action === 'reject'
          ? await this.vendorAdmin.rejectAsync(v.id, reason, this.actor())
          : await this.vendorAdmin.suspendAsync(v.id, reason, this.actor());

      // Only close the panel once the decision actually landed as intended.
      // `updated` alone isn't enough: a 409 also returns a (freshly re-fetched)
      // truthy vendor, but one whose status is whatever it already was on the
      // server, not the target this action was trying to reach. The reason is
      // the only feedback the vendor receives (Vendor.cs's own Reject/Suspend
      // require it for exactly that reason), and the placeholder asks the
      // admin to be specific — the one field most likely to hold a paragraph
      // worth not losing on a 409 or a network blip. Refresh the displayed
      // vendor either way, since that's what lets the buttons re-derive from
      // the real status.
      if (updated) {
        this.vendor.set(updated);
        const target: VendorStatus = action === 'reject' ? 'rejected' : 'suspended';
        if (updated.verificationStatus === target) {
          this.pendingAction.set(null);
          this.reasonText.set('');
        }
      }
    } finally {
      this.deciding.set(false);
    }
  }

  eventLabel(status: VendorStatus): string {
    return VENDOR_STATUSES[status].label;
  }
}
