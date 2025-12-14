import { Component, Input } from '@angular/core';

type StatusType = 
  | 'submitted' 
  | 'under_review' 
  | 'changes_required' 
  | 'approved' 
  | 'published' 
  | 'closed' 
  | 'rejected'
  | 'pending'
  | 'answered'
  | 'forwarded'
  | 'draft'
  | 'live';

const STATUS_CONFIG: Record<StatusType, { label: string; className: string }> = {
  submitted: { label: 'Submitted', className: 'status--gray' },
  under_review: { label: 'Under Review', className: 'status--blue' },
  changes_required: { label: 'Changes Required', className: 'status--yellow' },
  approved: { label: 'Approved', className: 'status--green' },
  published: { label: 'Published', className: 'status--purple' },
  closed: { label: 'Closed', className: 'status--gray' },
  rejected: { label: 'Rejected', className: 'status--red' },
  pending: { label: 'Pending', className: 'status--yellow' },
  answered: { label: 'Answered', className: 'status--green' },
  forwarded: { label: 'Forwarded', className: 'status--blue' },
  draft: { label: 'Draft', className: 'status--gray' },
  live: { label: 'Live', className: 'status--purple' }
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span class="status-badge" [class]="getStatusClass()">
      {{ getStatusLabel() }}
    </span>
  `,
  styles: [`
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .status--gray {
      background-color: var(--gray-100);
      color: var(--gray-700);
    }

    .status--blue {
      background-color: var(--blue-50, #eff6ff);
      color: #1d4ed8;
    }

    .status--yellow {
      background-color: var(--yellow-100);
      color: var(--yellow-800, #854d0e);
    }

    .status--green {
      background-color: var(--green-100);
      color: var(--green-800, #166534);
    }

    .status--red {
      background-color: var(--red-100);
      color: var(--red-700);
    }

    .status--purple {
      background-color: #f3e8ff;
      color: #7c3aed;
    }
  `]
})
export class StatusBadgeComponent {
  @Input() status: string = 'submitted';

  getStatusClass(): string {
    const config = STATUS_CONFIG[this.status as StatusType];
    return config?.className || 'status--gray';
  }

  getStatusLabel(): string {
    const config = STATUS_CONFIG[this.status as StatusType];
    return config?.label || this.status;
  }
}
