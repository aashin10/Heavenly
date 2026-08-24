import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VendorTenderService } from '../vendor.service';
import { Bid } from '../vendor.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { formatAppDateTime } from '../../../shared/utils/date-format.util';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-bid-detail-page',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe, IconComponent, AppDatePipe, StatusBadgeComponent, EmptyStateComponent],
  templateUrl: './bid-detail.page.html',
  styleUrl: './bid-detail.page.scss'
})
export class BidDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorService = inject(VendorTenderService);
  private readonly toastService = inject(ToastService);

  bid = signal<Bid | null>(null);
  loading = signal(true);
  loadFailed = signal(false);

  /** Guards the withdraw control while a request is in flight — one click, one withdrawal. */
  withdrawing = signal(false);
  showWithdrawPanel = signal(false);
  withdrawReason = signal('');

  ngOnInit(): void {
    void this.load(this.route.snapshot.params['id']);
  }

  private async load(bidId: string): Promise<void> {
    this.loading.set(true);
    const bid = await this.vendorService.getBidDetailAsync(bidId);
    this.loading.set(false);

    if (!bid) {
      // Deliberately not a redirect. The old code bounced to /vendor/bids on
      // any failure, so a transient 500 looked identical to a bid that does
      // not exist, and the vendor was never told which.
      this.loadFailed.set(true);
      return;
    }

    this.bid.set(bid);
  }

  goBack(): void {
    this.router.navigate(['/vendor/bids']);
  }

  viewTender(): void {
    const bid = this.bid();
    if (bid) {
      this.router.navigate(['/vendor/tenders', bid.tenderId]);
    }
  }

  openWithdrawPanel(): void {
    this.withdrawReason.set('');
    this.showWithdrawPanel.set(true);
  }

  cancelWithdraw(): void {
    // Guarded like the panel's own action: cancelling only hides the panel, it
    // cannot recall a request already sent. Slice 2's F12 lesson.
    if (this.withdrawing()) return;
    this.showWithdrawPanel.set(false);
  }

  async confirmWithdraw(): Promise<void> {
    const bid = this.bid();
    if (!bid || this.withdrawing()) return;

    this.withdrawing.set(true);
    const updated = await this.vendorService.withdrawBidAsync(
      bid.bidId,
      this.withdrawReason().trim() || undefined
    );
    this.withdrawing.set(false);
    this.showWithdrawPanel.set(false);

    // `withdrawBidAsync` returns the *fresh* bid on a 409 as well as on
    // success, so either way this leaves the screen showing what the server
    // actually holds. Null means even the re-read failed; it has already said
    // so, and overwriting the bid with null would blank the page.
    if (updated) this.bid.set(updated);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      under_review: 'Under Review',
      shortlisted: 'Shortlisted',
      awarded: 'Awarded',
      rejected: 'Not Selected',
      withdrawn: 'Withdrawn'
    };
    return labels[status] || status;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  }

  formatDate(date: string): string {
    return formatAppDateTime(date);
  }

  /**
   * The bid's actual history.
   *
   * The old version derived four fixed steps from the current status and
   * stamped `updatedAt` on each intermediate one — so a bid that went straight
   * from submitted to awarded displayed a dated "Under Technical Review" step
   * that never happened. `events` is the server's append-only record; the
   * backend's own comment says award disputes are decided on it.
   */
  timeline = computed(() =>
    (this.bid()?.events ?? []).map(event => ({
      label: this.getStatusLabel(event.toStatus),
      date: event.occurredAt,
      note: event.note ?? '',
    }))
  );
}
