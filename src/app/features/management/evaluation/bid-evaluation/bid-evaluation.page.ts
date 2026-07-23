import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { EvaluationService } from '../evaluation.service';
import { LiveTender, EvaluationBid, EvaluationPhase } from '../evaluation.model';
import { EvaluationStatusBadgeComponent } from '../../../../shared/components/evaluation-status-badge/evaluation-status-badge.component';
import { TechnicalEvaluationTabComponent } from '../components/technical-evaluation-tab/technical-evaluation-tab.component';
import { CommercialEvaluationTabComponent } from '../components/commercial-evaluation-tab/commercial-evaluation-tab.component';
import { ShortlistedTabComponent } from '../components/shortlisted-tab/shortlisted-tab.component';
import { AwardTabComponent } from '../components/award-tab/award-tab.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { getCategoryShortLabel } from '../../../../shared/utils/service-category.util';
import { formatAppDate } from '../../../../shared/utils/date-format.util';

type EvaluationTab = 'technical' | 'commercial' | 'shortlisted' | 'award';

@Component({
  selector: 'app-bid-evaluation',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    EvaluationStatusBadgeComponent,
    TechnicalEvaluationTabComponent,
    CommercialEvaluationTabComponent,
    ShortlistedTabComponent,
    AwardTabComponent,
    IconComponent
  ],
  templateUrl: './bid-evaluation.page.html',
  styleUrls: ['./bid-evaluation.page.scss']
})
export class BidEvaluationPage implements OnInit {
  categoryLabel(category: string): string {
    return getCategoryShortLabel(category);
  }

  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);
  
  // Data signals
  tender = signal<LiveTender | null>(null);
  bids = signal<EvaluationBid[]>([]);
  loading = signal(true);
  tenderId = signal<string>('');
  
  // Active tab
  activeTab = signal<EvaluationTab>('technical');
  
  // Tab definitions
  tabs: { id: EvaluationTab; label: string; icon: string }[] = [
    { id: 'technical', label: 'Technical Evaluation', icon: 'search' },
    { id: 'commercial', label: 'Commercial Evaluation', icon: 'indian-rupee' },
    { id: 'shortlisted', label: 'Shortlisted Vendors', icon: 'star' },
    { id: 'award', label: 'Award Decision', icon: 'trophy' }
  ];
  
  // Computed bid counts for tabs
  technicalPendingCount = computed(() => 
    this.bids().filter(b => b.technicalStatus === 'pending').length
  );
  
  technicalApprovedCount = computed(() => 
    this.bids().filter(b => b.technicalStatus === 'qualified').length
  );
  
  commercialPendingCount = computed(() => 
    this.bids().filter(b => 
      b.technicalStatus === 'qualified' && b.commercialStatus === 'sealed'
    ).length
  );
  
  shortlistedCount = computed(() => 
    this.bids().filter(b => b.shortlisted).length
  );
  
  // Check if tender can proceed to commercial evaluation
  canProceedToCommercial = computed(() => {
    const t = this.tender();
    if (!t) return false;
    const pendingTech = this.bids().filter(b => b.technicalStatus === 'pending').length;
    return pendingTech === 0 && t.totalBids > 0;
  });
  
  // Check if tender can proceed to award
  canProceedToAward = computed(() => {
    return this.shortlistedCount() > 0;
  });
  
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.tenderId.set(id);
      this.loadData(id);
    }
  }
  
  loadData(id: string): void {
    this.loading.set(true);
    
    // Simulate API delay
    setTimeout(() => {
      const tender = this.evaluationService.getTenderDetail(id);
      const bids = this.evaluationService.getTenderBids(id);
      
      this.tender.set(tender ?? null);
      this.bids.set(bids);
      this.loading.set(false);
      
      // Set initial tab based on tender phase
      if (tender) {
        this.setInitialTab(tender.evaluationPhase);
      }
    }, 500);
  }
  
  setInitialTab(phase: EvaluationPhase): void {
    switch (phase) {
      case 'commercial_review':
        this.activeTab.set('commercial');
        break;
      case 'shortlisted':
        this.activeTab.set('shortlisted');
        break;
      case 'awarded':
        this.activeTab.set('award');
        break;
      default:
        this.activeTab.set('technical');
    }
  }
  
  setActiveTab(tab: EvaluationTab): void {
    this.activeTab.set(tab);
  }
  
  getTabCount(tabId: EvaluationTab): number {
    switch (tabId) {
      case 'technical':
        return this.technicalPendingCount();
      case 'commercial':
        return this.commercialPendingCount();
      case 'shortlisted':
        return this.shortlistedCount();
      case 'award':
        return this.shortlistedCount() > 0 ? 1 : 0;
      default:
        return 0;
    }
  }
  
  isTabDisabled(tabId: EvaluationTab): boolean {
    switch (tabId) {
      case 'commercial':
        return !this.canProceedToCommercial();
      case 'shortlisted':
        return this.shortlistedCount() === 0;
      case 'award':
        return !this.canProceedToAward();
      default:
        return false;
    }
  }
  
  refreshData(): void {
    const id = this.tenderId();
    if (id) {
      this.loadData(id);
    }
  }
  
  onBidUpdated(): void {
    this.refreshData();
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
