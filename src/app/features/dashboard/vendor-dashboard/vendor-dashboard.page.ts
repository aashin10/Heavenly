import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { Vendor } from '../../../core/models/service.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { deadlineLabel, isUrgent } from '../../../shared/utils/deadline.util';
import { computeProfileSections } from '../../../shared/utils/vendor-profile-completion.util';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import {
  TenderOpportunity,
  VendorBid,
  VendorDashboardStats,
} from './vendor-dashboard.model';
import { BidStatus } from '../../vendor/vendor.model';
import { VendorTenderService } from '../../vendor/vendor.service';

@Component({
  selector: 'app-vendor-dashboard-page',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, IconComponent, LogoComponent, AppDatePipe],
  templateUrl: './vendor-dashboard.page.html',
  styleUrl: './vendor-dashboard.page.scss',
})
export class VendorDashboardPageComponent implements OnInit {
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly router = inject(Router);
  private readonly vendorService = inject(VendorTenderService);

  // User data
  currentUser = signal<Vendor | null>(null);

  /** Null until a stats response lands. The cards render '—' rather than a zero we cannot vouch for. */
  stats = signal<VendorDashboardStats | null>(null);

  // Tender opportunities
  tenderOpportunities = signal<TenderOpportunity[]>([]);

  // My bids
  myBids = signal<VendorBid[]>([]);

  // Profile sections — derived from the vendor record via the shared rules,
  // so this checklist, the ring and /vendor-profile can never disagree.
  profileSections = computed(() => computeProfileSections(this.currentUser()));

  // Computed values
  greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  businessName = computed(() => {
    const user = this.currentUser();
    return user?.businessName || user?.email?.split('@')[0] || 'Vendor';
  });

  isVerified = computed(() => {
    const user = this.currentUser();
    return user?.verificationStatus === 'verified';
  });

  completedSections = computed(() => {
    return this.profileSections().filter((s) => s.isComplete).length;
  });

  totalSections = computed(() => {
    return this.profileSections().length;
  });

  /**
   * Derived from the checklist so the ring and the "X of Y sections complete"
   * caption can never disagree (they previously read 75% vs 2 of 5).
   */
  profileCompletion = computed(() => {
    const total = this.totalSections();
    return total === 0 ? 0 : Math.round((this.completedSections() / total) * 100);
  });

  ngOnInit(): void {
    this.loadUserData();
    this.loadDashboardData();
    void this.loadStats();
  }

  /**
   * `GET /api/bids/mine/stats` — one call for all four counters, because a
   * dashboard that fires four requests renders in four stages and looks broken.
   *
   * Mock mode returns null and the cards show '—'. That is deliberate: the four
   * numbers here were hard-coded (24 / 8 / 3 / 2) and had never once reflected
   * anything, so a placeholder is strictly more truthful than what shipped.
   */
  private async loadStats(): Promise<void> {
    const stats = await this.vendorService.getVendorBidStatsAsync();
    if (stats) this.stats.set(stats);
  }

  // Angular template expressions cannot contain arrow functions, so the
  // picker is a key rather than a `(s: VendorDashboardStats) => number`
  // lambda — same null-safe intent, syntax the template parser accepts.
  statValue(key: keyof VendorDashboardStats): string {
    const stats = this.stats();
    return stats ? String(stats[key]) : '—';
  }

  private loadUserData(): void {
    const session = this.serviceAuthService.getCurrentUserSession();
    if (session?.userType === 'vendor') {
      const user = this.serviceAuthService.getCurrentUser() as Vendor;
      this.currentUser.set(user);
      
      // Check if pending verification
      if (user?.verificationStatus === 'pending') {
        this.router.navigate(['/verification-pending']);
        return;
      }
    } else {
      // Redirect to login if not authenticated
      this.router.navigate(['/login']);
    }
  }

  private loadDashboardData(): void {
    // Mock tender opportunities
    this.tenderOpportunities.set([
      {
        id: '1',
        title: 'Commercial Building Deep Cleaning',
        category: 'quick_service',
        location: 'New Delhi',
        budget: { min: 500, max: 1500 },
        deadline: new Date('2024-01-25'),
        bidCount: 8,
        postedAt: new Date('2024-01-18'),
        isUrgent: true,
      },
      {
        id: '2',
        title: 'Office Electrical Maintenance',
        category: 'mid_complexity',
        location: 'Gurugram',
        budget: { min: 300, max: 800 },
        deadline: new Date('2024-01-28'),
        bidCount: 5,
        postedAt: new Date('2024-01-17'),
      },
      {
        id: '3',
        title: 'Industrial HVAC Installation',
        category: 'technical',
        location: 'Noida',
        deadline: new Date('2024-02-01'),
        bidCount: 3,
        postedAt: new Date('2024-01-16'),
      },
    ]);

    // Mock bids
    this.myBids.set([
      {
        id: 'b1',
        tenderId: '1',
        tenderTitle: 'Warehouse Security System',
        category: 'technical',
        bidAmount: 2500,
        status: 'under_review',
        submittedAt: new Date('2024-01-15'),
      },
      {
        id: 'b2',
        tenderId: '2',
        tenderTitle: 'Restaurant Kitchen Plumbing',
        category: 'mid_complexity',
        bidAmount: 850,
        status: 'awarded',
        submittedAt: new Date('2024-01-12'),
      },
      {
        id: 'b3',
        tenderId: '3',
        tenderTitle: 'Corporate Catering Service',
        category: 'quick_service',
        bidAmount: 1200,
        status: 'submitted',
        submittedAt: new Date('2024-01-10'),
      },
    ]);

  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      quick_service: 'Quick Service',
      mid_complexity: 'Mid Complexity',
      technical: 'Technical',
    };
    return labels[category] || category;
  }

  getBidStatusLabel(status: BidStatus): string {
    const labels: Record<BidStatus, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      under_review: 'Under Review',
      shortlisted: 'Shortlisted',
      awarded: 'Awarded',
      rejected: 'Not Selected',
      withdrawn: 'Withdrawn',
    };
    return labels[status];
  }

  getBidStatusClass(status: BidStatus): string {
    const classes: Record<BidStatus, string> = {
      draft: 'status-draft',
      submitted: 'status-submitted',
      under_review: 'status-review',
      shortlisted: 'status-shortlisted',
      awarded: 'status-accepted',
      rejected: 'status-rejected',
      withdrawn: 'status-withdrawn',
    };
    return classes[status];
  }

  /** Human label for a tender deadline; never renders a negative count. */
  getDeadlineLabel(deadline: Date): string {
    return deadlineLabel(deadline);
  }

  isDeadlineUrgent(deadline: Date): boolean {
    return isUrgent(deadline);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

}
