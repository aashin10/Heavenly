import { Component, inject } from '@angular/core';
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
}
