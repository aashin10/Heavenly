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
    this.loadTenderDetails();
  }

  private loadTenderDetails(): void {
    const tender = this.vendorService.getTenderDetail(this.tenderId);
    if (!tender) {
      this.toastService.error('Tender not found');
      this.router.navigate(['/vendor/tenders']);
      return;
    }
    
    this.tender.set(tender);
    this.clarifications.set(this.vendorService.getTenderClarifications(this.tenderId));
    this.eligibility.set(this.vendorService.checkTenderEligibility(this.tenderId));
    this.bidStatus.set(this.vendorService.getMyBidStatus(this.tenderId));
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
    this.router.navigate(['/vendor/bid/submit', this.tenderId]);
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

  submitClarification(): void {
    const question = this.clarificationQuestion().trim();
    if (!question) {
      this.toastService.error('Please enter your question');
      return;
    }
    
    this.vendorService.askClarification(this.tenderId, question);
    this.closeClarificationModal();
    
    // Reload clarifications
    this.clarifications.set(this.vendorService.getTenderClarifications(this.tenderId));
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
