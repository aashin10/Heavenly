import { Component, inject, computed, signal } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DashboardService } from '../../dashboard.service';
import { JobFormData } from '../../dashboard.model';
import { JobCardComponent } from '../../widgets/job-card/job-card.component';
import { JobPostingFormComponent } from '../../widgets/job-posting-form/job-posting-form.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-employer-dashboard',
  standalone: true,
  imports: [JobCardComponent, JobPostingFormComponent, IconComponent],
  templateUrl: './employer.page.html',
  styleUrl: './employer.page.scss'
})
export class EmployerPageComponent {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly toastService = inject(ToastService);

  readonly user = this.authService.user;
  showForm = signal(false);

  readonly userJobs = computed(() => {
    const currentUser = this.user();
    if (!currentUser) return [];
    return this.dashboardService.getUserJobs(currentUser.id);
  });

  readonly pendingCount = computed(() => 
    this.userJobs().filter(job => job.status === 'pending').length
  );

  readonly approvedCount = computed(() => 
    this.userJobs().filter(job => job.status === 'approved').length
  );

  readonly rejectedCount = computed(() => 
    this.userJobs().filter(job => job.status === 'rejected').length
  );

  toggleForm(): void {
    this.showForm.update(v => !v);
  }

  handleJobSubmit(formData: JobFormData): void {
    const currentUser = this.user();
    if (!currentUser) return;

    this.dashboardService.addJob(formData, currentUser.id);
    this.showForm.set(false);
    this.toastService.success('Job posted successfully! Pending approval from management.');
  }

  handleFormCancel(): void {
    this.showForm.set(false);
  }
}
