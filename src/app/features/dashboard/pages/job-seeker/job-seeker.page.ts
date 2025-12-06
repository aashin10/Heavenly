import { Component, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../dashboard.service';
import { DOMAIN_OPTIONS, JOB_TYPE_OPTIONS } from '../../dashboard.model';
import { JobCardComponent } from '../../widgets/job-card/job-card.component';

@Component({
  selector: 'app-job-seeker-dashboard',
  standalone: true,
  imports: [FormsModule, JobCardComponent],
  templateUrl: './job-seeker.page.html',
  styleUrl: './job-seeker.page.scss'
})
export class JobSeekerPageComponent {
  private readonly dashboardService = inject(DashboardService);

  readonly domains = DOMAIN_OPTIONS;
  readonly jobTypes = JOB_TYPE_OPTIONS;

  searchQuery = signal('');
  selectedDomain = signal('All');
  selectedType = signal('All');

  readonly approvedJobs = computed(() => this.dashboardService.getApprovedJobs());

  readonly filteredJobs = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const domain = this.selectedDomain();
    const type = this.selectedType();

    return this.approvedJobs().filter(job => {
      const matchesSearch = 
        job.title.toLowerCase().includes(query) ||
        job.company.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query);
      const matchesDomain = domain === 'All' || job.domain === domain;
      const matchesType = type === 'All' || job.type === type;
      return matchesSearch && matchesDomain && matchesType;
    });
  });

  updateSearch(value: string): void {
    this.searchQuery.set(value);
  }

  updateDomain(value: string): void {
    this.selectedDomain.set(value);
  }

  updateType(value: string): void {
    this.selectedType.set(value);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedDomain.set('All');
    this.selectedType.set('All');
  }
}
