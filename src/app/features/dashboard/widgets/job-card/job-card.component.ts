import { Component, Input, signal } from '@angular/core';
import { Job } from '../../dashboard.model';

@Component({
  selector: 'app-job-card',
  standalone: true,
  imports: [],
  templateUrl: './job-card.component.html',
  styleUrl: './job-card.component.scss'
})
export class JobCardComponent {
  @Input({ required: true }) job!: Job;
  @Input() showActions = false;

  showDetails = signal(false);

  toggleDetails(): void {
    this.showDetails.update(v => !v);
  }

  handleApply(): void {
    alert(`Application submitted for ${this.job.title} at ${this.job.company}!\n\nThis is a demo. In a real application, this would process your application.`);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
}
