import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LiveTender, EvaluationBid, NegotiationNote } from '../../evaluation.model';
import { EvaluationService } from '../../evaluation.service';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { formatAppDateTime } from '../../../../../shared/utils/date-format.util';

@Component({
  selector: 'app-shortlisted-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, IconComponent, EmptyStateComponent],
  template: `
    <div class="shortlisted-tab">
      <!-- Tab Header -->
      <div class="tab-header">
        <div class="header-info">
          <h2>Shortlisted Vendors</h2>
          <p>Manage negotiations with shortlisted vendors before making the final award decision.</p>
        </div>
      </div>
      
      @if (shortlistedBids().length === 0) {
        <app-empty-state
          icon="star"
          title="No Vendors Shortlisted"
          message="Use the Commercial Evaluation tab to add vendors to the shortlist for final negotiations." />
      } @else {
        <div class="shortlisted-list">
          @for (bid of shortlistedBids(); track bid.id; let i = $index) {
            <div class="shortlisted-card" [class.rank-1]="i === 0">
              <!-- Card Header -->
              <div class="card-header">
                <div class="rank-badge">Rank #{{ i + 1 }}</div>
                <div class="vendor-info">
                  <div class="vendor-avatar">{{ bid.vendorDisplayName.charAt(0) }}</div>
                  <div class="vendor-details">
                    <h3>{{ bid.vendorDisplayName }}</h3>
                    <span class="bid-id">{{ bid.bidId }}</span>
                  </div>
                </div>
                <div class="header-actions">
                  <button class="btn-remove" (click)="removeFromShortlist(bid)">
                    <span class="icon"><app-icon name="x" [size]="18" /></span>
                    Remove
                  </button>
                </div>
              </div>
              
              <!-- Card Body -->
              <div class="card-body">
                <!-- Scores Summary -->
                <div class="scores-row">
                  <div class="score-item">
                    <span class="score-label">Technical Score</span>
                    <span class="score-value" [class]="getScoreClass(bid.technicalScore)">
                      {{ bid.technicalScore }}/100
                    </span>
                  </div>
                  <div class="score-item">
                    <span class="score-label">Quoted Price</span>
                    <span class="score-value price">
                      {{ formatCurrency(bid.totalPrice) }}
                    </span>
                  </div>
                  <div class="score-item">
                    <span class="score-label">Value Score</span>
                    <span class="score-value" [class]="getScoreClass(bid.valueScore)">
                      {{ bid.valueScore | number:'1.1-1' }}
                    </span>
                  </div>
                  <div class="score-item">
                    <span class="score-label">Negotiated Price</span>
                    <span class="score-value negotiated" [class.has-value]="bid.negotiatedAmount">
                      {{ bid.negotiatedAmount ? formatCurrency(bid.negotiatedAmount) : 'Not Set' }}
                    </span>
                  </div>
                </div>
                
                <!-- Negotiation Notes -->
                <div class="negotiation-section">
                  <div class="section-header">
                    <h4>Negotiation Notes</h4>
                    <button class="btn-add-note" (click)="toggleNoteForm(bid.id)">
                      <span class="icon">+</span>
                      Add Note
                    </button>
                  </div>
                  
                  <!-- Add Note Form -->
                  @if (showNoteForm() === bid.id) {
                    <div class="note-form">
                      <textarea 
                        [(ngModel)]="newNoteContent"
                        placeholder="Enter negotiation note..."
                        rows="3">
                      </textarea>
                      <div class="form-row">
                        <div class="input-group">
                          <label>Negotiated Price (₹)</label>
                          <input 
                            type="number" 
                            [(ngModel)]="newNegotiatedPrice"
                            placeholder="Optional"
                          />
                        </div>
                        <div class="form-actions">
                          <button class="btn-cancel" (click)="cancelNoteForm()">Cancel</button>
                          <button class="btn-save" (click)="saveNote(bid)" [disabled]="!newNoteContent">Save Note</button>
                        </div>
                      </div>
                    </div>
                  }
                  
                  <!-- Notes List -->
                  @if (bid.negotiationNotes && bid.negotiationNotes.length > 0) {
                    <div class="notes-list">
                      @for (note of bid.negotiationNotes; track $index) {
                        <div class="note-item">
                          <div class="note-header">
                            <span class="note-author">{{ note.createdBy }}</span>
                            <span class="note-date">{{ formatDate(note.createdAt) }}</span>
                          </div>
                          <p class="note-content">{{ note.text }}</p>
                          @if (note.negotiatedAmount) {
                            <div class="note-price">
                              Negotiated Amount: {{ formatCurrency(note.negotiatedAmount) }}
                            </div>
                          }
                        </div>
                      }
                    </div>
                  } @else {
                    <p class="no-notes">No negotiation notes yet.</p>
                  }
                </div>
              </div>
              
              <!-- Card Footer -->
              <div class="card-footer">
                <div class="contact-info">
                  <span class="contact-item">
                    <span class="icon"><app-icon name="mail" [size]="18" /></span>
                    {{ bid.companyName }}
                  </span>
                  <span class="contact-item">
                    <span class="icon"><app-icon name="map-pin" [size]="18" /></span>
                    {{ bid.location }}
                  </span>
                </div>
                <button class="btn-select-winner" (click)="selectAsWinner(bid)">
                  <span class="icon"><app-icon name="trophy" [size]="18" /></span>
                  Select as Winner
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['./shortlisted-tab.component.scss']
})
export class ShortlistedTabComponent {
  @Input() tender!: LiveTender;
  @Input() bids: EvaluationBid[] = [];
  @Output() bidUpdated = new EventEmitter<void>();
  @Output() selectWinner = new EventEmitter<EvaluationBid>();
  
  private evaluationService = inject(EvaluationService);
  
  showNoteForm = signal<string | null>(null);
  newNoteContent = '';
  newNegotiatedPrice: number | null = null;
  
  shortlistedBids = computed(() => {
    return this.bids
      .filter(b => b.shortlisted)
      .sort((a, b) => (b.valueScore ?? 0) - (a.valueScore ?? 0));
  });
  
  toggleNoteForm(bidId: string): void {
    if (this.showNoteForm() === bidId) {
      this.showNoteForm.set(null);
    } else {
      this.showNoteForm.set(bidId);
      this.newNoteContent = '';
      this.newNegotiatedPrice = null;
    }
  }
  
  cancelNoteForm(): void {
    this.showNoteForm.set(null);
    this.newNoteContent = '';
    this.newNegotiatedPrice = null;
  }
  
  saveNote(bid: EvaluationBid): void {
    if (!this.newNoteContent.trim()) return;
    
    this.evaluationService.addNegotiationNote(bid.id, {
      text: this.newNoteContent.trim(),
      negotiatedAmount: this.newNegotiatedPrice ?? undefined
    });
    this.cancelNoteForm();
    this.bidUpdated.emit();
  }
  
  removeFromShortlist(bid: EvaluationBid): void {
    if (confirm('Are you sure you want to remove this vendor from the shortlist?')) {
      this.evaluationService.removeFromShortlist(bid.id);
      this.bidUpdated.emit();
    }
  }
  
  selectAsWinner(bid: EvaluationBid): void {
    this.selectWinner.emit(bid);
  }
  
  getScoreClass(score: number): string {
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }
  
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }
  
  formatDate(date: string | Date): string {
    return formatAppDateTime(date);
  }
}
