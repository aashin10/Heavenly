import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Vendor } from '../../../core/models/service.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { formatAppDate } from '../../../shared/utils/date-format.util';

/**
 * The vendor's "you can't reach the portal yet" screen. Status-aware: shows an
 * in-progress view while `pending`, an actionable rejection view (with the
 * admin's reason and a resubmit path) while `rejected`, and a suspension notice
 * while `suspended`. A `verified` vendor is bounced straight to the dashboard.
 *
 * This is the counterpart to the admin verification queue (F8) — together they
 * close the loop so a rejected vendor is never dumped at /login without a reason.
 */
@Component({
  selector: 'app-verification-pending-page',
  standalone: true,
  imports: [RouterLink, IconComponent, LogoComponent],
  templateUrl: './verification-pending.page.html',
  styleUrl: './verification-pending.page.scss',
})
export class VerificationPendingPageComponent implements OnInit {
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  currentUser = signal<Vendor | null>(null);
  submittedDate = signal<string>('');

  readonly status = computed(() => this.currentUser()?.verificationStatus ?? 'pending');
  readonly rejectionReason = computed(() => this.currentUser()?.rejectionReason ?? '');

  ngOnInit(): void {
    this.loadUserData();
  }

  private loadUserData(): void {
    const session = this.serviceAuthService.getCurrentUserSession();

    if (session?.userType !== 'vendor') {
      this.router.navigate(['/login']);
      return;
    }

    const vendor = this.serviceAuthService.getCurrentUser() as Vendor;
    if (!vendor) {
      this.router.navigate(['/login']);
      return;
    }

    // Verified vendors belong in the portal, not here.
    if (vendor.verificationStatus === 'verified') {
      this.router.navigate(['/vendor-dashboard']);
      return;
    }

    this.currentUser.set(vendor);
    if (vendor.createdAt) {
      this.submittedDate.set(formatAppDate(vendor.createdAt));
    }
  }

  /** Rejected vendor puts themselves back in the queue after fixing their profile. */
  resubmitForReview(): void {
    if (this.serviceAuthService.requestReverification()) {
      this.toastService.success('Resubmitted for review. Our team will take another look.');
      this.loadUserData();
    }
  }

  refreshStatus(): void {
    this.loadUserData();
  }

  logout(): void {
    this.serviceAuthService.logout();
    this.router.navigate(['/login']);
  }
}
