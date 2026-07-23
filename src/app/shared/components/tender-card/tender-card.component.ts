import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublishedTender } from '../../../features/vendor/vendor.model';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { TimeRemainingPipe } from '../../pipes/time-remaining.pipe';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-tender-card',
  standalone: true,
  imports: [TimeAgoPipe, TimeRemainingPipe, RouterLink, IconComponent],
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
            <app-icon name="map-pin" [size]="15" />
            <span>{{ tender.location }}</span>
          </div>
          <div class="info-item">
            <app-icon name="indian-rupee" [size]="15" />
            <span>{{ getBudgetDisplay() }}</span>
          </div>
          <div class="info-item">
            <app-icon name="calendar" [size]="15" />
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
          <app-icon name="clock" [size]="15" />
          @if (isClosed()) {
            <span>Bidding closed</span>
          } @else {
            <span>Closes {{ tender.bidWindowEnd | timeRemaining }}</span>
          }
        </div>

        @if (detailLink) {
          <a class="btn-view" [routerLink]="detailLink" (click)="$event.stopPropagation()">
            View Details
            <app-icon name="arrow-right" [size]="15" />
          </a>
        } @else {
          <button class="btn-view" type="button" (click)="onViewDetails($event)">
            View Details
            <app-icon name="arrow-right" [size]="15" />
          </button>
        }
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

      app-icon {
        color: var(--gray-400, #9ca3af);
        flex: none;
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
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background: none;
      border: none;
      color: var(--navy-800, #003664);
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0.375rem 0;
      text-decoration: none;
      transition: color 0.2s;

      app-icon {
        transition: transform 0.2s;
      }

      &:hover {
        color: var(--accent-600, #c8102e);
      }

      &:hover app-icon {
        transform: translateX(3px);
      }
    }
  `]
})
export class TenderCardComponent {
  @Input({ required: true }) tender!: PublishedTender;
  @Input() highlighted = false;
  /**
   * Router link for the tender detail page. When provided, "View Details"
   * renders as a real anchor so it can be middle-clicked / opened in a new tab
   * and is announced as a link. Falls back to the click output when omitted.
   */
  @Input() detailLink: string | unknown[] | null = null;
  @Output() cardClick = new EventEmitter<void>();
  @Output() viewDetails = new EventEmitter<void>();

  /** Avoids rendering "Closes Closed" once the bid window has passed. */
  isClosed(): boolean {
    return new Date(this.tender.bidWindowEnd).getTime() <= Date.now();
  }

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
