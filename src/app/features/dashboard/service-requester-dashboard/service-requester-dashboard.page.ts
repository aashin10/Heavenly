import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ServiceRequester } from '../../../core/models/service.model';
import { ServiceRequestService } from '../../../core/services/service-request.service';
import { DraftService } from '../../../core/services/draft.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { expiryLabel, isUrgent } from '../../../shared/utils/deadline.util';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
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
  imports: [RouterLink, IconComponent, EmptyStateComponent, StatusBadgeComponent, AppDatePipe],
  templateUrl: './service-requester-dashboard.page.html',
  styleUrl: './service-requester-dashboard.page.scss',
})
export class ServiceRequesterDashboardPageComponent implements OnInit {
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly requestService = inject(ServiceRequestService);
  private readonly draftService = inject(DraftService);
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
    void this.loadDashboardData();
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

  private async loadDashboardData(): Promise<void> {
    const requesterId = this.serviceAuthService.getCurrentUserSession()?.id;
    const requests = requesterId
      ? (await this.requestService.getRequestsByRequesterAsync(requesterId))
          .sort((a, b) => this.timeOf(b.updatedAt) - this.timeOf(a.updatedAt))
      : [];
    const drafts = (await this.draftService.getAllDraftsAsync())
      .sort((a, b) => this.timeOf(b.lastSaved) - this.timeOf(a.lastSaved));

    const isActive = (s: string) =>
      s === 'submitted' || s === 'under_review' || s === 'changes_required' || s === 'approved';

    this.stats.set({
      totalRequests: requests.length,
      activeRequests: requests.filter(r => isActive(r.status)).length,
      pendingReview: requests.filter(r => r.status === 'submitted' || r.status === 'under_review').length,
      completedRequests: requests.filter(r => r.status === 'closed').length,
      draftsCount: drafts.length,
      activeTenders: requests.filter(r => r.status === 'published').length,
    });

    // Show the three most recent of each; the rest live on /my-requests.
    this.recentRequests.set(
      requests.slice(0, 3).map(r => ({
        id: r.id!,
        title: r.serviceName,
        category: r.category,
        status: r.status,
        createdAt: r.submittedAt ?? r.createdAt,
      }))
    );

    this.drafts.set(
      drafts.slice(0, 3).map(d => ({
        id: d.id,
        title: d.serviceName,
        category: d.category,
        lastModified: d.lastSaved,
        expiresAt: d.expiresAt,
        completionPercent: d.totalSteps
          ? Math.round(((d.currentStep - 1) / d.totalSteps) * 100)
          : 0,
      }))
    );
  }

  private timeOf(d: Date | string | undefined): number {
    return d ? new Date(d).getTime() : 0;
  }

  async continueDraft(draftId: string): Promise<void> {
    const draft = await this.draftService.getDraftAsync(draftId);
    this.router.navigate(['/service-request/new'], {
      queryParams: { draftId, step: draft?.currentStep ?? 1 },
    });
  }

  // Status label/class helpers removed — the recent-requests card now uses the
  // shared <app-status-badge>, so the per-page status map is no longer needed.

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      quick_service: 'Quick Service',
      mid_complexity: 'Mid Complexity',
      technical: 'Technical',
    };
    return labels[category] || category;
  }

  /** Human label for draft expiry; never renders a negative count. */
  getExpiryLabel(expiresAt: Date): string {
    return expiryLabel(expiresAt);
  }

  isExpiringSoon(expiresAt: Date): boolean {
    return isUrgent(expiresAt, 2);
  }

  navigateTo(route: string): void {
    // Quick-action routes may carry query params (e.g. /my-requests?tab=drafts),
    // so route via URL rather than a single path segment.
    this.router.navigateByUrl(route);
  }

}
