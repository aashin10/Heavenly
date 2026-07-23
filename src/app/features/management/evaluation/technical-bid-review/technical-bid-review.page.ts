import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EvaluationService } from '../evaluation.service';
import { LiveTender, EvaluationBid, TechnicalEvaluation } from '../evaluation.model';
import { StarRatingComponent } from '../../../../shared/components/star-rating/star-rating.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatAppDate } from '../../../../shared/utils/date-format.util';

@Component({
  selector: 'app-technical-bid-review',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    StarRatingComponent,
    IconComponent
  ],
  templateUrl: './technical-bid-review.page.html',
  styleUrls: ['./technical-bid-review.page.scss']
})
export class TechnicalBidReviewPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly evaluationService = inject(EvaluationService);
  
  tender = signal<LiveTender | null>(null);
  bid = signal<EvaluationBid | null>(null);
  loading = signal(true);
  saving = signal(false);
  
  evaluationForm!: FormGroup;
  
  // Existing evaluation data
  existingEvaluation = signal<TechnicalEvaluation | null>(null);
  
  // Document viewer state
  activeDocument = signal<string | null>(null);
  
  ngOnInit(): void {
    const tenderId = this.route.snapshot.paramMap.get('id');
    const bidId = this.route.snapshot.paramMap.get('bidId');
    
    if (tenderId && bidId) {
      this.loadData(tenderId, bidId);
    }
    
    this.initForm();
  }
  
  initForm(): void {
    this.evaluationForm = this.fb.group({
      complianceScore: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      experienceRating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
      technicalApproachRating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
      timelineRating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
      teamQualityRating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
      notes: [''],
      strengths: [''],
      weaknesses: [''],
      recommendation: ['approve', Validators.required]
    });
  }
  
  loadData(tenderId: string, bidId: string): void {
    this.loading.set(true);
    
    setTimeout(() => {
      const tender = this.evaluationService.getTenderDetail(tenderId);
      const bid = this.evaluationService.getBidDetail(bidId);
      const evaluation = this.evaluationService.getTechnicalEvaluation(bidId);
      
      this.tender.set(tender ?? null);
      this.bid.set(bid ?? null);
      this.existingEvaluation.set(evaluation);
      
      // Prefill form if evaluation exists
      if (evaluation) {
        this.evaluationForm.patchValue({
          complianceScore: evaluation.complianceScore,
          experienceRating: evaluation.experienceRating,
          technicalApproachRating: evaluation.technicalApproachRating,
          timelineRating: evaluation.timelineRating,
          teamQualityRating: 0,
          notes: evaluation.notes,
          strengths: '',
          weaknesses: '',
          recommendation: evaluation.overallScore >= 50 ? 'approve' : 'reject'
        });
      }
      
      this.loading.set(false);
    }, 500);
  }
  
  calculateOverallScore(): number {
    const form = this.evaluationForm.value;
    const compliance = form.complianceScore || 0;
    const experience = (form.experienceRating || 0) * 20;
    const technical = (form.technicalApproachRating || 0) * 20;
    const timeline = (form.timelineRating || 0) * 20;
    const team = (form.teamQualityRating || 0) * 20;
    
    // Weighted average: Compliance 30%, Experience 20%, Technical 25%, Timeline 15%, Team 10%
    return Math.round(
      (compliance * 0.3) +
      (experience * 0.2) +
      (technical * 0.25) +
      (timeline * 0.15) +
      (team * 0.1)
    );
  }
  
  getScoreClass(score: number): string {
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }
  
  openDocument(docUrl: string): void {
    this.activeDocument.set(docUrl);
  }
  
  closeDocumentViewer(): void {
    this.activeDocument.set(null);
  }
  
  saveDraft(): void {
    this.saveEvaluation(false);
  }
  
  submitEvaluation(): void {
    if (this.evaluationForm.invalid) {
      this.evaluationForm.markAllAsTouched();
      return;
    }
    this.saveEvaluation(true);
  }
  
  private saveEvaluation(submit: boolean): void {
    const b = this.bid();
    const t = this.tender();
    if (!b || !t) return;
    
    this.saving.set(true);
    
    const form = this.evaluationForm.value;
    const overallScore = this.calculateOverallScore();
    
    const evaluation: TechnicalEvaluation = {
      id: this.existingEvaluation()?.id ?? `eval-${Date.now()}`,
      bidId: b.id,
      complianceScore: form.complianceScore,
      experienceRating: form.experienceRating,
      technicalApproachRating: form.technicalApproachRating,
      timelineRating: form.timelineRating,
      overallScore,
      notes: form.notes,
      evaluatedBy: 'Current User',
      evaluatedAt: new Date().toISOString(),
      status: submit ? 'submitted' : 'draft'
    };
    
    setTimeout(() => {
      if (submit) {
        this.evaluationService.submitTechnicalEvaluation(evaluation);
      } else {
        this.evaluationService.saveTechnicalEvaluation(evaluation);
      }
      
      this.saving.set(false);
      
      if (submit) {
        // Navigate back to bid evaluation page
        globalThis.history.back();
      }
    }, 500);
  }
  
  rejectBid(): void {
    const b = this.bid();
    const t = this.tender();
    if (!b || !t) return;
    
    const reason = prompt('Please provide a reason for rejection:');
    if (reason) {
      this.evaluationService.disqualifyBid({
        bidId: b.id,
        reason: 'missing_documents',
        explanation: reason,
        notifyVendor: true
      });
      globalThis.history.back();
    }
  }
  
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }
  
  formatDate(date: string | Date): string {
    return formatAppDate(date);
  }
}
