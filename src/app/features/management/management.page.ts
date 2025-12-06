import { Component, inject, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ManagementService } from './management.service';
import { JobFilter } from './management.model';

@Component({
  selector: 'app-management-page',
  standalone: true,
  imports: [TitleCasePipe],
  templateUrl: './management.page.html',
  styleUrl: './management.page.scss'
})
export class ManagementPageComponent {
  protected readonly managementService = inject(ManagementService);

  @ViewChildren('tabButton') tabButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  readonly filterOptions: { value: JobFilter; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All Jobs' }
  ];

  setFilter(filter: JobFilter): void {
    this.managementService.setFilter(filter);
  }

  approveJob(jobId: string): void {
    this.managementService.updateJobStatus(jobId, 'approved');
  }

  rejectJob(jobId: string): void {
    this.managementService.updateJobStatus(jobId, 'rejected');
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
    // Focus the new tab and activate it
    tabs[newIndex].nativeElement.focus();
    this.setFilter(this.filterOptions[newIndex].value);
  }
}
