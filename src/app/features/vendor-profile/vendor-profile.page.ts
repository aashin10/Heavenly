import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ServiceAuthService } from '../../core/services/service-auth.service';
import { Vendor } from '../../core/models/service.model';
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

  vendor = signal<Vendor | null>(null);
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
    this.loadVendor();

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

  private loadVendor(): void {
    const user = this.serviceAuthService.getCurrentUser();
    this.vendor.set(user as Vendor | null);
  }

  /** Sections call this after a successful save so completion states refresh. */
  onSectionSaved(): void {
    this.loadVendor();
  }
}
