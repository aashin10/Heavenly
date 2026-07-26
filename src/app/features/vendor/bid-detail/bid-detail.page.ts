import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VendorTenderService } from '../vendor.service';
import { Bid, PublishedTender } from '../vendor.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { formatAppDateTime } from '../../../shared/utils/date-format.util';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-bid-detail-page',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe, IconComponent, AppDatePipe, StatusBadgeComponent],
  templateUrl: './bid-detail.page.html',
  styleUrl: './bid-detail.page.scss'
})
export class BidDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorService = inject(VendorTenderService);

  bid = signal<Bid | null>(null);
  tender = signal<PublishedTender | null>(null);

  ngOnInit(): void {
    const bidId = this.route.snapshot.params['id'];
    this.loadBidDetails(bidId);
  }

  private loadBidDetails(bidId: string): void {
    const bid = this.vendorService.getBidDetail(bidId);
    if (!bid) {
      this.router.navigate(['/vendor/bids']);
      return;
    }
    this.bid.set(bid);

    // Load tender details
    const tender = this.vendorService.getTenderDetail(bid.tenderId);
    this.tender.set(tender || null);
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

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      under_review: 'Under Review',
      shortlisted: 'Shortlisted',
      awarded: 'Awarded',
      rejected: 'Not Selected'
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

  getStatusTimeline(): { label: string; date: string; active: boolean; completed: boolean }[] {
    const bid = this.bid();
    if (!bid) return [];

    const statusOrder = ['submitted', 'under_review', 'shortlisted', 'awarded'];
    const currentIndex = statusOrder.indexOf(bid.status);

    return [
      {
        label: 'Bid Submitted',
        date: bid.submittedAt,
        active: bid.status === 'submitted',
        completed: currentIndex > 0
      },
      {
        label: 'Under Technical Review',
        date: bid.status !== 'submitted' ? bid.updatedAt || bid.submittedAt : '',
        active: bid.status === 'under_review',
        completed: currentIndex > 1
      },
      {
        label: 'Technical Shortlisted',
        date: bid.status === 'shortlisted' || bid.status === 'awarded' ? bid.updatedAt || bid.submittedAt : '',
        active: bid.status === 'shortlisted',
        completed: currentIndex > 2
      },
      {
        label: 'Contract Awarded',
        date: bid.status === 'awarded' ? bid.updatedAt || bid.submittedAt : '',
        active: bid.status === 'awarded',
        completed: false
      }
    ];
  }
}
