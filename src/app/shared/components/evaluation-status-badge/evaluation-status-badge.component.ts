import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiveTender, EvaluationPhase } from '../../../features/management/evaluation/evaluation.model';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-evaluation-status-badge',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <span class="evaluation-status-badge" [ngClass]="'status-' + getStatus()">
      <app-icon class="status-icon" [name]="getStatusIcon()" [size]="14" />
      {{ getStatusLabel() }}
    </span>
  `,
  styles: [`
    .evaluation-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status-icon {
      display: inline-flex;
      align-items: center;
    }
    
    .status-accepting_bids {
      background: #dbeafe;
      color: #1d4ed8;
    }
    
    .status-bid_closed {
      background: #fef3c7;
      color: #92400e;
    }
    
    .status-technical_review {
      background: #ede9fe;
      color: #6d28d9;
    }
    
    .status-commercial_review {
      background: #fce7f3;
      color: #be185d;
    }
    
    .status-shortlisted {
      background: #cffafe;
      color: #0891b2;
    }
    
    .status-awarded {
      background: #d1fae5;
      color: #065f46;
    }
    
    .status-cancelled {
      background: #fee2e2;
      color: #991b1b;
    }
  `]
})
export class EvaluationStatusBadgeComponent {
  @Input() tender!: LiveTender;
  @Input() phase?: EvaluationPhase;
  
  getStatus(): string {
    return this.phase || this.tender?.evaluationPhase || 'accepting_bids';
  }
  
  getStatusLabel(): string {
    const status = this.getStatus();
    const labels: Record<string, string> = {
      'accepting_bids': 'Accepting Bids',
      'bid_closed': 'Bid Closed',
      'technical_review': 'Technical Review',
      'commercial_review': 'Commercial Review',
      'shortlisted': 'Shortlisted',
      'awarded': 'Awarded',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  }
  
  getStatusIcon(): string {
    const status = this.getStatus();
    const icons: Record<string, string> = {
      'accepting_bids': 'inbox',
      'bid_closed': 'lock',
      'technical_review': 'search',
      'commercial_review': 'indian-rupee',
      'shortlisted': 'star',
      'awarded': 'award',
      'cancelled': 'circle-x'
    };
    return icons[status] || 'clipboard-list';
  }
}
