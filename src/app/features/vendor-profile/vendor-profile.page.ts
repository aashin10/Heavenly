import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ServiceAuthService } from '../../core/services/service-auth.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import {
  VendorProfileSection,
  computeProfileSections,
} from '../../shared/utils/vendor-profile-completion.util';
import { BasicInfoSectionComponent } from './sections/basic-info.section';
import { DocumentsSectionComponent } from './sections/documents.section';
import { ServicesSectionComponent } from './sections/services.section';
import { PortfolioSectionComponent } from './sections/portfolio.section';
import { BankSectionComponent } from './sections/bank.section';

type SectionId = VendorProfileSection['id'];

const SECTION_IDS: SectionId[] = ['basic', 'documents', 'services', 'portfolio', 'bank'];

/**
 * Business profile editor — the destination of the dashboard's
 * profile-completion checklist. Guarded by `vendorGuard` (any verification
 * status): a *pending* vendor completing this page is how they get verified.
 */
@Component({
  selector: 'app-vendor-profile-page',
  standalone: true,
  imports: [
    RouterLink,
    IconComponent,
    BasicInfoSectionComponent,
    DocumentsSectionComponent,
    ServicesSectionComponent,
    PortfolioSectionComponent,
    BankSectionComponent,
  ],
  templateUrl: './vendor-profile.page.html',
  styleUrl: './vendor-profile.page.scss',
})
export class VendorProfilePageComponent implements OnInit {
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Tracks the service's own signal reactively rather than a one-time
  // snapshot. On a hard navigation (real API), the route guard only checks
  // the cached session — it does not wait for the async GET /me rehydration
  // that follows — so a snapshot taken in ngOnInit() could read null and
  // never update once the fetch actually resolves.
  vendor = computed(() => this.serviceAuthService.vendor());
  activeSection = signal<SectionId>('basic');

  sections = computed(() => computeProfileSections(this.vendor()));

  completedCount = computed(() => this.sections().filter(s => s.isComplete).length);
  totalCount = computed(() => this.sections().length);
  completionPercent = computed(() => {
    const total = this.totalCount();
    return total === 0 ? 0 : Math.round((this.completedCount() / total) * 100);
  });

  isPendingVerification = computed(
    () => this.vendor()?.verificationStatus === 'pending'
  );

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const section = params.get('section') as SectionId | null;
      if (section && SECTION_IDS.includes(section)) {
        this.activeSection.set(section);
      } else {
        // Unknown section segment — normalise to basic rather than 404ing
        this.router.navigate(['/vendor-profile', 'basic'], { replaceUrl: true });
      }
    });
  }

  /**
   * Sections call this after a successful save. `vendor` is already reactive
   * to the service's own signal, so there is nothing to refetch here — this
   * exists as the template hook the section outputs bind to.
   */
  onSectionSaved(): void {}
}
