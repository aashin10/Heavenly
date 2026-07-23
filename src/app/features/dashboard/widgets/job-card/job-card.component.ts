import { Component, Input, inject, signal } from '@angular/core';
import { Job } from '../../dashboard.model';
import { ToastService } from '../../../../core/services/toast.service';
import { formatDateSafe } from '../../../../shared/utils/helpers';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-job-card',
  standalone: true,
  imports: [StatusBadgeComponent, IconComponent],
  templateUrl: './job-card.component.html',
  styleUrl: './job-card.component.scss'
})
export class JobCardComponent {
  private readonly toastService = inject(ToastService);

  @Input({ required: true }) job!: Job;
  @Input() showActions = false;

  showDetails = signal(false);

  toggleDetails(): void {
    this.showDetails.update(v => !v);
  }

  handleApply(): void {
    this.toastService.success(
      `Application submitted for ${this.job.title} at ${this.job.company}! This is a demo.`
    );
  }

  formatDate(dateString: string): string {
    return formatDateSafe(dateString);
  }
}
