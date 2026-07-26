import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EvaluationService } from '../evaluation.service';
import { LiveTender, TenderStats, EvaluationPhase } from '../evaluation.model';
import { EvaluationStatusBadgeComponent } from '../../../../shared/components/evaluation-status-badge/evaluation-status-badge.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { getCategoryShortLabel } from '../../../../shared/utils/service-category.util';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { formatAppDate } from '../../../../shared/utils/date-format.util';

@Component({
  selector: 'app-live-tenders-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    EvaluationStatusBadgeComponent,
    IconComponent,
    EmptyStateComponent
  ],
  templateUrl: './live-tenders-dashboard.page.html',
  styleUrls: ['./live-tenders-dashboard.page.scss']
})
export class LiveTendersDashboardPage implements OnInit {
  private readonly evaluationService = inject(EvaluationService);
  
  // Data signals
  tenders = signal<LiveTender[]>([]);
  stats = signal<TenderStats | null>(null);
  loading = signal(true);
  
  // Filter signals
  searchQuery = signal('');
  selectedPhase = signal<EvaluationPhase | 'all'>('all');
  selectedCategory = signal<string>('all');
  sortBy = signal<'deadline' | 'bids' | 'created'>('deadline');
  sortOrder = signal<'asc' | 'desc'>('asc');
  
  // Computed filtered tenders
  filteredTenders = computed(() => {
    let result = [...this.tenders()];
    
    // Search filter
    const query = this.searchQuery().toLowerCase();
    if (query) {
      result = result.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.tenderId.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      );
    }
    
    // Phase filter
    const phase = this.selectedPhase();
    if (phase !== 'all') {
      result = result.filter(t => t.evaluationPhase === phase);
    }
    
    // Category filter
    const category = this.selectedCategory();
    if (category !== 'all') {
      result = result.filter(t => t.category === category);
    }
    
    // Sorting
    const sortField = this.sortBy();
    const order = this.sortOrder() === 'asc' ? 1 : -1;
    
    result.sort((a, b) => {
      switch (sortField) {
        case 'deadline':
          return order * (new Date(a.bidWindowEnd).getTime() - new Date(b.bidWindowEnd).getTime());
        case 'bids':
          return order * (a.totalBids - b.totalBids);
        case 'created':
          return order * (new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
        default:
          return 0;
      }
    });
    
    return result;
  });
  
  // Get unique categories from tenders
  categories = computed(() => {
    const cats = new Set(this.tenders().map(t => t.category));
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  });
  
  // Phase options
  phaseOptions: { value: EvaluationPhase | 'all'; label: string }[] = [
    { value: 'all', label: 'All Phases' },
    { value: 'accepting_bids', label: 'Accepting Bids' },
    { value: 'bid_closed', label: 'Bid Closed' },
    { value: 'technical_review', label: 'Technical Review' },
    { value: 'commercial_review', label: 'Commercial Review' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'awarded', label: 'Awarded' }
  ];
  
  ngOnInit(): void {
    this.loadData();
  }
  
  loadData(): void {
    this.loading.set(true);
    
    // Simulate API delay
    setTimeout(() => {
      this.tenders.set(this.evaluationService.getLiveTenders());
      this.stats.set(this.evaluationService.getTenderStats());
      this.loading.set(false);
    }, 500);
  }
  
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }
  
  onPhaseChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedPhase.set(select.value as EvaluationPhase | 'all');
  }
  
  onCategoryChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedCategory.set(select.value);
  }
  
  onSortChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sortBy.set(select.value as 'deadline' | 'bids' | 'created');
  }
  
  toggleSortOrder(): void {
    this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
  }
  
  getPhaseIcon(phase: EvaluationPhase): string {
    const icons: Record<EvaluationPhase, string> = {
      'accepting_bids': 'inbox',
      'bid_closed': 'lock',
      'technical_review': 'search',
      'commercial_review': 'indian-rupee',
      'shortlisted': 'star',
      'awarded': 'circle-check',
      'cancelled': 'circle-x'
    };
    return icons[phase] || 'clipboard-list';
  }
  
  getDeadlineStatus(deadline: string): 'expired' | 'urgent' | 'normal' {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining < 0) return 'expired';
    if (daysRemaining <= 3) return 'urgent';
    return 'normal';
  }
  
  categoryLabel(category: string): string {
    return getCategoryShortLabel(category);
  }

  getDaysRemaining(deadline: string): number {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    return Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }
  
  formatDate(date: string): string {
    return formatAppDate(date);
  }
  
  refreshData(): void {
    this.loadData();
  }
}
