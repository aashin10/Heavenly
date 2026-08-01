import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { humanizeEnum } from '../../shared/utils/humanize.util';
import {
  PublishedTender,
  Bid,
  BidDraft,
  BidFormData,
  TenderClarification,
  VendorDashboardStats,
  ProfileCompletion,
  UrgentAction,
  FilterOptions,
  TenderFilters,
  EligibilityResult,
  BidStatusResult,
  BidStatus,
  BudgetVisibility,
  TenderStatus
} from './vendor.model';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';
import { TenderApiService } from '../../core/api/services-portal/tender-api.service';
import {
  TenderBudgetDto,
  TenderClarificationDto,
  TenderEligibilityDto,
  VendorTenderDto,
  TenderOpportunityDto,
} from '../../core/api/services-portal/tender-api.models';

const TENDERS_KEY = 'heavenly_published_tenders';
const BIDS_KEY = 'heavenly_vendor_bids';
const DRAFTS_KEY = 'heavenly_bid_drafts';
const SAVED_TENDERS_KEY = 'heavenly_saved_tenders';
const CLARIFICATIONS_KEY = 'heavenly_vendor_clarifications';

@Injectable({
  providedIn: 'root'
})
export class VendorTenderService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastService = inject(ToastService);
  private readonly tenderApi = inject(TenderApiService);

  // Signals
  private readonly tendersSignal = signal<PublishedTender[]>([]);
  private readonly bidsSignal = signal<Bid[]>([]);
  private readonly draftsSignal = signal<BidDraft[]>([]);
  private readonly savedTendersSignal = signal<string[]>([]);
  private readonly clarificationsSignal = signal<TenderClarification[]>([]);
  private readonly filtersSignal = signal<TenderFilters>({
    serviceTypes: [],
    locations: [],
    budgetRange: { min: 0, max: 10000000 },
    closingSoon: null,
    searchQuery: ''
  });

  // Public readonly signals
  readonly tenders = this.tendersSignal.asReadonly();
  readonly bids = this.bidsSignal.asReadonly();
  readonly savedTenders = this.savedTendersSignal.asReadonly();
  readonly filters = this.filtersSignal.asReadonly();

  // Computed values
  readonly filteredTenders = computed(() => {
    const allTenders = this.tendersSignal();
    const filters = this.filtersSignal();
    
    return allTenders.filter(tender => {
      // Only show published tenders
      if (tender.status !== 'published') return false;
      
      // Service type filter
      if (filters.serviceTypes.length > 0) {
        if (!filters.serviceTypes.includes(tender.serviceType)) return false;
      }
      
      // Location filter
      if (filters.locations.length > 0) {
        if (!filters.locations.includes(tender.city)) return false;
      }
      
      // Budget filter
      const budget = tender.budgetMax || tender.budgetExact || 0;
      if (budget < filters.budgetRange.min || budget > filters.budgetRange.max) return false;
      
      // Closing soon filter
      if (filters.closingSoon) {
        const hoursLeft = this.getHoursUntilClose(tender.bidWindowEnd);
        switch (filters.closingSoon) {
          case '24h': if (hoursLeft > 24) return false; break;
          case '3d': if (hoursLeft > 72) return false; break;
          case '7d': if (hoursLeft > 168) return false; break;
        }
      }
      
      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (!tender.title.toLowerCase().includes(query) && 
            !tender.scopeSummary.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      return true;
    });
  });

  readonly activeBids = computed(() => {
    return this.bidsSignal().filter(b => 
      b.status === 'submitted' || b.status === 'under_review' || b.status === 'shortlisted'
    );
  });

  readonly stats = computed<VendorDashboardStats>(() => {
    const bids = this.bidsSignal();
    const tenders = this.tendersSignal().filter(t => t.status === 'published');
    
    return {
      openTenders: tenders.length,
      activeBids: bids.filter(b => b.status === 'submitted' || b.status === 'under_review').length,
      wonBids: bids.filter(b => b.status === 'awarded').length,
      pendingBids: bids.filter(b => b.status === 'submitted').length,
      profileCompletion: 75, // Mock value
      savedTenders: this.savedTendersSignal().length
    };
  });

  constructor() {
    this.loadData();
    // The mock-seeded list is only a fast first paint against the real API —
    // same pattern as session rehydration elsewhere. `tendersSignal` is what
    // every computed here (filteredTenders, stats, filterOptions, ...) reads
    // from, so overwriting it is enough to bring the whole page live.
    if (environment.useRealApi) {
      void this.refreshTendersAsync();
    }
  }

  // ==================== DATA LOADING ====================
  private loadData(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadTenders();
    this.loadBids();
    this.loadDrafts();
    this.loadSavedTenders();
    this.loadClarifications();
  }

  private loadTenders(): void {
    const saved = localStorage.getItem(TENDERS_KEY);
    if (saved) {
      try {
        this.tendersSignal.set(JSON.parse(saved));
      } catch {
        this.tendersSignal.set(this.getMockTenders());
        this.saveTenders();
      }
    } else {
      this.tendersSignal.set(this.getMockTenders());
      this.saveTenders();
    }
  }

  private loadBids(): void {
    const saved = localStorage.getItem(BIDS_KEY);
    if (saved) {
      try {
        this.bidsSignal.set(JSON.parse(saved));
      } catch {
        this.bidsSignal.set([]);
      }
    }
  }

  private loadDrafts(): void {
    const saved = localStorage.getItem(DRAFTS_KEY);
    if (saved) {
      try {
        this.draftsSignal.set(JSON.parse(saved));
      } catch {
        this.draftsSignal.set([]);
      }
    }
  }

  private loadSavedTenders(): void {
    const saved = localStorage.getItem(SAVED_TENDERS_KEY);
    if (saved) {
      try {
        this.savedTendersSignal.set(JSON.parse(saved));
      } catch {
        this.savedTendersSignal.set([]);
      }
    }
  }

  private loadClarifications(): void {
    const saved = localStorage.getItem(CLARIFICATIONS_KEY);
    if (saved) {
      try {
        this.clarificationsSignal.set(JSON.parse(saved));
      } catch {
        this.clarificationsSignal.set(this.getMockClarifications());
      }
    } else {
      this.clarificationsSignal.set(this.getMockClarifications());
    }
  }

  private saveTenders(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(TENDERS_KEY, JSON.stringify(this.tendersSignal()));
  }

  private saveBids(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(BIDS_KEY, JSON.stringify(this.bidsSignal()));
  }

  private saveDrafts(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(this.draftsSignal()));
  }

  private saveSavedTenders(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(SAVED_TENDERS_KEY, JSON.stringify(this.savedTendersSignal()));
  }

  private saveClarifications(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(CLARIFICATIONS_KEY, JSON.stringify(this.clarificationsSignal()));
  }

  // ==================== TENDER OPERATIONS ====================
  getAvailableTenders(): PublishedTender[] {
    return this.tendersSignal().filter(t => t.status === 'published');
  }

  getTenderDetail(tenderId: string): PublishedTender | undefined {
    return this.tendersSignal().find(t => t.id === tenderId || t.tenderId === tenderId);
  }

  getRecommendedTenders(): PublishedTender[] {
    // Mock recommendation - in real app would be based on vendor profile
    return this.tendersSignal()
      .filter(t => t.status === 'published')
      .slice(0, 3);
  }

  getTenderClarifications(tenderId: string): TenderClarification[] {
    return this.clarificationsSignal().filter(c => c.tenderId === tenderId);
  }

  // ==================== FILTER OPERATIONS ====================
  setFilters(filters: Partial<TenderFilters>): void {
    this.filtersSignal.update(current => ({ ...current, ...filters }));
  }

  clearFilters(): void {
    this.filtersSignal.set({
      serviceTypes: [],
      locations: [],
      budgetRange: { min: 0, max: 10000000 },
      closingSoon: null,
      searchQuery: ''
    });
  }

  getFilterOptions(): FilterOptions {
    return this.computeFilterOptions();
  }

  /**
   * Reactive counterpart of `getFilterOptions()` — derives from `tendersSignal`
   * rather than being computed once. `getFilterOptions()` read at the wrong
   * moment (before the real-API refresh in the constructor resolves) would
   * freeze on an empty or stale list forever, since nothing would call it
   * again — the same class of race already hit and fixed on the profile pages.
   */
  readonly filterOptions = computed<FilterOptions>(() => this.computeFilterOptions());

  private computeFilterOptions(): FilterOptions {
    const tenders = this.tendersSignal();
    const serviceTypes = [...new Set(tenders.map(t => t.serviceType))];
    const locations = [...new Set(tenders.map(t => t.city))];

    return {
      serviceTypes: serviceTypes.map(s => ({ value: s, label: this.formatServiceType(s) })),
      locations,
      categories: [
        { value: 'quick_service', label: 'Quick Service' },
        { value: 'mid_complexity', label: 'Mid Complexity' },
        { value: 'technical', label: 'Technical' }
      ]
    };
  }

  // ==================== ELIGIBILITY ====================
  checkTenderEligibility(tenderId: string): EligibilityResult {
    // Mock eligibility check - in real app would check vendor profile
    const tender = this.getTenderDetail(tenderId);
    if (!tender) {
      return { eligible: false, reasons: ['Tender not found'], missingRequirements: [] };
    }
    
    // Mock: 80% chance of being eligible
    const isEligible = Math.random() > 0.2;
    
    if (isEligible) {
      return { eligible: true, reasons: [], missingRequirements: [] };
    }
    
    return {
      eligible: false,
      reasons: ['Profile incomplete', 'Missing required certifications'],
      missingRequirements: ['Business Registration Certificate', 'GST Registration']
    };
  }

  getMyBidStatus(tenderId: string): BidStatusResult {
    const bid = this.bidsSignal().find(b => b.tenderId === tenderId);
    if (!bid) {
      return { submitted: false };
    }
    return { submitted: true, status: bid.status, bidId: bid.bidId };
  }

  // ==================== BID OPERATIONS ====================
  getBidDraft(tenderId: string): BidDraft | null {
    return this.draftsSignal().find(d => d.tenderId === tenderId) || null;
  }

  saveBidDraft(draftData: BidDraft): void {
    const drafts = this.draftsSignal();
    const existingIndex = drafts.findIndex(d => d.tenderId === draftData.tenderId);
    
    if (existingIndex >= 0) {
      drafts[existingIndex] = draftData;
    } else {
      drafts.push(draftData);
    }
    
    this.draftsSignal.set([...drafts]);
    this.saveDrafts();
  }

  clearBidDraft(tenderId: string): void {
    const drafts = this.draftsSignal().filter(d => d.tenderId !== tenderId);
    this.draftsSignal.set(drafts);
    this.saveDrafts();
  }

  submitBid(bidData: BidFormData, tenderId: string): { bidId: string } {
    const tender = this.getTenderDetail(tenderId);
    const bidId = `BID-${Date.now()}`;
    
    const newBid: Bid = {
      bidId,
      tenderId,
      tenderTitle: tender?.title || 'Unknown Tender',
      tenderClosingDate: tender?.bidWindowEnd || new Date().toISOString(),
      vendorId: 'current-vendor', // Would come from auth service
      
      // Technical Proposal
      technicalProposal: {
        companyProfile: bidData.companyProfile,
        relevantExperience: bidData.relevantExperience,
        similarWorkReferences: bidData.similarWorkReferences || [],
        technicalApproach: bidData.technicalApproach,
        manpowerPlan: bidData.manpowerPlan,
        equipmentPlan: bidData.equipmentPlan,
        deliveryTimeline: bidData.deliveryTimeline,
        deviations: bidData.deviations
      },
      
      // Commercial Proposal
      commercialProposal: {
        totalPrice: bidData.totalPrice,
        priceBreakdown: bidData.priceBreakdown || [],
        taxesAndDuties: bidData.taxesAndDuties,
        paymentTerms: bidData.paymentTerms,
        validityPeriod: bidData.validityPeriod,
        warrantyPricing: bidData.warrantyPricing,
        amcPricing: bidData.amcPricing
      },
      
      bidAmount: bidData.totalPrice,
      status: 'submitted',
      submittedAt: new Date().toISOString()
    };
    
    const bids = [...this.bidsSignal(), newBid];
    this.bidsSignal.set(bids);
    this.saveBids();
    
    // Clear draft
    this.clearBidDraft(tenderId);
    
    this.toastService.success('Bid submitted successfully!');
    return { bidId };
  }

  getMyBids(): Bid[] {
    return this.bidsSignal();
  }

  getMyBidsFiltered(status?: BidStatus): Bid[] {
    if (!status || status === 'draft') return this.bidsSignal();
    return this.bidsSignal().filter(b => b.status === status);
  }

  getBidDetail(bidId: string): Bid | undefined {
    return this.bidsSignal().find(b => b.bidId === bidId);
  }

  withdrawBid(bidId: string): boolean {
    const bids = this.bidsSignal().map(b => 
      b.bidId === bidId ? { ...b, status: 'withdrawn' as BidStatus, updatedAt: new Date().toISOString() } : b
    );
    this.bidsSignal.set(bids);
    this.saveBids();
    this.toastService.success('Bid withdrawn successfully');
    return true;
  }

  // ==================== SAVED TENDERS ====================
  saveTenderForLater(tenderId: string): void {
    const saved = this.savedTendersSignal();
    if (!saved.includes(tenderId)) {
      this.savedTendersSignal.set([...saved, tenderId]);
      this.saveSavedTenders();
      this.toastService.success('Tender saved to your favorites');
    }
  }

  removeSavedTender(tenderId: string): void {
    const saved = this.savedTendersSignal().filter(id => id !== tenderId);
    this.savedTendersSignal.set(saved);
    this.saveSavedTenders();
  }

  isTenderSaved(tenderId: string): boolean {
    return this.savedTendersSignal().includes(tenderId);
  }

  markTenderNotInterested(tenderId: string): void {
    // Would track in backend for recommendation algorithm
    this.toastService.info('Preference noted');
  }

  // ==================== CLARIFICATIONS ====================
  askClarification(tenderId: string, question: string): void {
    const clarification: TenderClarification = {
      id: `CLR-${Date.now()}`,
      tenderId,
      vendorId: 'current-vendor',
      question,
      askedAt: new Date().toISOString(),
      status: 'pending'
    };
    
    const clarifications = [...this.clarificationsSignal(), clarification];
    this.clarificationsSignal.set(clarifications);
    this.saveClarifications();
    this.toastService.success('Your question has been submitted');
  }

  // ==================== PROFILE COMPLETION ====================
  getProfileCompletion(): ProfileCompletion {
    // Mock data - would check actual profile fields
    return {
      percentage: 75,
      hasBusinessCertificate: true,
      hasServiceCapabilities: true,
      hasPortfolio: false,
      hasBankDetails: true,
      hasContactInfo: true
    };
  }

  // ==================== URGENT ACTIONS ====================
  getUrgentActions(): UrgentAction[] {
    const actions: UrgentAction[] = [];
    const tenders = this.tendersSignal().filter(t => t.status === 'published');
    
    // Check for tenders closing soon
    tenders.forEach(tender => {
      const hoursLeft = this.getHoursUntilClose(tender.bidWindowEnd);
      if (hoursLeft > 0 && hoursLeft <= 48) {
        actions.push({
          type: 'closing_soon',
          tenderId: tender.id,
          tenderTitle: tender.title,
          message: `Tender closing in ${Math.round(hoursLeft)} hours`,
          dueDate: tender.bidWindowEnd
        });
      }
    });
    
    return actions;
  }

  // ==================== UTILITY METHODS ====================
  private getHoursUntilClose(dateStr: string): number {
    const closeDate = new Date(dateStr);
    const now = new Date();
    return (closeDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  }

  private formatServiceType(type: string): string {
    return humanizeEnum(type);
  }

  // ==================== MOCK DATA ====================
  private getMockTenders(): PublishedTender[] {
    return [
      {
        id: 'TND-001',
        tenderId: 'TND-2024-001',
        title: 'Industrial AC Maintenance - Manufacturing Unit',
        category: 'technical',
        categoryLabel: 'Technical',
        location: 'Kottayam, Kerala',
        city: 'Kottayam',
        state: 'Kerala',
        scopeSummary: 'Annual maintenance contract for industrial air conditioning systems including central AC units, split ACs, and chiller systems across a 50,000 sq ft manufacturing facility.',
        detailedScope: 'Complete preventive maintenance, emergency repairs, filter replacements, and performance optimization for all HVAC equipment.',
        technicalRequirements: [
          'Experience with VRF systems',
          'Certified HVAC technicians',
          'Industrial safety training',
          '24/7 emergency support capability'
        ],
        budgetVisibility: 'show_range',
        budgetMin: 500000,
        budgetMax: 800000,
        expectedTimeline: '12 months',
        bidWindowStart: '2024-12-10T00:00:00Z',
        bidWindowEnd: '2024-12-25T23:59:59Z',
        publishedAt: '2024-12-10T10:00:00Z',
        paymentStructure: 'Quarterly payments based on service completion',
        warrantyExpectation: '6 months warranty on all repairs',
        eligibilityCriteria: [
          'Minimum 5 years experience in industrial HVAC',
          'Valid HVAC contractor license',
          'Insurance coverage of ₹50 lakhs',
          'ISO certification preferred'
        ],
        tags: ['HVAC', 'Industrial', 'AMC'],
        serviceType: 'ac_servicing',
        attachments: [
          { id: 'att-1', name: 'Equipment List.pdf', size: 245000, type: 'application/pdf', url: '#' },
          { id: 'att-2', name: 'Site Layout.pdf', size: 1200000, type: 'application/pdf', url: '#' }
        ],
        status: 'published'
      },
      {
        id: 'TND-002',
        tenderId: 'TND-2024-002',
        title: 'Residential AC Installation - Premium Villa',
        category: 'quick_service',
        categoryLabel: 'Quick Service',
        location: 'Ernakulam, Kerala',
        city: 'Ernakulam',
        state: 'Kerala',
        scopeSummary: 'Installation of split AC units in a 4-bedroom villa including electrical work and copper piping.',
        technicalRequirements: [
          '5-star energy rated units',
          'Proper insulation',
          'Concealed piping'
        ],
        budgetVisibility: 'show_exact',
        budgetExact: 150000,
        expectedTimeline: '1 week',
        bidWindowStart: '2024-12-12T00:00:00Z',
        bidWindowEnd: '2024-12-20T23:59:59Z',
        publishedAt: '2024-12-12T14:00:00Z',
        paymentStructure: '50% advance, 50% on completion',
        warrantyExpectation: '1 year installation warranty',
        eligibilityCriteria: [
          'Minimum 2 years experience',
          'Authorized dealer/installer preferred'
        ],
        tags: ['AC Installation', 'Residential', 'Quick'],
        serviceType: 'ac_installation',
        attachments: [],
        status: 'published'
      },
      {
        id: 'TND-003',
        tenderId: 'TND-2024-003',
        title: 'Office Interior Renovation - IT Company',
        category: 'mid_complexity',
        categoryLabel: 'Mid Complexity',
        location: 'Thrissur, Kerala',
        city: 'Thrissur',
        state: 'Kerala',
        scopeSummary: 'Complete interior renovation of a 5000 sq ft office space including false ceiling, flooring, partition walls, electrical work, and furniture.',
        detailedScope: 'Modern open-plan office design with meeting rooms, pantry, and reception area. Includes all civil, electrical, and carpentry work.',
        technicalRequirements: [
          'Experience in commercial interior projects',
          'In-house design team preferred',
          'Fire safety compliance',
          'Acoustic solutions for meeting rooms'
        ],
        budgetVisibility: 'show_range',
        budgetMin: 2000000,
        budgetMax: 3000000,
        expectedTimeline: '45 days',
        bidWindowStart: '2024-12-08T00:00:00Z',
        bidWindowEnd: '2024-12-22T23:59:59Z',
        publishedAt: '2024-12-08T09:00:00Z',
        paymentStructure: '30% advance, milestone-based payments',
        warrantyExpectation: '2 years warranty on all work',
        eligibilityCriteria: [
          'Minimum 3 years in commercial interiors',
          'Portfolio of completed office projects',
          'Licensed contractor'
        ],
        tags: ['Interior', 'Office', 'Renovation'],
        serviceType: 'interior_work',
        attachments: [
          { id: 'att-3', name: 'Floor Plan.pdf', size: 890000, type: 'application/pdf', url: '#' },
          { id: 'att-4', name: 'Reference Images.zip', size: 5600000, type: 'application/zip', url: '#' }
        ],
        status: 'published'
      },
      {
        id: 'TND-004',
        tenderId: 'TND-2024-004',
        title: 'Electrical Panel Upgrade - Commercial Complex',
        category: 'technical',
        categoryLabel: 'Technical',
        location: 'Kottayam, Kerala',
        city: 'Kottayam',
        state: 'Kerala',
        scopeSummary: 'Upgrade of main electrical panel and distribution boards in a 3-floor commercial complex. Includes load balancing and power factor correction.',
        technicalRequirements: [
          'Licensed electrical contractor',
          'Experience with commercial installations',
          'KSEB compliance knowledge',
          'Safety audit capability'
        ],
        budgetVisibility: 'hide',
        expectedTimeline: '2 weeks',
        bidWindowStart: '2024-12-13T00:00:00Z',
        bidWindowEnd: '2024-12-15T23:59:59Z',
        publishedAt: '2024-12-13T08:00:00Z',
        paymentStructure: 'On completion with retention',
        warrantyExpectation: '1 year warranty',
        eligibilityCriteria: [
          'Licensed Class A electrical contractor',
          'Minimum 5 years experience',
          'Insurance coverage required'
        ],
        tags: ['Electrical', 'Commercial', 'Urgent'],
        serviceType: 'electrical',
        attachments: [],
        status: 'published'
      },
      {
        id: 'TND-005',
        tenderId: 'TND-2024-005',
        title: 'Custom Metal Fabrication - Industrial Storage',
        category: 'mid_complexity',
        categoryLabel: 'Mid Complexity',
        location: 'Alappuzha, Kerala',
        city: 'Alappuzha',
        state: 'Kerala',
        scopeSummary: 'Design and fabrication of heavy-duty metal storage racks for warehouse. Total 50 units of varying sizes with powder coating finish.',
        technicalRequirements: [
          'Structural steel fabrication capability',
          'Powder coating facility',
          'Load testing certification'
        ],
        budgetVisibility: 'show_range',
        budgetMin: 800000,
        budgetMax: 1200000,
        expectedTimeline: '30 days',
        bidWindowStart: '2024-12-11T00:00:00Z',
        bidWindowEnd: '2024-12-28T23:59:59Z',
        publishedAt: '2024-12-11T11:00:00Z',
        paymentStructure: '40% advance, 60% on delivery',
        warrantyExpectation: '3 years structural warranty',
        eligibilityCriteria: [
          'Registered fabrication unit',
          'Experience in industrial storage solutions',
          'ISO 9001 certification preferred'
        ],
        tags: ['Fabrication', 'Industrial', 'Metal Work'],
        serviceType: 'fabrication',
        attachments: [
          { id: 'att-5', name: 'Technical Specifications.pdf', size: 450000, type: 'application/pdf', url: '#' }
        ],
        status: 'published'
      }
    ];
  }

  // ==================== real API (behind environment.useRealApi) ====================
  //
  // Saved tenders, "not interested", and per-tender bid status have no
  // backend counterpart — the API has no endpoints for them (confirmed
  // against TendersController; bid status genuinely belongs to the Bid API,
  // out of scope here). saveTenderForLater/removeSavedTender/isTenderSaved/
  // markTenderNotInterested/getMyBidStatus stay exactly as they are above,
  // client-side only, regardless of useRealApi.

  /** Replaces the mock-seeded tender list with the vendor's real matched tenders. */
  private async refreshTendersAsync(): Promise<void> {
    try {
      const page = await firstValueFrom(this.tenderApi.browse());
      this.tendersSignal.set(page.items.map(mapOpportunityDto));
    } catch {
      // 403 (unverified vendor) or a network hiccup: leave the list empty
      // rather than the mock seed data, which would misrepresent real
      // opportunities as available. The existing empty-state UI handles it.
      this.tendersSignal.set([]);
    }
  }

  /**
   * One tender in full, bundled with its clarifications and this vendor's
   * eligibility verdict — all three come from the same `GET /tenders/{id}`
   * response, so the detail page makes one call instead of three.
   */
  async getTenderDetailBundleAsync(
    tenderId: string
  ): Promise<{ tender: PublishedTender; clarifications: TenderClarification[]; eligibility: EligibilityResult } | null> {
    if (!environment.useRealApi) {
      const tender = this.getTenderDetail(tenderId);
      if (!tender) return null;
      return {
        tender,
        clarifications: this.getTenderClarifications(tenderId),
        eligibility: this.checkTenderEligibility(tenderId),
      };
    }

    try {
      const dto = await firstValueFrom(this.tenderApi.getById(tenderId));
      return {
        tender: mapVendorTenderDto(dto),
        clarifications: dto.clarifications.map(c => mapClarificationDto(c, tenderId)),
        eligibility: {
          eligible: dto.eligibilityResult?.eligible ?? false,
          reasons: dto.eligibilityResult?.reasons ?? [],
          // The backend folds "why not" into one reasons list rather than
          // separating a missing-requirements checklist from free-text
          // reasons — nothing here to split it back into.
          missingRequirements: [],
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Asks a question — `POST /tenders/{id}/clarifications`. Returns the new
   * (pending) clarification so the caller can show it immediately: a re-fetch
   * of the tender would not, since the vendor-facing detail only ever
   * includes *answered* questions.
   */
  async askClarificationAsync(tenderId: string, question: string): Promise<TenderClarification | null> {
    if (!environment.useRealApi) {
      this.askClarification(tenderId, question);
      return this.getTenderClarifications(tenderId).at(-1) ?? null;
    }

    try {
      const dto = await firstValueFrom(this.tenderApi.askClarification(tenderId, question));
      this.toastService.success('Your question has been submitted');
      return mapClarificationDto(dto, tenderId);
    } catch {
      this.toastService.error('Could not submit your question. Please try again.');
      return null;
    }
  }

  private getMockClarifications(): TenderClarification[] {
    return [
      {
        id: 'CLR-001',
        tenderId: 'TND-001',
        vendorId: 'vendor-1',
        question: 'Is there an existing AMC vendor whose contract we would be taking over? If yes, can we get access to the maintenance history?',
        askedAt: '2024-12-11T10:30:00Z',
        status: 'answered',
        answer: 'Yes, the current AMC is with XYZ Services. Maintenance records for the past 2 years will be shared with the selected vendor.',
        answeredAt: '2024-12-11T16:45:00Z',
        answeredBy: 'Management'
      },
      {
        id: 'CLR-002',
        tenderId: 'TND-001',
        vendorId: 'vendor-2',
        question: 'What is the expected response time for emergency breakdown calls?',
        askedAt: '2024-12-12T09:15:00Z',
        status: 'answered',
        answer: 'Maximum 4 hours response time during working hours (8 AM - 6 PM). 8 hours for after-hours emergencies.',
        answeredAt: '2024-12-12T14:20:00Z',
        answeredBy: 'Management'
      },
      {
        id: 'CLR-003',
        tenderId: 'TND-003',
        vendorId: 'vendor-3',
        question: 'Can we submit alternative design proposals along with the bid?',
        askedAt: '2024-12-13T11:00:00Z',
        status: 'pending'
      }
    ];
  }
}

function mapBudget(budget: TenderBudgetDto | null): { budgetMin?: number; budgetMax?: number; budgetExact?: number } {
  return {
    budgetMin: budget?.min ?? undefined,
    budgetMax: budget?.max ?? undefined,
    budgetExact: budget?.exact ?? undefined,
  };
}

/**
 * The backend expresses eligibility as structured booleans (`insuranceRequired`
 * + a coverage string, etc.); the frontend model displays it as a flat bullet
 * list. This is the one place that turns one into the other.
 */
function eligibilityCriteriaList(e: TenderEligibilityDto): string[] {
  const items: string[] = [];
  if (e.certificationsRequired) {
    items.push(e.certificationDetails || 'Relevant certifications required');
  }
  if (e.insuranceRequired) {
    items.push(e.insuranceMinCoverage
      ? `Insurance coverage of at least ${e.insuranceMinCoverage}`
      : 'Insurance coverage required');
  }
  if (e.bondCapabilityRequired) {
    items.push(e.bondMinAmount
      ? `Bond capability of at least ${e.bondMinAmount}`
      : 'Bond capability required');
  }
  if (e.regionalPresenceRequired) items.push('Regional presence required');
  if (e.experienceRequired) {
    items.push(e.minimumExperienceYears
      ? `Minimum ${e.minimumExperienceYears} years of experience`
      : 'Prior relevant experience required');
  }
  if (e.customCriteria) items.push(e.customCriteria);
  return items;
}

/** List-row mapping — `TenderOpportunityDto` doesn't carry scope, requirements, or attachments. */
function mapOpportunityDto(dto: TenderOpportunityDto): PublishedTender {
  return {
    id: dto.id,
    tenderId: dto.tenderNumber,
    title: dto.title,
    category: dto.category,
    categoryLabel: humanizeEnum(dto.category),
    location: dto.state ? `${dto.city}, ${dto.state}` : dto.city,
    city: dto.city,
    state: dto.state ?? '',
    scopeSummary: '',
    technicalRequirements: [],
    budgetVisibility: dto.budgetVisibility as BudgetVisibility,
    ...mapBudget(dto.budget),
    expectedTimeline: '',
    bidWindowStart: '',
    bidWindowEnd: dto.deadline ?? '',
    publishedAt: dto.publishedAt ?? '',
    paymentStructure: '',
    warrantyExpectation: '',
    eligibilityCriteria: [],
    tags: [],
    serviceType: dto.serviceId,
    attachments: [],
    status: 'published',
  };
}

/** Full detail mapping — every field the vendor-facing `GET /tenders/{id}` carries. */
function mapVendorTenderDto(dto: VendorTenderDto): PublishedTender {
  return {
    id: dto.id,
    tenderId: dto.tenderNumber,
    title: dto.title,
    category: dto.category,
    categoryLabel: humanizeEnum(dto.category),
    location: dto.location ?? (dto.state ? `${dto.city}, ${dto.state}` : dto.city),
    city: dto.city,
    state: dto.state ?? '',
    scopeSummary: dto.scopeSummary,
    detailedScope: dto.detailedScope ?? undefined,
    technicalRequirements: dto.technicalRequirements,
    budgetVisibility: dto.budgetVisibility as BudgetVisibility,
    ...mapBudget(dto.budget),
    expectedTimeline: dto.expectedTimeline ?? '',
    bidWindowStart: dto.bidWindowStart ?? '',
    bidWindowEnd: dto.bidWindowEnd ?? '',
    publishedAt: dto.publishedAt ?? '',
    paymentStructure: dto.paymentStructure ?? '',
    warrantyExpectation: dto.warrantyExpectation ?? '',
    eligibilityCriteria: eligibilityCriteriaList(dto.eligibility),
    tags: dto.tags,
    serviceType: dto.serviceId,
    attachments: dto.attachments.map(a => ({
      id: a.id,
      name: a.fileName,
      size: a.fileSizeBytes ?? 0,
      type: a.contentType ?? '',
      url: a.fileUrl,
    })),
    status: dto.status as TenderStatus,
  };
}

function mapClarificationDto(dto: TenderClarificationDto, tenderId: string): TenderClarification {
  return {
    id: dto.id,
    tenderId,
    vendorId: '',
    question: dto.question,
    askedAt: dto.askedAt,
    status: dto.status as 'pending' | 'answered',
    answer: dto.answer ?? undefined,
    answeredAt: dto.answeredAt ?? undefined,
  };
}
