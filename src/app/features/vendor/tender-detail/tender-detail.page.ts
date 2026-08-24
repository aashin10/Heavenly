import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { VendorTenderService } from '../vendor.service';
import { PublishedTender, TenderClarification, EligibilityResult, BidStatusResult } from '../vendor.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { TimeRemainingPipe } from '../../../shared/pipes/time-remaining.pipe';
import { FileSizePipe } from '../../../shared/pipes/file-size.pipe';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AppDateTimePipe, AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-tender-detail-page',
  standalone: true,
  imports: [RouterLink, FormsModule, TimeAgoPipe, TimeRemainingPipe, FileSizePipe, IconComponent, AppDateTimePipe, AppDatePipe, StatusBadgeComponent],
  templateUrl: './tender-detail.page.html',
  styleUrl: './tender-detail.page.scss'
})
export class TenderDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorService = inject(VendorTenderService);
  private readonly toastService = inject(ToastService);

  tenderId = '';
  tender = signal<PublishedTender | null>(null);
  clarifications = signal<TenderClarification[]>([]);
  eligibility = signal<EligibilityResult>({ eligible: false, reasons: [], missingRequirements: [] });
  bidStatus = signal<BidStatusResult>({ submitted: false });
  isSaved = signal(false);

  // Modal states
  showClarificationModal = signal(false);
  showEligibilityModal = signal(false);
  clarificationQuestion = signal('');

  // Computed values
  isClosingSoon = computed(() => {
    const tender = this.tender();
    if (!tender) return false;
    const hoursLeft = this.getHoursUntilClose(tender.bidWindowEnd);
    return hoursLeft <= 48 && hoursLeft > 0;
  });

  isBidWindowClosed = computed(() => {
    const tender = this.tender();
    if (!tender) return true;
    return new Date(tender.bidWindowEnd) < new Date();
  });

  ngOnInit(): void {
    this.tenderId = this.route.snapshot.params['id'];
    void this.loadTenderDetails();
  }

  private async loadTenderDetails(): Promise<void> {
    const bundle = await this.vendorService.getTenderDetailBundleAsync(this.tenderId);
    if (!bundle) {
      this.toastService.error('Tender not found');
      this.router.navigate(['/vendor/tenders']);
      return;
    }

    this.tender.set(bundle.tender);
    this.clarifications.set(bundle.clarifications);
    this.eligibility.set(bundle.eligibility);
    this.bidStatus.set(bundle.bidStatus);
    // Still local-only: "saved" is a bookmark with no persistence story and no
    // endpoint (D6). Bid status used to be in this same sentence and no longer is.
    this.isSaved.set(this.vendorService.isTenderSaved(this.tenderId));
  }

  goBack(): void {
    this.router.navigate(['/vendor/tenders']);
  }

  startBidSubmission(): void {
    if (!this.eligibility().eligible) {
      this.showEligibilityModal.set(true);
      return;
    }
    // Was '/vendor/bid/submit', which no route declares — it hit the `**`
    // catch-all and served the 404 page. The route is `vendor/tenders/:id/bid`
    // (vendor.routes.ts), and `bid-submission.page.ts` reads the tender id
    // from `params['id']` accordingly.
    this.router.navigate(['/vendor/tenders', this.tenderId, 'bid']);
  }

  viewMyBid(): void {
    const bidId = this.bidStatus().bidId;
    if (bidId) {
      this.router.navigate(['/vendor/bids', bidId]);
    }
  }

  saveForLater(): void {
    if (this.isSaved()) {
      this.vendorService.removeSavedTender(this.tenderId);
      this.isSaved.set(false);
    } else {
      this.vendorService.saveTenderForLater(this.tenderId);
      this.isSaved.set(true);
    }
  }

  markNotInterested(): void {
    this.vendorService.markTenderNotInterested(this.tenderId);
    this.router.navigate(['/vendor/tenders']);
  }

  openClarificationModal(): void {
    this.showClarificationModal.set(true);
    this.clarificationQuestion.set('');
  }

  closeClarificationModal(): void {
    this.showClarificationModal.set(false);
  }

  async submitClarification(): Promise<void> {
    const question = this.clarificationQuestion().trim();
    if (!question) {
      this.toastService.error('Please enter your question');
      return;
    }

    const asked = await this.vendorService.askClarificationAsync(this.tenderId, question);
    this.closeClarificationModal();

    // Append locally rather than re-fetching: the vendor-facing tender detail
    // only ever includes *answered* clarifications, so a re-fetch would drop
    // the pending question that was just asked right back out of view.
    if (asked) {
      this.clarifications.update(list => [...list, asked]);
    }
  }

  closeEligibilityModal(): void {
    this.showEligibilityModal.set(false);
  }

  downloadAttachment(fileId: string): void {
    // In real app, would trigger file download
    this.toastService.info('Download started');
  }

  getBudgetDisplay(): string {
    const tender = this.tender();
    if (!tender) return '';
    
    if (tender.budgetVisibility === 'hide') {
      return 'Budget not disclosed';
    } else if (tender.budgetVisibility === 'show_range' && tender.budgetMin && tender.budgetMax) {
      return `₹${this.formatAmount(tender.budgetMin)} - ₹${this.formatAmount(tender.budgetMax)}`;
    } else if (tender.budgetExact) {
      return `₹${this.formatAmount(tender.budgetExact)}`;
    }
    return 'Budget not specified';
  }

  /** Bid-window state as a status key the shared badge knows how to render. */
  bidWindowStatus(): string {
    if (!this.tender()) return '';
    if (this.isBidWindowClosed()) return 'bidding_closed';
    if (this.isClosingSoon()) return 'closing_soon';
    return 'open_for_bidding';
  }

  private getHoursUntilClose(dateStr: string): number {
    const closeDate = new Date(dateStr);
    const now = new Date();
    return (closeDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  }

  private formatAmount(amount: number): string {
    if (amount >= 10000000) {
      return (amount / 10000000).toFixed(2) + ' Cr';
    }
    if (amount >= 100000) {
      return (amount / 100000).toFixed(2) + ' Lakhs';
    }
    return amount.toLocaleString('en-IN');
  }
}
