import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { VendorTenderService } from '../vendor.service';
import { Bid, BidStatus } from '../vendor.model';
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

  bids = signal<Bid[]>([]);
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
        bid.bidId.toLowerCase().includes(query)
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
    this.loadBids();
  }

  private loadBids(): void {
    const bids = this.vendorService.getMyBids();
    this.bids.set(bids);
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
