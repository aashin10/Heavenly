import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LiveTender, EvaluationBid, TechnicalStatus } from '../../evaluation.model';
import { EvaluationService } from '../../evaluation.service';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../../../../shared/components/status-badge/status-badge.component';
import { formatAppDateTime } from '../../../../../shared/utils/date-format.util';

@Component({
  selector: 'app-technical-evaluation-tab',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, EmptyStateComponent, StatusBadgeComponent],
  template: `
    <div class="technical-evaluation-tab">
      <!-- Tab Header -->
      <div class="tab-header">
        <div class="header-info">
          <h2>Technical Proposal Evaluation</h2>
          <p>Review technical proposals and score vendor capabilities. Commercial proposals remain sealed during this phase.</p>
        </div>
        <div class="header-stats">
          <div class="stat pending">
            <span class="stat-value">{{ pendingBids().length }}</span>
            <span class="stat-label">Pending</span>
          </div>
          <div class="stat approved">
            <span class="stat-value">{{ approvedBids().length }}</span>
            <span class="stat-label">Approved</span>
          </div>
          <div class="stat rejected">
            <span class="stat-value">{{ rejectedBids().length }}</span>
            <span class="stat-label">Rejected</span>
          </div>
        </div>
      </div>
      
      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button 
          class="filter-tab"
          [class.active]="filterStatus() === 'all'"
          (click)="filterStatus.set('all')">
          All Bids ({{ bids.length }})
        </button>
        <button 
          class="filter-tab"
          [class.active]="filterStatus() === 'pending'"
          (click)="filterStatus.set('pending')">
          Pending ({{ pendingBids().length }})
        </button>
        <button 
          class="filter-tab"
          [class.active]="filterStatus() === 'qualified'"
          (click)="filterStatus.set('qualified')">
          Qualified ({{ approvedBids().length }})
        </button>
        <button 
          class="filter-tab"
          [class.active]="filterStatus() === 'disqualified'"
          (click)="filterStatus.set('disqualified')">
          Disqualified ({{ rejectedBids().length }})
        </button>
      </div>
      
      <!-- Bids List -->
      @if (filteredBids().length > 0) {
        <div class="bids-list">
          @for (bid of filteredBids(); track bid.id) {
            <div class="bid-card" [class]="'status-' + bid.technicalStatus">
              <div class="bid-header">
                <div class="vendor-info">
                  <div class="vendor-avatar">
                    {{ bid.vendorDisplayName.charAt(0) }}
                  </div>
                  <div class="vendor-details">
                    <h3>{{ bid.vendorDisplayName }}</h3>
                    <span class="bid-id">{{ bid.bidId }}</span>
                  </div>
                </div>
                <app-status-badge
                  [status]="bid.technicalStatus"
                  [label]="getStatusLabel(bid.technicalStatus)" />
              </div>
              
              <div class="bid-body">
                <!-- Technical Proposal Summary -->
                <div class="proposal-summary">
                  <div class="summary-item">
                    <span class="item-label">Experience</span>
                    <span class="item-value">{{ bid.yearsOfExperience }} years</span>
                  </div>
                  <div class="summary-item">
                    <span class="item-label">References</span>
                    <span class="item-value">{{ bid.similarWorkReferences.length }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="item-label">Documents</span>
                    <span class="item-value">{{ bid.documents.length }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="item-label">Timeline</span>
                    <span class="item-value">{{ bid.deliveryTimeline }}</span>
                  </div>
                </div>
                
                <!-- Technical Score (if evaluated) -->
                @if (bid.technicalStatus !== 'pending' && bid.technicalScore) {
                  <div class="score-section">
                    <div class="score-circle" [class.high]="bid.technicalScore >= 70" [class.medium]="bid.technicalScore >= 50 && bid.technicalScore < 70" [class.low]="bid.technicalScore < 50">
                      <span class="score-value">{{ bid.technicalScore }}</span>
                      <span class="score-max">/100</span>
                    </div>
                    <span class="score-label">Technical Score</span>
                  </div>
                }
                
                <!-- Rejection Reason -->
                @if (bid.technicalStatus === 'disqualified' && bid.disqualificationReason) {
                  <div class="rejection-reason">
                    <span class="reason-label">Disqualification Reason:</span>
                    <span class="reason-text">{{ bid.disqualificationReason }}</span>
                  </div>
                }
              </div>
              
              <div class="bid-footer">
                <span class="submitted-date">
                  Submitted: {{ formatDate(bid.submittedAt) }}
                </span>
                <div class="bid-actions">
                  @if (bid.technicalStatus === 'pending') {
                    <a [routerLink]="['/management/evaluation', tender.id, 'technical', bid.id]" class="btn-primary">
                      Review Proposal
                    </a>
                  } @else {
                    <a [routerLink]="['/management/evaluation', tender.id, 'technical', bid.id]" class="btn-secondary">
                      View Details
                    </a>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <app-empty-state
          icon="clipboard-list"
          title="No Bids Found"
          message="@if (filterStatus() !== 'all') {
              No bids match the selected filter. Try selecting a different status.
            } @else {
              This tender has not received any bids yet.
            }" />
      }
    </div>
  `,
  styleUrls: ['./technical-evaluation-tab.component.scss']
})
export class TechnicalEvaluationTabComponent {
  @Input() tender!: LiveTender;
  @Input() bids: EvaluationBid[] = [];
  @Output() bidUpdated = new EventEmitter<void>();
  
  private readonly evaluationService = inject(EvaluationService);
  
  filterStatus = signal<TechnicalStatus | 'all'>('all');
  
  pendingBids = computed(() => 
    this.bids.filter(b => b.technicalStatus === 'pending')
  );
  
  approvedBids = computed(() => 
    this.bids.filter(b => b.technicalStatus === 'qualified')
  );
  
  rejectedBids = computed(() => 
    this.bids.filter(b => b.technicalStatus === 'disqualified')
  );
  
  filteredBids = computed(() => {
    const status = this.filterStatus();
    if (status === 'all') return this.bids;
    return this.bids.filter(b => b.technicalStatus === status);
  });
  
  getStatusLabel(status: TechnicalStatus): string {
    const labels: Record<TechnicalStatus, string> = {
      'pending': 'Pending Review',
      'qualified': 'Qualified',
      'disqualified': 'Disqualified'
    };
    return labels[status] || status;
  }
  
  formatDate(date: string | Date): string {
    return formatAppDateTime(date);
  }
}
