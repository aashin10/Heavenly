import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ServiceRequester } from '../../../core/models/service.model';
import {
  QuickAction,
  RequestSummary,
  DraftRequest,
  DashboardStats,
  QUICK_ACTIONS,
} from './service-requester-dashboard.model';

@Component({
  selector: 'app-service-requester-dashboard-page',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './service-requester-dashboard.page.html',
  styleUrl: './service-requester-dashboard.page.scss',
})
export class ServiceRequesterDashboardPageComponent implements OnInit {
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly router = inject(Router);

  // User data
  currentUser = signal<ServiceRequester | null>(null);

  // Quick actions
  quickActions = signal<QuickAction[]>(QUICK_ACTIONS);

  // Dashboard stats
  stats = signal<DashboardStats>({
    totalRequests: 0,
    activeRequests: 0,
    pendingReview: 0,
    completedRequests: 0,
    draftsCount: 0,
    activeTenders: 0,
  });

  // Recent requests
  recentRequests = signal<RequestSummary[]>([]);

  // Drafts
  drafts = signal<DraftRequest[]>([]);

  // Computed values
  greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  userName = computed(() => {
    const user = this.currentUser();
    if (!user) return 'User';
    
    // Type guard for different requester types based on requesterType property
    switch (user.requesterType) {
      case 'individual':
        return user.fullName || user.email?.split('@')[0] || 'User';
      case 'sme':
      case 'large_organization':
        return user.organizationName || user.email?.split('@')[0] || 'User';
    }
  });

  ngOnInit(): void {
    this.loadUserData();
    this.loadDashboardData();
  }

  private loadUserData(): void {
    const session = this.serviceAuthService.getCurrentUserSession();
    if (session?.userType === 'service_requester') {
      const user = this.serviceAuthService.getCurrentUser();
      this.currentUser.set(user as ServiceRequester);
    } else {
      // Redirect to login if not authenticated
      this.router.navigate(['/login']);
    }
  }

  private loadDashboardData(): void {
    // Mock data for Phase 1 - will be replaced with actual API calls in Phase 2
    this.stats.set({
      totalRequests: 12,
      activeRequests: 3,
      pendingReview: 2,
      completedRequests: 7,
      draftsCount: 2,
      activeTenders: 4,
    });

    // Mock recent requests
    this.recentRequests.set([
      {
        id: '1',
        title: 'Office Deep Cleaning',
        category: 'quick_service',
        status: 'published',
        createdAt: new Date('2024-01-15'),
        dueDate: new Date('2024-01-22'),
        bidCount: 5,
      },
      {
        id: '2',
        title: 'Electrical Maintenance',
        category: 'mid_complexity',
        status: 'approved',
        createdAt: new Date('2024-01-10'),
        bidCount: 3,
      },
      {
        id: '3',
        title: 'Plumbing Repair',
        category: 'technical',
        status: 'closed',
        createdAt: new Date('2024-01-05'),
      },
    ]);

    // Mock drafts
    this.drafts.set([
      {
        id: 'd1',
        title: 'Security System Installation',
        category: 'technical',
        lastModified: new Date('2024-01-18'),
        expiresAt: new Date('2024-01-25'),
        completionPercent: 60,
      },
      {
        id: 'd2',
        title: 'HVAC Maintenance',
        category: 'mid_complexity',
        lastModified: new Date('2024-01-17'),
        expiresAt: new Date('2024-01-24'),
        completionPercent: 30,
      },
    ]);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      under_review: 'Under Review',
      changes_required: 'Changes Required',
      approved: 'Approved',
      published: 'Published',
      closed: 'Closed',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      draft: 'status-draft',
      submitted: 'status-submitted',
      under_review: 'status-review',
      changes_required: 'status-changes',
      approved: 'status-approved',
      published: 'status-published',
      closed: 'status-closed',
      cancelled: 'status-cancelled',
    };
    return classes[status] || '';
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      quick_service: 'Quick Service',
      mid_complexity: 'Mid Complexity',
      technical: 'Technical',
    };
    return labels[category] || category;
  }

  getDaysRemaining(expiresAt: Date): number {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
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
