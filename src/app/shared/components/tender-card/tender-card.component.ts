import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PublishedTender } from '../../../features/vendor/vendor.model';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { TimeRemainingPipe } from '../../pipes/time-remaining.pipe';

@Component({
  selector: 'app-tender-card',
  standalone: true,
  imports: [TimeAgoPipe, TimeRemainingPipe],
  template: `
    <div class="tender-card" [class.highlighted]="highlighted" (click)="onCardClick()">
      <div class="card-header">
        <h3 class="tender-title">{{ tender.title }}</h3>
        <span class="category-badge" [attr.data-category]="tender.category">
          {{ tender.categoryLabel }}
        </span>
      </div>
      
      <div class="card-body">
        <div class="tender-info">
          <div class="info-item">
            <span class="icon">📍</span>
            <span>{{ tender.location }}</span>
          </div>
          <div class="info-item">
            <span class="icon">💰</span>
            <span>{{ getBudgetDisplay() }}</span>
          </div>
          <div class="info-item">
            <span class="icon">📅</span>
            <span>Posted {{ tender.publishedAt | timeAgo }}</span>
          </div>
        </div>
        
        <p class="tender-summary">{{ getTruncatedSummary() }}</p>
        
        <div class="tender-tags">
          @for (tag of tender.tags.slice(0, 3); track tag) {
            <span class="tag">{{ tag }}</span>
          }
        </div>
      </div>
      
      <div class="card-footer">
        <div class="deadline-info" [class.urgent]="isClosingSoon()">
          <span class="icon">⏰</span>
          <span>Closes {{ tender.bidWindowEnd | timeRemaining }}</span>
        </div>
        
        <button class="btn-view" (click)="onViewDetails($event)">
          View Details →
        </button>
      </div>
    </div>
  `,
  styles: [`
    .tender-card {
      background: white;
      border-radius: 12px;
      border: 1px solid var(--gray-200, #e2e8f0);
      padding: 1.25rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      height: 100%;
      
      &:hover {
        border-color: var(--gray-300, #cbd5e1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        transform: translateY(-2px);
      }
      
      &.highlighted {
        border-color: var(--primary-color, #003664);
        box-shadow: 0 0 0 3px rgba(0, 54, 100, 0.1);
      }
    }
    
    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    
    .tender-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--gray-900, #0f172a);
      margin: 0;
      line-height: 1.4;
      flex: 1;
    }
    
    .category-badge {
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      white-space: nowrap;
      flex-shrink: 0;
      
      &[data-category="quick_service"] {
        background: var(--green-100, #dcfce7);
        color: var(--green-700, #15803d);
      }
      
      &[data-category="mid_complexity"] {
        background: var(--yellow-100, #fef3c7);
        color: var(--yellow-700, #a16207);
      }
      
      &[data-category="technical"] {
        background: var(--blue-100, #dbeafe);
        color: var(--blue-700, #1d4ed8);
      }
    }
    
    .card-body {
      flex: 1;
    }
    
    .tender-info {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    
    .info-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--gray-600, #475569);
      
      .icon {
        font-size: 0.875rem;
      }
    }
    
    .tender-summary {
      font-size: 0.875rem;
      color: var(--gray-600, #475569);
      line-height: 1.5;
      margin: 0 0 0.75rem;
    }
    
    .tender-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      margin-bottom: 1rem;
    }
    
    .tag {
      padding: 0.25rem 0.5rem;
      background: var(--gray-100, #f1f5f9);
      color: var(--gray-600, #475569);
      border-radius: 4px;
      font-size: 0.75rem;
    }
    
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 1rem;
      border-top: 1px solid var(--gray-100, #f1f5f9);
      margin-top: auto;
    }
    
    .deadline-info {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--gray-500, #64748b);
      
      &.urgent {
        color: var(--red-600, #dc2626);
        font-weight: 500;
      }
    }
    
    .btn-view {
      background: none;
      border: none;
      color: var(--primary-color, #003664);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      padding: 0.375rem 0;
      transition: color 0.2s;
      
      &:hover {
        color: var(--primary-dark, #002a4f);
      }
    }
  `]
})
export class TenderCardComponent {
  @Input({ required: true }) tender!: PublishedTender;
  @Input() highlighted = false;
  @Output() cardClick = new EventEmitter<void>();
  @Output() viewDetails = new EventEmitter<void>();

  onCardClick(): void {
    this.cardClick.emit();
  }

  onViewDetails(event: Event): void {
    event.stopPropagation();
    this.viewDetails.emit();
  }

  getBudgetDisplay(): string {
    if (this.tender.budgetVisibility === 'hide') {
      return 'Budget not disclosed';
    } else if (this.tender.budgetVisibility === 'show_range' && this.tender.budgetMin && this.tender.budgetMax) {
      return `₹${this.formatBudget(this.tender.budgetMin)} - ₹${this.formatBudget(this.tender.budgetMax)}`;
    } else if (this.tender.budgetExact) {
      return `₹${this.formatBudget(this.tender.budgetExact)}`;
    }
    return 'Budget not specified';
  }

  getTruncatedSummary(): string {
    const maxLength = 150;
    if (this.tender.scopeSummary.length <= maxLength) {
      return this.tender.scopeSummary;
    }
    return this.tender.scopeSummary.substring(0, maxLength).trim() + '...';
  }

  isClosingSoon(): boolean {
    const closeDate = new Date(this.tender.bidWindowEnd);
    const now = new Date();
    const hoursLeft = (closeDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursLeft <= 48 && hoursLeft > 0;
  }

  private formatBudget(amount: number): string {
    if (amount >= 10000000) {
      return (amount / 10000000).toFixed(1) + ' Cr';
    }
    if (amount >= 100000) {
      return (amount / 100000).toFixed(1) + ' L';
    }
    if (amount >= 1000) {
      return (amount / 1000).toFixed(0) + 'K';
    }
    return amount.toString();
  }
}
