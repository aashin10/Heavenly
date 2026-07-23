import { Component, inject, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { ManagementService } from './management.service';
import { ServiceRequestManagementService } from './service-request-management.service';
import { JobFilter, ServiceRequest, ServiceRequestFilter } from './management.model';
import { VendorAdminService } from '../../core/services/vendor-admin.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { VendorQueueComponent } from './vendors/vendor-queue.component';

type ManagementTab = 'service-requests' | 'jobs' | 'vendors';

@Component({
  selector: 'app-management-page',
  standalone: true,
  imports: [TitleCasePipe, StatusBadgeComponent, IconComponent, VendorQueueComponent],
  templateUrl: './management.page.html',
  styleUrl: './management.page.scss'
})
export class ManagementPageComponent {
  private readonly router = inject(Router);
  protected readonly managementService = inject(ManagementService);
  protected readonly srManagementService = inject(ServiceRequestManagementService);
  protected readonly vendorAdminService = inject(VendorAdminService);

  @ViewChildren('tabButton') tabButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  activeTab: ManagementTab = 'service-requests';

  readonly filterOptions: { value: JobFilter; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All Jobs' }
  ];

  readonly srFilterOptions: { value: ServiceRequestFilter; label: string }[] = [
    { value: 'pending', label: 'Pending Review' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'high_priority', label: 'High Priority' },
    { value: 'technical', label: 'Technical' },
    { value: 'needs_attention', label: 'Needs Attention' },
    { value: 'approved', label: 'Approved' },
    { value: 'all', label: 'All Requests' }
  ];

  setActiveTab(tab: ManagementTab): void {
    this.activeTab = tab;
  }

  setFilter(filter: JobFilter): void {
    this.managementService.setFilter(filter);
  }

  setSRFilter(filter: ServiceRequestFilter): void {
    this.srManagementService.setFilter(filter);
  }

  approveJob(jobId: string): void {
    this.managementService.updateJobStatus(jobId, 'approved');
  }

  rejectJob(jobId: string): void {
    this.managementService.updateJobStatus(jobId, 'rejected');
  }

  reviewRequest(request: ServiceRequest): void {
    this.router.navigate(['/management/review', request.id]);
  }

  quickApprove(request: ServiceRequest): void {
    const defaultReviewData = {
      tenderTitle: `${request.serviceName} - ${request.city}`,
      scopeSummary: request.description,
      commercialStructure: request.budgetMin && request.budgetMax 
        ? `Budget: ${request.budgetCurrency} ${request.budgetMin} - ${request.budgetMax}` 
        : 'To be discussed',
      bidWindowStart: this.addDays(new Date(), 1).toISOString().split('T')[0],
      bidWindowEnd: this.addDays(new Date(), 7).toISOString().split('T')[0],
      budgetVisibility: 'show_range' as const,
      tenderType: 'open' as const,
      eligibilityCriteria: {
        minExperience: true,
        minExperienceYears: 2,
        certifications: false,
        financialCapacity: false,
        previousWork: false
      },
      internalNotes: 'Quick approved from dashboard'
    };
    this.srManagementService.approveRequest(request.id, defaultReviewData);
  }

  publishTender(request: ServiceRequest): void {
    this.router.navigate(['/management/publish', request.id]);
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  getUrgencyClass(urgency: string): string {
    switch (urgency) {
      case 'urgent': return 'urgency--urgent';
      case 'high': return 'urgency--high';
      case 'medium': return 'urgency--medium';
      default: return 'urgency--low';
    }
  }

  getCategoryLabel(category: string): string {
    switch (category) {
      case 'technical': return 'Technical';
      case 'mid_complexity': return 'Mid-Complexity';
      case 'quick_service': return 'Quick Service';
      default: return category;
    }
  }

  getCategoryClass(category: string): string {
    switch (category) {
      case 'technical': return 'category--technical';
      case 'mid_complexity': return 'category--mid';
      case 'quick_service': return 'category--quick';
      default: return '';
    }
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Handles keyboard navigation for tab buttons per ARIA tab pattern.
   * Arrow keys move focus between tabs, Home/End jump to first/last tab.
   */
  handleTabKeydown(event: KeyboardEvent, currentIndex: number): void {
    const tabs = this.tabButtons.toArray();
    let newIndex: number;

    switch (event.key) {
      case 'ArrowRight':
        newIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    tabs[newIndex].nativeElement.focus();
    this.setFilter(this.filterOptions[newIndex].value);
  }
}
