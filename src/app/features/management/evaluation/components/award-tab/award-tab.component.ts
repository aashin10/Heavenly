import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LiveTender, EvaluationBid, AwardData } from '../../evaluation.model';
import { EvaluationService } from '../../evaluation.service';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-award-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, IconComponent],
  template: `
    <div class="award-tab">
      @if (tender.evaluationPhase === 'awarded' && awardedBid()) {
        <!-- Award Complete View -->
        <div class="award-complete">
          <div class="success-banner">
            <div class="success-icon"><app-icon name="circle-check" [size]="32" /></div>
            <h2>Contract Awarded Successfully</h2>
            <p>The contract has been awarded to {{ awardedBid()?.vendorDisplayName }}</p>
          </div>
          
          <div class="award-details">
            <div class="detail-card winner-card">
              <h3>Winning Vendor</h3>
              <div class="vendor-info">
                <div class="vendor-avatar">{{ awardedBid()?.vendorDisplayName?.charAt(0) }}</div>
                <div class="vendor-details">
                  <span class="vendor-name">{{ awardedBid()?.vendorDisplayName }}</span>
                  <span class="bid-id">{{ awardedBid()?.bidId }}</span>
                </div>
              </div>
            </div>
            
            <div class="detail-card">
              <h3>Contract Value</h3>
              <span class="value">{{ formatCurrency(awardedBid()?.negotiatedAmount ?? awardedBid()?.totalPrice ?? 0) }}</span>
            </div>
            
            <div class="detail-card">
              <h3>Technical Score</h3>
              <span class="value">{{ awardedBid()?.technicalScore }}/100</span>
            </div>
            
            <div class="detail-card">
              <h3>Value Score</h3>
              <span class="value">{{ awardedBid()?.valueScore | number:'1.1-1' }}</span>
            </div>
          </div>
          
          <div class="actions-row">
            <button class="btn-download">
              <span class="icon"><app-icon name="file-text" [size]="18" /></span>
              Download Award Letter
            </button>
            <button class="btn-download">
              <span class="icon"><app-icon name="clipboard-list" [size]="18" /></span>
              Download Contract
            </button>
          </div>
        </div>
      } @else if (selectedWinner()) {
        <!-- Award Form View -->
        <div class="award-form-container">
          <div class="form-header">
            <h2>Finalize Award Decision</h2>
            <p>Review the details and confirm the contract award to the selected vendor.</p>
          </div>
          
          <!-- Selected Winner Summary -->
          <div class="winner-summary">
            <div class="summary-header">
              <span class="badge"><app-icon name="trophy" [size]="14" /> Selected Winner</span>
              <button class="btn-change" (click)="clearSelection()">Change Selection</button>
            </div>
            <div class="vendor-row">
              <div class="vendor-avatar">{{ selectedWinner()?.vendorDisplayName?.charAt(0) }}</div>
              <div class="vendor-info">
                <h3>{{ selectedWinner()?.vendorDisplayName }}</h3>
                <span class="bid-id">{{ selectedWinner()?.bidId }}</span>
              </div>
            </div>
            
            <div class="summary-scores">
              <div class="score-item">
                <span class="label">Technical Score</span>
                <span class="value">{{ selectedWinner()?.technicalScore }}/100</span>
              </div>
              <div class="score-item">
                <span class="label">Original Quote</span>
                <span class="value">{{ formatCurrency(selectedWinner()?.totalPrice ?? 0) }}</span>
              </div>
              <div class="score-item">
                <span class="label">Value Score</span>
                <span class="value">{{ selectedWinner()?.valueScore ? (selectedWinner()?.valueScore | number:'1.1-1') : '-' }}</span>
              </div>
            </div>
          </div>
          
          <!-- Contract Details Form -->
          <div class="contract-form">
            <h3>Contract Details</h3>
            
            <div class="form-grid">
              <div class="form-group">
                <label>Final Contract Value (₹) *</label>
                <input 
                  type="number" 
                  [(ngModel)]="contractAmount"
                  [placeholder]="(selectedWinner()?.negotiatedAmount ?? selectedWinner()?.totalPrice)?.toString() || ''"
                />
              </div>
              
              <div class="form-group">
                <label>Contract Start Date *</label>
                <input 
                  type="date" 
                  [(ngModel)]="startDate"
                />
              </div>
              
              <div class="form-group">
                <label>Completion Date</label>
                <input 
                  type="date" 
                  [(ngModel)]="completionDate"
                />
              </div>
              
              <div class="form-group full-width">
                <label>Payment Terms</label>
                <textarea 
                  [(ngModel)]="paymentTerms"
                  rows="2"
                  placeholder="Enter payment schedule and terms..."
                ></textarea>
              </div>
              
              <div class="form-group full-width">
                <label>Award Justification *</label>
                <textarea 
                  [(ngModel)]="awardJustification"
                  rows="3"
                  placeholder="Provide justification for selecting this vendor..."
                ></textarea>
              </div>
            </div>
            
            <!-- Notification Options -->
            <div class="notification-options">
              <h4>Notification Settings</h4>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="notifyWinner" />
                <span>Send award notification to winning vendor</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="notifyOthers" />
                <span>Send rejection notification to other shortlisted vendors</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="notifyRequester" />
                <span>Send notification to requester</span>
              </label>
            </div>
          </div>
          
          <!-- Form Actions -->
          <div class="form-actions">
            <button class="btn-cancel" (click)="clearSelection()">Cancel</button>
            <button 
              class="btn-award" 
              (click)="finalizeAward()"
              [disabled]="!canFinalize()">
              <span class="icon"><app-icon name="trophy" [size]="18" /></span>
              Finalize Award
            </button>
          </div>
        </div>
      } @else {
        <!-- No Winner Selected -->
        <div class="no-winner">
          <div class="empty-icon"><app-icon name="trophy" [size]="32" /></div>
          <h2>Ready to Award</h2>
          <p>Select a vendor from the Shortlisted tab to proceed with the award decision.</p>
          
          @if (shortlistedBids().length > 0) {
            <div class="quick-select">
              <h4>Quick Selection</h4>
              <div class="candidates-list">
                @for (bid of shortlistedBids(); track bid.id; let i = $index) {
                  <div class="candidate-card" (click)="selectWinnerBid(bid)">
                    <div class="rank">#{{ i + 1 }}</div>
                    <div class="candidate-info">
                      <span class="name">{{ bid.vendorDisplayName }}</span>
                      <span class="score">Value Score: {{ bid.valueScore ? (bid.valueScore | number:'1.1-1') : '-' }}</span>
                    </div>
                    <span class="price">{{ formatCurrency(bid.negotiatedAmount ?? bid.totalPrice) }}</span>
                  </div>
                }
              </div>
            </div>
          } @else {
            <p class="hint">No vendors have been shortlisted yet.</p>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['./award-tab.component.scss']
})
export class AwardTabComponent implements OnInit, OnChanges {
  @Input() tender!: LiveTender;
  @Input() bids: EvaluationBid[] = [];
  @Input() preSelectedWinner: EvaluationBid | null = null;
  @Output() bidUpdated = new EventEmitter<void>();
  
  private readonly evaluationService = inject(EvaluationService);
  
  selectedWinner = signal<EvaluationBid | null>(null);
  
  // Form fields matching AwardData interface
  contractAmount = 0;
  paymentTerms = '';
  startDate = '';
  completionDate = '';
  awardJustification = '';
  notifyWinner = true;
  notifyOthers = true;
  notifyRequester = true;
  
  shortlistedBids = computed(() => {
    return this.bids
      .filter(b => b.shortlisted)
      .sort((a, b) => (b.valueScore ?? 0) - (a.valueScore ?? 0));
  });
  
  awardedBid = computed(() => {
    return this.bids.find(b => b.status === 'awarded');
  });
  
  ngOnInit(): void {
    if (this.preSelectedWinner) {
      this.selectedWinner.set(this.preSelectedWinner);
      this.prefillContractDetails(this.preSelectedWinner);
    }
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['preSelectedWinner'] && this.preSelectedWinner) {
      this.selectedWinner.set(this.preSelectedWinner);
      this.prefillContractDetails(this.preSelectedWinner);
    }
  }
  
  selectWinnerBid(bid: EvaluationBid): void {
    this.selectedWinner.set(bid);
    this.prefillContractDetails(bid);
  }
  
  prefillContractDetails(bid: EvaluationBid): void {
    this.contractAmount = bid.negotiatedAmount ?? bid.totalPrice;
    this.paymentTerms = bid.paymentTerms;
  }
  
  clearSelection(): void {
    this.selectedWinner.set(null);
    this.contractAmount = 0;
    this.paymentTerms = '';
    this.startDate = '';
    this.completionDate = '';
    this.awardJustification = '';
  }
  
  canFinalize(): boolean {
    return !!(
      this.selectedWinner() &&
      this.contractAmount > 0 &&
      this.startDate &&
      this.awardJustification.trim()
    );
  }
  
  finalizeAward(): void {
    const winner = this.selectedWinner();
    if (!winner || !this.canFinalize()) return;
    
    const awardData: AwardData = {
      tenderId: this.tender.id,
      selectedBidId: winner.id,
      awardJustification: this.awardJustification,
      contractAmount: this.contractAmount,
      paymentTerms: this.paymentTerms,
      startDate: this.startDate,
      completionDate: this.completionDate,
      notifyWinner: this.notifyWinner,
      notifyOthers: this.notifyOthers,
      notifyRequester: this.notifyRequester,
      awardedBy: 'Current User',
      awardedAt: new Date().toISOString()
    };
    
    this.evaluationService.awardContract(awardData);
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
