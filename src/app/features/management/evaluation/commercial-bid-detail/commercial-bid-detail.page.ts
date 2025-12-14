import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { EvaluationService } from '../evaluation.service';
import { LiveTender, EvaluationBid } from '../evaluation.model';

@Component({
  selector: 'app-commercial-bid-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="commercial-bid-detail-page">
      @if (loading()) {
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Loading bid details...</p>
        </div>
      } @else {
        @if (bid(); as b) {
        <!-- Page Header -->
        <div class="page-header">
          <div class="header-nav">
            <a [routerLink]="['/management/evaluation', tender()?.id]" class="back-link">
              <span class="back-icon">←</span>
              Back to Evaluation
            </a>
          </div>
          
          <div class="header-content">
            <div class="header-main">
              <div class="bid-id-badge">{{ b.bidId }}</div>
              <h1>Commercial Proposal Details</h1>
              <div class="vendor-name">{{ b.vendorDisplayName }}</div>
            </div>
          </div>
        </div>
        
        <div class="content-grid">
          <!-- Pricing Summary -->
          <section class="detail-section">
            <h2>
              <span class="section-icon">💰</span>
              Pricing Summary
            </h2>
            <div class="total-amount">
              <span class="label">Total Quoted Amount</span>
              <span class="amount">{{ formatCurrency(b.totalPrice) }}</span>
            </div>
            
            <h3>Price Breakdown</h3>
            <div class="breakdown-table">
              <div class="breakdown-header">
                <span>Description</span>
                <span>Amount</span>
              </div>
              @for (item of b.priceBreakdown; track $index) {
                <div class="breakdown-row">
                  <span>{{ item.description }}</span>
                  <span>{{ formatCurrency(item.amount) }}</span>
                </div>
              }
            </div>
            
            @if (b.taxesAndDuties) {
              <div class="taxes-section">
                <h4>Taxes & Duties</h4>
                <p>{{ b.taxesAndDuties }}</p>
              </div>
            }
          </section>
          
          <!-- Payment Terms -->
          <section class="detail-section">
            <h2>
              <span class="section-icon">📋</span>
              Payment Terms
            </h2>
            <div class="terms-grid">
              <div class="term-item">
                <span class="term-label">Payment Terms</span>
                <span class="term-value">{{ b.paymentTerms }}</span>
              </div>
              <div class="term-item">
                <span class="term-label">Validity Period</span>
                <span class="term-value">{{ b.validityPeriod }}</span>
              </div>
            </div>
          </section>
          
          <!-- Warranty & AMC -->
          <section class="detail-section">
            <h2>
              <span class="section-icon">🛡️</span>
              Warranty & AMC
            </h2>
            <div class="terms-grid">
              @if (b.warrantyPricing) {
                <div class="term-item">
                  <span class="term-label">Warranty Pricing</span>
                  <span class="term-value">{{ b.warrantyPricing }}</span>
                </div>
              }
              @if (b.amcPricing) {
                <div class="term-item">
                  <span class="term-label">AMC Pricing</span>
                  <span class="term-value">{{ b.amcPricing }}</span>
                </div>
              }
            </div>
          </section>
          
          <!-- Comparison with L1 -->
          @if (lowestBid() && lowestBid()!.id !== b.id) {
            <section class="detail-section comparison-section">
              <h2>
                <span class="section-icon">📊</span>
                Comparison with L1
              </h2>
              <div class="comparison-grid">
                <div class="comparison-item">
                  <span class="comp-label">L1 Price</span>
                  <span class="comp-value l1">{{ formatCurrency(lowestBid()!.totalPrice) }}</span>
                </div>
                <div class="comparison-item">
                  <span class="comp-label">This Bid</span>
                  <span class="comp-value current">{{ formatCurrency(b.totalPrice) }}</span>
                </div>
                <div class="comparison-item">
                  <span class="comp-label">Difference</span>
                  <span class="comp-value diff">+{{ formatCurrency(b.totalPrice - lowestBid()!.totalPrice) }} ({{ getPercentDiff() }}%)</span>
                </div>
              </div>
            </section>
          }
        </div>
        
        <!-- Actions -->
        <div class="page-actions">
          @if (!b.shortlisted) {
            <button class="btn-shortlist" (click)="addToShortlist()">
              <span class="icon">⭐</span>
              Add to Shortlist
            </button>
          } @else {
            <button class="btn-remove-shortlist" (click)="removeFromShortlist()">
              <span class="icon">✖</span>
              Remove from Shortlist
            </button>
          }
        </div>
        } @else {
        <div class="not-found">
          <div class="not-found-icon">🔍</div>
          <h2>Bid Not Found</h2>
          <p>The requested bid could not be found.</p>
          <a routerLink="/management/evaluation" class="btn-back">Back to Dashboard</a>
        </div>
        }
      }
    </div>
  `,
  styles: [`
    .commercial-bid-detail-page {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 120px 20px;
      
      .loading-spinner {
        width: 48px;
        height: 48px;
        border: 4px solid var(--gray-200);
        border-top-color: var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .page-header {
      margin-bottom: 24px;
      
      .header-nav {
        margin-bottom: 16px;
        
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--gray-600);
          text-decoration: none;
          font-size: 14px;
          
          &:hover { color: var(--primary-color); }
        }
      }
      
      .header-content {
        background: white;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        
        .bid-id-badge {
          display: inline-block;
          padding: 4px 12px;
          background: var(--primary-color);
          color: white;
          font-size: 12px;
          font-weight: 600;
          border-radius: 20px;
          margin-bottom: 12px;
        }
        
        h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }
        
        .vendor-name {
          color: var(--gray-600);
        }
      }
    }
    
    .content-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .detail-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      
      h2 {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 18px;
        margin: 0 0 20px 0;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--gray-100);
        
        .section-icon { font-size: 22px; }
      }
      
      h3, h4 {
        font-size: 14px;
        color: var(--gray-700);
        margin: 20px 0 12px 0;
      }
    }
    
    .total-amount {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border-radius: 12px;
      margin-bottom: 20px;
      
      .label {
        font-size: 14px;
        color: var(--gray-600);
      }
      
      .amount {
        font-size: 28px;
        font-weight: 700;
        color: #059669;
      }
    }
    
    .breakdown-table {
      border: 1px solid var(--gray-200);
      border-radius: 12px;
      overflow: hidden;
      
      .breakdown-header, .breakdown-row {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr;
        padding: 12px 16px;
      }
      
      .breakdown-header {
        background: var(--gray-50);
        font-size: 12px;
        font-weight: 600;
        color: var(--gray-500);
        text-transform: uppercase;
      }
      
      .breakdown-row {
        border-top: 1px solid var(--gray-100);
        font-size: 14px;
        color: var(--gray-700);
        
        span:last-child {
          font-weight: 600;
          color: var(--gray-900);
        }
      }
    }
    
    .terms-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      
      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
      
      .term-item {
        padding: 16px;
        background: var(--gray-50);
        border-radius: 10px;
        
        .term-label {
          display: block;
          font-size: 12px;
          color: var(--gray-500);
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        
        .term-value {
          font-size: 18px;
          font-weight: 600;
          color: var(--gray-900);
        }
      }
    }
    
    .milestones-list {
      .milestone-item {
        display: flex;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--gray-50);
        border-radius: 8px;
        margin-bottom: 8px;
        
        .milestone-name { flex: 1; color: var(--gray-700); }
        .milestone-percent { width: 80px; text-align: center; font-weight: 600; }
        .milestone-amount { width: 120px; text-align: right; font-weight: 600; color: var(--primary-color); }
      }
    }
    
    .comparison-section {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      
      .comparison-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        
        .comparison-item {
          padding: 16px;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 10px;
          text-align: center;
          
          .comp-label {
            display: block;
            font-size: 12px;
            color: var(--gray-500);
            margin-bottom: 6px;
          }
          
          .comp-value {
            font-size: 18px;
            font-weight: 700;
            
            &.l1 { color: #059669; }
            &.current { color: var(--gray-900); }
            &.diff { color: #dc2626; }
          }
        }
      }
    }
    
    .page-actions {
      margin-top: 24px;
      display: flex;
      justify-content: flex-end;
      
      .btn-shortlist, .btn-remove-shortlist {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .btn-shortlist {
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fbbf24;
        
        &:hover { background: #fde68a; }
      }
      
      .btn-remove-shortlist {
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #fca5a5;
        
        &:hover { background: #fecaca; }
      }
    }
    
    .not-found {
      text-align: center;
      padding: 100px 20px;
      background: white;
      border-radius: 16px;
      
      .not-found-icon { font-size: 64px; margin-bottom: 16px; }
      h2 { margin: 0 0 8px 0; }
      p { color: var(--gray-500); margin: 0 0 24px 0; }
      .btn-back {
        display: inline-block;
        padding: 12px 24px;
        background: var(--primary-color);
        color: white;
        text-decoration: none;
        border-radius: 8px;
      }
    }
  `]
})
export class CommercialBidDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);
  
  tender = signal<LiveTender | null>(null);
  bid = signal<EvaluationBid | null>(null);
  allBids = signal<EvaluationBid[]>([]);
  loading = signal(true);
  
  lowestBid = signal<EvaluationBid | null>(null);
  
  ngOnInit(): void {
    const tenderId = this.route.snapshot.paramMap.get('id');
    const bidId = this.route.snapshot.paramMap.get('bidId');
    
    if (tenderId && bidId) {
      this.loadData(tenderId, bidId);
    }
  }
  
  loadData(tenderId: string, bidId: string): void {
    this.loading.set(true);
    
    setTimeout(() => {
      const tender = this.evaluationService.getTenderDetail(tenderId);
      const bid = this.evaluationService.getBidDetail(bidId);
      const allBids = this.evaluationService.getTenderBids(tenderId)
        .filter(b => b.technicalStatus === 'qualified');
      
      this.tender.set(tender ?? null);
      this.bid.set(bid ?? null);
      this.allBids.set(allBids);
      
      // Find lowest bid
      if (allBids.length > 0) {
        const sorted = [...allBids].sort((a, b) => a.totalPrice - b.totalPrice);
        this.lowestBid.set(sorted[0]);
      }
      
      this.loading.set(false);
    }, 500);
  }
  
  getPercentDiff(): string {
    const current = this.bid();
    const lowest = this.lowestBid();
    if (!current || !lowest) return '0';
    
    const diff = ((current.totalPrice - lowest.totalPrice) / lowest.totalPrice) * 100;
    return diff.toFixed(1);
  }
  
  addToShortlist(): void {
    const t = this.tender();
    const b = this.bid();
    if (t && b) {
      this.evaluationService.addToShortlist(b.id);
      this.loadData(t.id, b.id);
    }
  }
  
  removeFromShortlist(): void {
    const t = this.tender();
    const b = this.bid();
    if (t && b) {
      this.evaluationService.removeFromShortlist(b.id);
      this.loadData(t.id, b.id);
    }
  }
  
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }
}
