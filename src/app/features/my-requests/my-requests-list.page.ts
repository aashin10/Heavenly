import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ServiceAuthService } from '../../core/services/service-auth.service';
import {
  ServiceRequestService,
  ServiceRequestSubmission,
} from '../../core/services/service-request.service';
import { DraftService, ServiceRequestDraft } from '../../core/services/draft.service';
import { getCategoryShortLabel } from '../../shared/utils/service-category.util';
import { expiryLabel, isUrgent } from '../../shared/utils/deadline.util';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { REQUEST_FILTERS } from './my-requests.model';

type Tab = 'requests' | 'drafts';

@Component({
  selector: 'app-my-requests-list-page',
  standalone: true,
  imports: [
    RouterLink,
    IconComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    AppDatePipe,
  ],
  templateUrl: './my-requests-list.page.html',
  styleUrl: './my-requests-list.page.scss',
})
export class MyRequestsListPageComponent implements OnInit {
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly requestService = inject(ServiceRequestService);
  private readonly draftService = inject(DraftService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly filters = REQUEST_FILTERS;

  activeTab = signal<Tab>('requests');
  activeFilter = signal<string>('all');

  requests = signal<ServiceRequestSubmission[]>([]);
  drafts = signal<ServiceRequestDraft[]>([]);

  changesNeededCount = computed(
    () => this.requests().filter(r => r.status === 'changes_required').length
  );

  filteredRequests = computed(() => {
    const filter = this.filters.find(f => f.id === this.activeFilter());
    const all = this.requests();
    if (!filter || filter.statuses === 'all') return all;
    return all.filter(r => (filter.statuses as string[]).includes(r.status));
  });

  ngOnInit(): void {
    void this.loadData();

    // Honour deep-links from the dashboard quick actions
    // (?tab=drafts, ?filter=live).
    const params = this.route.snapshot.queryParamMap;
    if (params.get('tab') === 'drafts') this.activeTab.set('drafts');
    const filter = params.get('filter');
    if (filter && this.filters.some(f => f.id === filter)) {
      this.activeFilter.set(filter);
    }
  }

  private async loadData(): Promise<void> {
    const session = this.serviceAuthService.getCurrentUserSession();
    const requesterId = session?.id;
    if (requesterId) {
      const mine = (await this.requestService.getRequestsByRequesterAsync(requesterId))
        .sort((a, b) => this.time(b.updatedAt) - this.time(a.updatedAt));
      this.requests.set(mine);
    }
    this.drafts.set(
      (await this.draftService.getAllDraftsAsync())
        .sort((a, b) => this.time(b.lastSaved) - this.time(a.lastSaved))
    );
  }

  private time(d: Date | string | undefined): number {
    return d ? new Date(d).getTime() : 0;
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  setFilter(id: string): void {
    this.activeFilter.set(id);
  }

  categoryLabel(category: string): string {
    return getCategoryShortLabel(category);
  }

  draftProgress(draft: ServiceRequestDraft): number {
    if (!draft.totalSteps) return 0;
    // currentStep is 1-based; completed steps = currentStep - 1.
    return Math.round(((draft.currentStep - 1) / draft.totalSteps) * 100);
  }

  draftExpiryLabel(draft: ServiceRequestDraft): string {
    return expiryLabel(draft.expiresAt);
  }

  isDraftExpiringSoon(draft: ServiceRequestDraft): boolean {
    return isUrgent(draft.expiresAt, 2);
  }

  continueDraft(draft: ServiceRequestDraft): void {
    this.router.navigate(['/service-request/new'], {
      queryParams: { draftId: draft.id, step: draft.currentStep },
    });
  }

  async discardDraft(draft: ServiceRequestDraft, event: Event): Promise<void> {
    event.stopPropagation();
    await this.draftService.clearDraftAsync(draft.id);
    await this.loadData();
  }
}
