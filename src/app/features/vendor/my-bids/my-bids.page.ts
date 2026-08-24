import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { VendorTenderService } from '../vendor.service';
import { BidStatus } from '../vendor.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-my-bids-page',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe, IconComponent, EmptyStateComponent, AppDatePipe, StatusBadgeComponent],
  templateUrl: './my-bids.page.html',
  styleUrl: './my-bids.page.scss'
})
export class MyBidsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly vendorService = inject(VendorTenderService);

  /**
   * Read from the service's own signal, not snapshotted in ngOnInit. A
   * one-time read landed before the fetch resolved and never updated — the
   * same race fixed three times in F2.1–F2.4.
   */
  readonly bids = this.vendorService.bids;
  readonly loading = this.vendorService.bidsLoading;
  readonly loadError = this.vendorService.bidsError;
  readonly truncated = this.vendorService.bidsTruncated;
  readonly noConfirmedBids = this.vendorService.noConfirmedBids;

  selectedFilter = signal<string>('all');
  searchQuery = signal('');

  filterOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'All Bids' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'awarded', label: 'Awarded' },
    { value: 'rejected', label: 'Not Selected' }
  ];

  filteredBids = computed(() => {
    let result = this.bids();
    const filter = this.selectedFilter();
    const query = this.searchQuery().toLowerCase();

    // Filter by status
    if (filter !== 'all') {
      result = result.filter(bid => bid.status === filter);
    }

    // Filter by search query
    if (query) {
      result = result.filter(bid =>
        bid.tenderTitle.toLowerCase().includes(query) ||
        bid.bidNumber.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    return result.sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  });

  stats = computed(() => {
    const all = this.bids();
    return {
      total: all.length,
      submitted: all.filter(b => b.status === 'submitted').length,
      underReview: all.filter(b => b.status === 'under_review').length,
      shortlisted: all.filter(b => b.status === 'shortlisted').length,
      awarded: all.filter(b => b.status === 'awarded').length,
      rejected: all.filter(b => b.status === 'rejected').length
    };
  });

  ngOnInit(): void {
    // Fire-and-forget: `filteredBids` is a computed over the service's signal,
    // so it re-renders when the load lands. Same pattern as the vendor queue.
    void this.vendorService.refreshBidsAsync();
  }

  /**
   * A count over the rows we hold. That is the whole truth in mock mode and
   * whenever the list fits one page; when it doesn't, or before any load has
   * succeeded, there is no number we can honestly print here — no per-status
   * count endpoint exists — so print a placeholder instead of a wrong number.
   */
  statValue(count: number): string {
    return this.noConfirmedBids() || this.truncated() ? '—' : String(count);
  }

  setFilter(filter: string): void {
    this.selectedFilter.set(filter);
  }

  updateSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  viewBidDetail(bidId: string): void {
    this.router.navigate(['/vendor/bids', bidId]);
  }

  viewTender(tenderId: string): void {
    this.router.navigate(['/vendor/tenders', tenderId]);
  }


  getStatusLabel(status: BidStatus): string {
    const labels: Record<BidStatus, string> = {
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

  browseTenders(): void {
    this.router.navigate(['/vendor/tenders']);
  }
}
