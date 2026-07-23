import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VendorAdminService } from '../../../core/services/vendor-admin.service';
import { AuthService } from '../../../core/services/auth.service';
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

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      return;
    }
    const vendor = this.vendorAdmin.getVendor(id);
    if (!vendor) {
      this.notFound.set(true);
      return;
    }
    this.vendor.set(vendor);
  }

  businessType(): string {
    return humanizeEnum(this.vendor()?.businessType ?? '');
  }

  private actor(): string {
    return this.authService.user()?.name ?? 'Administrator';
  }

  private reload(id: string): void {
    this.vendor.set(this.vendorAdmin.getVendor(id));
    this.pendingAction.set(null);
    this.reasonText.set('');
  }

  approve(): void {
    const v = this.vendor();
    if (!v) return;
    if (this.vendorAdmin.approve(v.id, this.actor())) this.reload(v.id);
  }

  reinstate(): void {
    const v = this.vendor();
    if (!v) return;
    if (this.vendorAdmin.reinstate(v.id, this.actor())) this.reload(v.id);
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
    this.pendingAction.set(null);
    this.reasonText.set('');
  }

  confirmReason(): void {
    const v = this.vendor();
    const action = this.pendingAction();
    const reason = this.reasonText().trim();
    if (!v || !action || !reason) return;

    const ok =
      action === 'reject'
        ? this.vendorAdmin.reject(v.id, this.actor(), reason)
        : this.vendorAdmin.suspend(v.id, this.actor(), reason);
    if (ok) this.reload(v.id);
  }

  eventLabel(status: VendorStatus): string {
    return VENDOR_STATUSES[status].label;
  }
}
