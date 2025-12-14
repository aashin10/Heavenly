import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LiveTender, EvaluationBid } from '../../evaluation.model';
import { EvaluationService } from '../../evaluation.service';

@Component({
  selector: 'app-commercial-evaluation-tab',
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe],
  template: `
    <div class="commercial-evaluation-tab">
      <!-- Tab Header -->
      <div class="tab-header">
        <div class="header-info">
          <h2>Commercial Proposal Comparison</h2>
          <p>Compare pricing and terms from technically qualified vendors. Only vendors who passed technical evaluation are shown.</p>
        </div>
        <div class="header-actions">
          <button class="btn-calculate" (click)="calculateValueScores()">
            <span class="icon">📊</span>
            Calculate Value Scores
          </button>
        </div>
      </div>
      
      @if (qualifiedBids().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <h3>No Bids Available</h3>
          <p>Complete technical evaluation first. Only vendors who pass technical review will have their commercial proposals unsealed.</p>
        </div>
      } @else {
        <!-- Comparison Table -->
        <div class="comparison-table-container">
          <table class="comparison-table">
            <thead>
              <tr>
                <th class="col-vendor">Vendor</th>
                <th class="col-price">Total Price</th>
                <th class="col-breakdown">Price Breakdown</th>
                <th class="col-payment">Payment Terms</th>
                <th class="col-warranty">Warranty</th>
                <th class="col-technical">Tech Score</th>
                <th class="col-value">Value Score</th>
                <th class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (bid of sortedBids(); track bid.id; let i = $index) {
                <tr [class.lowest-price]="i === 0" [class.shortlisted]="bid.shortlisted">
                  <td class="col-vendor">
                    <div class="vendor-cell">
                      <div class="vendor-avatar">{{ bid.vendorDisplayName.charAt(0) }}</div>
                      <div class="vendor-info">
                        <span class="vendor-name">{{ bid.vendorDisplayName }}</span>
                        <span class="bid-id">{{ bid.bidId }}</span>
                      </div>
                      @if (i === 0) {
                        <span class="lowest-badge">L1</span>
                      }
                    </div>
                  </td>
                  <td class="col-price">
                    <span class="price-value">{{ formatCurrency(bid.totalPrice) }}</span>
                    @if (i > 0) {
                      <span class="price-diff">+{{ getPercentDiff(bid) }}%</span>
                    }
                  </td>
                  <td class="col-breakdown">
                    <div class="breakdown-list">
                      @for (item of bid.priceBreakdown.slice(0, 3); track $index) {
                        <div class="breakdown-item">
                          <span class="item-name">{{ item.description }}</span>
                          <span class="item-value">{{ formatCurrency(item.amount) }}</span>
                        </div>
                      }
                      @if (bid.priceBreakdown.length > 3) {
                        <span class="more-items">+{{ bid.priceBreakdown.length - 3 }} more</span>
                      }
                    </div>
                  </td>
                  <td class="col-payment">
                    <span class="payment-terms">{{ bid.paymentTerms }}</span>
                  </td>
                  <td class="col-warranty">
                    <span class="warranty-period">{{ bid.warrantyPricing || 'N/A' }}</span>
                  </td>
                  <td class="col-technical">
                    <div class="score-circle" [class]="getScoreClass(bid.technicalScore)">
                      {{ bid.technicalScore }}
                    </div>
                  </td>
                  <td class="col-value">
                    @if (bid.valueScore !== undefined) {
                      <div class="value-score" [class]="getScoreClass(bid.valueScore)">
                        <span class="score-number">{{ bid.valueScore | number:'1.1-1' }}</span>
                        <span class="score-label">Value</span>
                      </div>
                    } @else {
                      <span class="no-score">-</span>
                    }
                  </td>
                  <td class="col-actions">
                    <div class="action-buttons">
                      @if (!bid.shortlisted) {
                        <button class="btn-shortlist" (click)="addToShortlist(bid)">
                          <span class="icon">⭐</span>
                          Shortlist
                        </button>
                      } @else {
                        <button class="btn-remove-shortlist" (click)="removeFromShortlist(bid)">
                          <span class="icon">✖</span>
                          Remove
                        </button>
                      }
                      <a [routerLink]="['/management/evaluation', tender.id, 'commercial', bid.id]" class="btn-view">
                        View Details
                      </a>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        
        <!-- Value Score Legend -->
        <div class="value-score-legend">
          <h4>Value Score Calculation</h4>
          <div class="formula">
            <span class="formula-item">Technical Score (40%)</span>
            <span class="operator">+</span>
            <span class="formula-item">Price Competitiveness (40%)</span>
            <span class="operator">+</span>
            <span class="formula-item">Terms & Warranty (20%)</span>
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./commercial-evaluation-tab.component.scss']
})
export class CommercialEvaluationTabComponent {
  @Input() tender!: LiveTender;
  @Input() bids: EvaluationBid[] = [];
  @Output() bidUpdated = new EventEmitter<void>();
  
  private evaluationService = inject(EvaluationService);
  
  qualifiedBids = computed(() => 
    this.bids.filter(b => b.technicalStatus === 'qualified')
  );
  
  sortedBids = computed(() => {
    return [...this.qualifiedBids()].sort((a, b) => a.totalPrice - b.totalPrice);
  });
  
  lowestPrice = computed(() => {
    const sorted = this.sortedBids();
    return sorted.length > 0 ? sorted[0].totalPrice : 0;
  });
  
  getPercentDiff(bid: EvaluationBid): string {
    const lowest = this.lowestPrice();
    if (lowest === 0) return '0';
    const diff = ((bid.totalPrice - lowest) / lowest) * 100;
    return diff.toFixed(1);
  }
  
  getScoreClass(score: number): string {
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }
  
  calculateValueScores(): void {
    // Calculate value scores for all qualified bids
    const qualified = this.qualifiedBids();
    const lowestPrice = this.lowestPrice();
    
    qualified.forEach(bid => {
      const techScore = bid.technicalScore ?? 0;
      const priceScore = lowestPrice > 0 
        ? (lowestPrice / bid.totalPrice) * 100 
        : 0;
      const warrantyScore = 50; // Default score since warranty is string
      
      // Value Score = Tech (40%) + Price (40%) + Terms (20%)
      const valueScore = (techScore * 0.4) + (priceScore * 0.4) + (warrantyScore * 0.2);
      
      // Update bid with value score
      this.evaluationService.updateBidValueScore(bid.id, valueScore);
    });
    
    this.bidUpdated.emit();
  }
  
  addToShortlist(bid: EvaluationBid): void {
    this.evaluationService.addToShortlist(bid.id);
    this.bidUpdated.emit();
  }
  
  removeFromShortlist(bid: EvaluationBid): void {
    this.evaluationService.removeFromShortlist(bid.id);
    this.bidUpdated.emit();
  }
  
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }
}
