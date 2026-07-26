import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VendorTenderService } from '../vendor.service';
import { PublishedTender, TenderFilters, FilterOptions } from '../vendor.model';
import { TenderCardComponent } from '../../../shared/components/tender-card/tender-card.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-tender-browse-page',
  standalone: true,
  imports: [FormsModule, TenderCardComponent, IconComponent, EmptyStateComponent],
  templateUrl: './tender-browse.page.html',
  styleUrl: './tender-browse.page.scss'
})
export class TenderBrowsePageComponent implements OnInit {
  private readonly vendorService = inject(VendorTenderService);
  private readonly router = inject(Router);

  // Filter options
  filterOptions = signal<FilterOptions>({
    serviceTypes: [],
    locations: [],
    categories: []
  });

  // Current filters
  filters = signal<TenderFilters>({
    serviceTypes: [],
    locations: [],
    budgetRange: { min: 0, max: 10000000 },
    closingSoon: null,
    searchQuery: ''
  });

  sortBy = signal<string>('newest');
  showMobileFilters = signal(false);

  // Computed filtered and sorted tenders
  filteredTenders = computed(() => {
    let tenders = this.vendorService.filteredTenders();
    return this.sortTenders(tenders);
  });

  ngOnInit(): void {
    this.loadFilterOptions();
  }

  private loadFilterOptions(): void {
    const options = this.vendorService.getFilterOptions();
    this.filterOptions.set(options);
  }

  private sortTenders(tenders: PublishedTender[]): PublishedTender[] {
    const sorted = [...tenders];
    switch (this.sortBy()) {
      case 'newest':
        return sorted.sort((a, b) => 
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
      case 'closing_soon':
        return sorted.sort((a, b) => 
          new Date(a.bidWindowEnd).getTime() - new Date(b.bidWindowEnd).getTime()
        );
      case 'budget_high':
        return sorted.sort((a, b) => 
          (b.budgetMax || b.budgetExact || 0) - (a.budgetMax || a.budgetExact || 0)
        );
      case 'budget_low':
        return sorted.sort((a, b) => 
          (a.budgetMin || a.budgetExact || 0) - (b.budgetMin || b.budgetExact || 0)
        );
      default:
        return sorted;
    }
  }

  onSearchChange(query: string): void {
    this.filters.update(f => ({ ...f, searchQuery: query }));
    this.vendorService.setFilters({ searchQuery: query });
  }

  onSortChange(sort: string): void {
    this.sortBy.set(sort);
  }

  toggleServiceType(value: string): void {
    const current = this.filters().serviceTypes;
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    
    this.filters.update(f => ({ ...f, serviceTypes: updated }));
    this.vendorService.setFilters({ serviceTypes: updated });
  }

  toggleLocation(location: string): void {
    const current = this.filters().locations;
    const updated = current.includes(location)
      ? current.filter(l => l !== location)
      : [...current, location];
    
    this.filters.update(f => ({ ...f, locations: updated }));
    this.vendorService.setFilters({ locations: updated });
  }

  onClosingSoonChange(value: string | null): void {
    this.filters.update(f => ({ ...f, closingSoon: value }));
    this.vendorService.setFilters({ closingSoon: value });
  }

  clearFilters(): void {
    this.filters.set({
      serviceTypes: [],
      locations: [],
      budgetRange: { min: 0, max: 10000000 },
      closingSoon: null,
      searchQuery: ''
    });
    this.vendorService.clearFilters();
  }

  viewTenderDetail(tenderId: string): void {
    this.router.navigate(['/vendor/tenders', tenderId]);
  }

  toggleMobileFilters(): void {
    this.showMobileFilters.update(v => !v);
  }

  hasActiveFilters(): boolean {
    const f = this.filters();
    return f.serviceTypes.length > 0 || 
           f.locations.length > 0 || 
           f.closingSoon !== null ||
           f.searchQuery !== '';
  }
}
