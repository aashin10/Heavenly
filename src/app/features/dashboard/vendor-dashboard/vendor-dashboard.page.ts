import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { Vendor } from '../../../core/models/service.model';
import {
  TenderOpportunity,
  VendorBid,
  VendorDashboardStats,
  ProfileSection,
  PROFILE_SECTIONS,
} from './vendor-dashboard.model';

@Component({
  selector: 'app-vendor-dashboard-page',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './vendor-dashboard.page.html',
  styleUrl: './vendor-dashboard.page.scss',
})
export class VendorDashboardPageComponent implements OnInit {
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly router = inject(Router);

  // User data
  currentUser = signal<Vendor | null>(null);

  // Dashboard stats
  stats = signal<VendorDashboardStats>({
    openTenders: 0,
    myBids: 0,
    wonBids: 0,
    activeProjects: 0,
    profileCompletion: 0,
  });

  // Tender opportunities
  tenderOpportunities = signal<TenderOpportunity[]>([]);

  // My bids
  myBids = signal<VendorBid[]>([]);

  // Profile sections
  profileSections = signal<ProfileSection[]>(PROFILE_SECTIONS);

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

  ngOnInit(): void {
    this.loadUserData();
    this.loadDashboardData();
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
    // Mock data for Phase 1 - will be replaced with actual API calls in Phase 2
    this.stats.set({
      openTenders: 24,
      myBids: 8,
      wonBids: 3,
      activeProjects: 2,
      profileCompletion: 75,
      rating: 4.5,
    });

    // Mock tender opportunities
    this.tenderOpportunities.set([
      {
        id: '1',
        title: 'Commercial Building Deep Cleaning',
        category: 'quick_service',
        location: 'Muscat',
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
        location: 'Sohar',
        budget: { min: 300, max: 800 },
        deadline: new Date('2024-01-28'),
        bidCount: 5,
        postedAt: new Date('2024-01-17'),
      },
      {
        id: '3',
        title: 'Industrial HVAC Installation',
        category: 'technical',
        location: 'Salalah',
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
        status: 'under-review',
        submittedAt: new Date('2024-01-15'),
      },
      {
        id: 'b2',
        tenderId: '2',
        tenderTitle: 'Restaurant Kitchen Plumbing',
        category: 'mid_complexity',
        bidAmount: 850,
        status: 'accepted',
        submittedAt: new Date('2024-01-12'),
      },
      {
        id: 'b3',
        tenderId: '3',
        tenderTitle: 'Corporate Catering Service',
        category: 'quick_service',
        bidAmount: 1200,
        status: 'pending',
        submittedAt: new Date('2024-01-10'),
      },
    ]);

    // Update profile sections based on user data
    const user = this.currentUser();
    if (user) {
      this.profileSections.update((sections) =>
        sections.map((section) => ({
          ...section,
          isComplete: this.checkSectionComplete(section.id, user),
        }))
      );
    }
  }

  private checkSectionComplete(sectionId: string, user: Vendor): boolean {
    // Mock logic - in real app would check actual user data
    switch (sectionId) {
      case 'basic':
        return !!(user.businessName && user.email);
      case 'documents':
        return false; // Placeholder
      case 'services':
        return user.serviceCapabilities && user.serviceCapabilities.length > 0;
      case 'portfolio':
        return false; // Placeholder
      case 'bank':
        return false; // Placeholder
      default:
        return false;
    }
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      quick_service: 'Quick Service',
      mid_complexity: 'Mid Complexity',
      technical: 'Technical',
    };
    return labels[category] || category;
  }

  getBidStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      'under-review': 'Under Review',
      accepted: 'Accepted',
      rejected: 'Rejected',
    };
    return labels[status] || status;
  }

  getBidStatusClass(status: string): string {
    const classes: Record<string, string> = {
      pending: 'status-pending',
      'under-review': 'status-review',
      accepted: 'status-accepted',
      rejected: 'status-rejected',
    };
    return classes[status] || '';
  }

  getDaysRemaining(deadline: Date): number {
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  logout(): void {
    this.serviceAuthService.logout();
    this.router.navigate(['/login']);
  }
}
