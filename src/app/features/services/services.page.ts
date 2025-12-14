import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  SERVICES,
  SERVICE_CATEGORIES,
  ServiceType,
  ServiceCategory
} from '../../core/models/service.model';
import {
  SERVICE_FILTERS,
  getGroupedServices,
  searchServices,
  getWhatToExpect,
  WhatToExpectInfo
} from '../../shared/utils/service-category.util';
import { ServiceAuthService } from '../../core/services/service-auth.service';
import { ServiceFilterType, AuthModalState } from './services.model';

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './services.page.html',
  styleUrl: './services.page.scss'
})
export class ServicesPageComponent {
  private readonly router = inject(Router);
  private readonly serviceAuthService = inject(ServiceAuthService);

  // Filter and search state
  readonly activeFilter = signal<ServiceFilterType>('all');
  readonly searchQuery = signal<string>('');
  
  // Modal states
  readonly authModal = signal<AuthModalState>({ isOpen: false, selectedService: null });
  readonly whatToExpectModal = signal<{ isOpen: boolean; service: ServiceType | null; info: WhatToExpectInfo | null }>({
    isOpen: false,
    service: null,
    info: null
  });
  readonly helpModal = signal<boolean>(false);

  // Data
  readonly filters = SERVICE_FILTERS;
  readonly categories = SERVICE_CATEGORIES;
  readonly groupedServices = getGroupedServices();
  readonly popularServices = SERVICES.filter(s => s.isPopular);

  // Computed
  readonly isLoggedIn = this.serviceAuthService.isServiceLoggedIn;

  readonly filteredServices = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.activeFilter();

    let services = SERVICES;

    // Apply search filter
    if (query) {
      services = searchServices(query);
    }

    // Apply category filter
    if (filter !== 'all') {
      const categoryMap: Record<string, ServiceCategory> = {
        'quick': 'quick_service',
        'home_office': 'mid_complexity',
        'industrial': 'technical'
      };
      const category = categoryMap[filter];
      if (category) {
        services = services.filter(s => s.category === category);
      }
    }

    return services;
  });

  readonly showGroupedView = computed(() => {
    return this.activeFilter() === 'all' && !this.searchQuery().trim();
  });

  setFilter(filter: ServiceFilterType): void {
    this.activeFilter.set(filter);
  }

  updateSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  handleServiceClick(service: ServiceType): void {
    if (this.isLoggedIn()) {
      // Show what to expect modal
      this.showWhatToExpect(service);
    } else {
      // Show auth modal
      this.authModal.set({ isOpen: true, selectedService: service });
    }
  }

  showWhatToExpect(service: ServiceType): void {
    const info = getWhatToExpect(service.name);
    this.whatToExpectModal.set({ isOpen: true, service, info });
  }

  closeAuthModal(): void {
    this.authModal.set({ isOpen: false, selectedService: null });
  }

  closeWhatToExpectModal(): void {
    this.whatToExpectModal.set({ isOpen: false, service: null, info: null });
  }

  goToLogin(): void {
    this.closeAuthModal();
    this.router.navigate(['/service-login']);
  }

  goToSignup(): void {
    this.closeAuthModal();
    this.router.navigate(['/service-requester-signup']);
  }

  goToVendorSignup(): void {
    this.closeAuthModal();
    this.router.navigate(['/vendor-signup']);
  }

  proceedWithService(): void {
    const modal = this.whatToExpectModal();
    if (modal.service) {
      this.closeWhatToExpectModal();
      // Route to the service request form with service info
      this.router.navigate(['/service-request/new'], {
        queryParams: {
          serviceId: modal.service.id,
          category: modal.service.category
        }
      });
    }
  }

  toggleHelpModal(): void {
    this.helpModal.update(v => !v);
  }

  getCategoryBadge(category: ServiceCategory): string {
    return this.categories[category].badge;
  }

  getCategoryIndicator(category: ServiceCategory): string {
    return this.categories[category].indicator;
  }
}
