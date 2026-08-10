import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { 
  ServiceRequest, 
  ServiceRequestStatus, 
  ServiceRequestFilter, 
  ServiceRequestDashboardStats,
  AIGeneratedDraft,
  TenderDocument,
  Clarification,
  ReviewFormData,
  PublishSettings,
  ServiceCategory
} from './management.model';
import { ToastService } from '../../core/services/toast.service';

const SERVICE_REQUESTS_KEY = 'heavenly_service_requests';
const TENDERS_KEY = 'heavenly_tenders';
const CLARIFICATIONS_KEY = 'heavenly_clarifications';

@Injectable({
  providedIn: 'root'
})
export class ServiceRequestManagementService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastService = inject(ToastService);

  // Signals
  private readonly requestsSignal = signal<ServiceRequest[]>([]);
  private readonly tendersSignal = signal<TenderDocument[]>([]);
  private readonly clarificationsSignal = signal<Clarification[]>([]);
  private readonly filterSignal = signal<ServiceRequestFilter>('pending');
  private readonly loadingSignal = signal<boolean>(false);

  // Public readonly signals
  readonly requests = this.requestsSignal.asReadonly();
  readonly tenders = this.tendersSignal.asReadonly();
  readonly clarifications = this.clarificationsSignal.asReadonly();
  readonly filter = this.filterSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  // Computed values
  readonly filteredRequests = computed(() => {
    const currentFilter = this.filterSignal();
    const allRequests = this.requestsSignal();

    switch (currentFilter) {
      case 'all':
        return allRequests;
      case 'pending':
        return allRequests.filter(r => r.status === 'submitted');
      case 'under_review':
        return allRequests.filter(r => r.status === 'under_review');
      case 'high_priority':
        return allRequests.filter(r => r.urgency === 'high' || r.urgency === 'urgent');
      case 'technical':
        return allRequests.filter(r => r.category === 'technical');
      case 'needs_attention':
        return allRequests.filter(r => r.hasWarnings);
      case 'incomplete':
        return allRequests.filter(r => r.warnings.some(w => w.type === 'incomplete_info'));
      case 'approved':
        return allRequests.filter(r => r.status === 'approved');
      case 'published':
        return allRequests.filter(r => r.status === 'published');
      default:
        return allRequests;
    }
  });

  readonly stats = computed<ServiceRequestDashboardStats>(() => {
    const allRequests = this.requestsSignal();
    const allTenders = this.tendersSignal();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      pendingReview: allRequests.filter(r => r.status === 'submitted').length,
      underReview: allRequests.filter(r => r.status === 'under_review').length,
      approved: allRequests.filter(r => r.status === 'approved').length,
      liveTenders: allTenders.filter(t => t.status === 'published').length,
      changesRequired: allRequests.filter(r => r.status === 'changes_required').length,
      totalThisMonth: allRequests.filter(r => new Date(r.submittedAt) >= startOfMonth).length
    };
  });

  readonly approvedRequests = computed(() => {
    return this.requestsSignal().filter(r => r.status === 'approved');
  });

  constructor() {
    this.loadData();
  }

  // ==================== DATA LOADING ====================
  loadData(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.loadRequests();
    this.loadTenders();
    this.loadClarifications();
  }

  private loadRequests(): void {
    const savedRequests = localStorage.getItem(SERVICE_REQUESTS_KEY);
    if (savedRequests) {
      try {
        this.requestsSignal.set(JSON.parse(savedRequests));
      } catch {
        this.requestsSignal.set(this.getMockRequests());
        this.saveRequests();
      }
    } else {
      this.requestsSignal.set(this.getMockRequests());
      this.saveRequests();
    }
  }

  private loadTenders(): void {
    const savedTenders = localStorage.getItem(TENDERS_KEY);
    if (savedTenders) {
      try {
        this.tendersSignal.set(JSON.parse(savedTenders));
      } catch {
        this.tendersSignal.set([]);
      }
    }
  }

  private loadClarifications(): void {
    const savedClarifications = localStorage.getItem(CLARIFICATIONS_KEY);
    if (savedClarifications) {
      try {
        this.clarificationsSignal.set(JSON.parse(savedClarifications));
      } catch {
        this.clarificationsSignal.set(this.getMockClarifications());
      }
    } else {
      this.clarificationsSignal.set(this.getMockClarifications());
    }
  }

  private saveRequests(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(SERVICE_REQUESTS_KEY, JSON.stringify(this.requestsSignal()));
  }

  private saveTenders(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(TENDERS_KEY, JSON.stringify(this.tendersSignal()));
  }

  private saveClarifications(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(CLARIFICATIONS_KEY, JSON.stringify(this.clarificationsSignal()));
  }

  // ==================== FILTER ====================
  setFilter(filter: ServiceRequestFilter): void {
    this.filterSignal.set(filter);
  }

  // ==================== REQUEST OPERATIONS ====================
  getRequest(requestId: string): ServiceRequest | undefined {
    return this.requestsSignal().find(r => r.id === requestId);
  }

  updateRequestStatus(requestId: string, status: ServiceRequestStatus, notes?: string): void {
    const updatedRequests = this.requestsSignal().map(request =>
      request.id === requestId 
        ? { 
            ...request, 
            status, 
            lastUpdatedAt: new Date().toISOString(),
            internalNotes: notes || request.internalNotes
          } 
        : request
    );
    this.requestsSignal.set(updatedRequests);
    this.saveRequests();
  }

  startReview(requestId: string): void {
    this.updateRequestStatus(requestId, 'under_review');
    this.toastService.info('Request is now under review');
  }

  requestClarification(requestId: string, subject: string, message: string, isUrgent: boolean): void {
    this.updateRequestStatus(requestId, 'changes_required');
    // In real app, this would send notification to requester
    this.toastService.success('Clarification request sent to the requester');
  }

  rejectRequest(requestId: string, reason: string, message?: string): void {
    const fullReason = message ? `Rejected: ${reason} - ${message}` : `Rejected: ${reason}`;
    this.updateRequestStatus(requestId, 'rejected', fullReason);
    this.toastService.info('Request has been rejected');
  }

  approveRequest(requestId: string, reviewData: ReviewFormData): void {
    const request = this.getRequest(requestId);
    if (!request) return;

    // Update request status
    this.updateRequestStatus(requestId, 'approved', reviewData.internalNotes);

    // Generate tender document
    const tender = this.generateTenderDocument(requestId, reviewData);
    const tenders = [...this.tendersSignal(), tender];
    this.tendersSignal.set(tenders);
    this.saveTenders();

    this.toastService.success('Request approved! Tender is ready for publishing.');
  }

  saveReviewDraft(requestId: string, reviewData: Partial<ReviewFormData>): void {
    // Store draft in localStorage
    if (!isPlatformBrowser(this.platformId)) return;
    const key = `review_draft_${requestId}`;
    localStorage.setItem(key, JSON.stringify(reviewData));
    this.toastService.success('Draft saved');
  }

  getReviewDraft(requestId: string): Partial<ReviewFormData> | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const key = `review_draft_${requestId}`;
    const draft = localStorage.getItem(key);
    return draft ? JSON.parse(draft) : null;
  }

  // ==================== AI DRAFT ====================
  getAIDraft(requestId: string): AIGeneratedDraft {
    const request = this.getRequest(requestId);
    if (!request) {
      return this.getDefaultAIDraft();
    }

    // Generate mock AI draft based on request data
    return {
      tenderTitle: `${request.serviceName} - ${request.city}, ${request.state}`,
      scopeSummary: this.generateScopeSummary(request),
      commercialStructure: this.generateCommercialStructure(request),
      tags: {
        complexityLevel: this.calculateComplexity(request.category),
        riskLevel: this.calculateRisk(request),
        expectedVendorType: this.suggestVendorType(request.category)
      },
      suggestedBidWindow: {
        start: this.addDays(new Date(), 1).toISOString(),
        end: this.addDays(new Date(), 7).toISOString()
      },
      identifiedGaps: this.identifyGaps(request),
      clarityScore: this.calculateClarityScore(request),
      suggestedEligibility: this.suggestEligibility(request.category)
    };
  }

  private generateScopeSummary(request: ServiceRequest): string {
    return `${request.description || 'Service request'}\n\nLocation: ${request.address}, ${request.city}, ${request.state} - ${request.pincode}\n\nUrgency: ${request.urgency}`;
  }

  private generateCommercialStructure(request: ServiceRequest): string {
    if (request.budgetMin && request.budgetMax) {
      return `Budget Range: ${request.budgetCurrency} ${request.budgetMin.toLocaleString()} - ${request.budgetMax.toLocaleString()}\n\nPayment Terms: ${request.preferredPaymentTerms || 'Standard terms apply'}`;
    }
    return 'Budget to be discussed. Standard payment terms apply.';
  }

  private calculateComplexity(category: ServiceCategory): 'low' | 'medium' | 'high' {
    switch (category) {
      case 'quick_service': return 'low';
      case 'mid_complexity': return 'medium';
      case 'technical': return 'high';
      default: return 'medium';
    }
  }

  private calculateRisk(request: ServiceRequest): 'low' | 'medium' | 'high' {
    if (request.urgency === 'urgent' || request.hasWarnings) return 'high';
    if (request.urgency === 'high') return 'medium';
    return 'low';
  }

  private suggestVendorType(category: ServiceCategory): string {
    switch (category) {
      case 'quick_service': return 'Certified Service Technicians';
      case 'mid_complexity': return 'Licensed Contractors';
      case 'technical': return 'Specialized Industrial Service Providers';
      default: return 'Qualified Service Providers';
    }
  }

  private identifyGaps(request: ServiceRequest): string[] {
    const gaps: string[] = [];
    if (!request.attachments?.length) {
      gaps.push('No supporting documents or images uploaded');
    }
    if (!request.preferredStartDate) {
      gaps.push('No preferred start date specified');
    }
    if (!request.budgetMin && !request.budgetMax) {
      gaps.push('Budget not specified');
    }
    if (request.description && request.description.length < 100) {
      gaps.push('Description may need more detail');
    }
    return gaps;
  }

  private calculateClarityScore(request: ServiceRequest): number {
    let score = 50; // Base score
    
    if (request.description && request.description.length > 100) score += 15;
    if (request.attachments?.length) score += 15;
    if (request.budgetMin || request.budgetMax) score += 10;
    if (request.preferredStartDate) score += 5;
    if (request.preferredEndDate) score += 5;
    if (!request.hasWarnings) score += 10;
    
    return Math.min(100, score);
  }

  private suggestEligibility(category: ServiceCategory): string[] {
    const base = ['Minimum 2 years experience'];
    switch (category) {
      case 'technical':
        return [...base, 'Required certifications', 'Financial capacity proof', 'Previous similar work references'];
      case 'mid_complexity':
        return [...base, 'Valid licenses', 'Insurance coverage'];
      case 'quick_service':
        return base;
      default:
        return base;
    }
  }

  private getDefaultAIDraft(): AIGeneratedDraft {
    return {
      tenderTitle: 'Service Request',
      scopeSummary: 'Details pending',
      commercialStructure: 'To be determined',
      tags: { complexityLevel: 'medium', riskLevel: 'low', expectedVendorType: 'Service Providers' },
      suggestedBidWindow: { start: new Date().toISOString(), end: this.addDays(new Date(), 7).toISOString() },
      identifiedGaps: [],
      clarityScore: 70,
      suggestedEligibility: []
    };
  }

  // ==================== TENDER OPERATIONS ====================
  generateTenderDocument(requestId: string, reviewData: ReviewFormData): TenderDocument {
    const request = this.getRequest(requestId);
    const tenderId = `TND-${new Date().getFullYear()}-${String(this.tendersSignal().length + 1).padStart(3, '0')}`;

    return {
      tenderId,
      requestId,
      title: reviewData.tenderTitle,
      issueDate: new Date().toISOString(),
      category: request?.category || 'mid_complexity',
      scopeSummary: reviewData.scopeSummary,
      commercialStructure: reviewData.commercialStructure,
      sections: [
        { title: 'Scope of Work', content: reviewData.scopeSummary, order: 1 },
        { title: 'Technical Expectations', content: request?.description || '', order: 2 },
        { title: 'Commercial Format', content: reviewData.commercialStructure, order: 3 },
        { title: 'Submission Deadline', content: `Bid window: ${reviewData.bidWindowStart} to ${reviewData.bidWindowEnd}`, order: 4 },
        { title: 'Evaluation Basis', content: this.formatEligibility(reviewData.eligibilityCriteria), order: 5 }
      ],
      bidWindowStart: reviewData.bidWindowStart,
      bidWindowEnd: reviewData.bidWindowEnd,
      eligibilityCriteria: {
        certifications: { required: reviewData.eligibilityCriteria.certifications, details: reviewData.eligibilityCriteria.requiredCertifications?.join(', ') },
        insurance: { required: true, minCoverage: '₹50 lakhs' },
        bondCapability: { required: reviewData.eligibilityCriteria.financialCapacity, minAmount: '₹10 lakhs' },
        regionalPresence: { required: false },
        experienceYears: { required: reviewData.eligibilityCriteria.minExperience, minimum: reviewData.eligibilityCriteria.minExperienceYears }
      },
      budgetVisibility: reviewData.budgetVisibility,
      tenderType: reviewData.tenderType,
      attachments: request?.attachments?.map(a => ({ name: a.fileName, size: `${Math.round(a.fileSize / 1024)} KB`, url: a.url })) || [],
      status: 'approved'
    };
  }

  private formatEligibility(criteria: ReviewFormData['eligibilityCriteria']): string {
    const items: string[] = [];
    if (criteria.minExperience) items.push(`Minimum ${criteria.minExperienceYears || 2} years experience`);
    if (criteria.certifications) items.push('Required certifications');
    if (criteria.financialCapacity) items.push('Financial capacity proof required');
    if (criteria.previousWork) items.push('Previous similar work references');
    return items.length ? items.join('\n') : 'Open to all qualified vendors';
  }

  getTender(tenderId: string): TenderDocument | undefined {
    return this.tendersSignal().find(t => t.tenderId === tenderId);
  }

  getTenderByRequestId(requestId: string): TenderDocument | undefined {
    return this.tendersSignal().find(t => t.requestId === requestId);
  }

  publishTender(tenderId: string, settings: PublishSettings): void {
    const updatedTenders = this.tendersSignal().map(tender =>
      tender.tenderId === tenderId
        ? { 
            ...tender, 
            status: 'published' as const,
            publishedAt: settings.scheduledPublishDate || new Date().toISOString()
          }
        : tender
    );
    this.tendersSignal.set(updatedTenders);
    this.saveTenders();

    // Update request status
    const tender = this.getTender(tenderId);
    if (tender) {
      this.updateRequestStatus(tender.requestId, 'published');
    }

    this.toastService.success('Tender published successfully!');
  }

  // ==================== CLARIFICATIONS ====================
  getClarificationsForTender(tenderId: string): Clarification[] {
    return this.clarificationsSignal().filter(c => c.tenderId === tenderId);
  }

  answerClarification(clarificationId: string, answer: string, answeredBy: string): void {
    const updatedClarifications = this.clarificationsSignal().map(c =>
      c.id === clarificationId
        ? {
            ...c,
            status: 'answered' as const,
            answer,
            answeredBy,
            answeredAt: new Date().toISOString(),
            visibleToAllVendors: true
          }
        : c
    );
    this.clarificationsSignal.set(updatedClarifications);
    this.saveClarifications();
    this.toastService.success('Clarification answered and published to all vendors');
  }

  forwardToRequester(clarificationId: string): void {
    const updatedClarifications = this.clarificationsSignal().map(c =>
      c.id === clarificationId
        ? { ...c, status: 'forwarded' as const }
        : c
    );
    this.clarificationsSignal.set(updatedClarifications);
    this.saveClarifications();
    this.toastService.info('Question forwarded to the requester');
  }

  // ==================== UTILITIES ====================
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // ==================== MOCK DATA ====================
  private getMockRequests(): ServiceRequest[] {
    return [
      {
        id: 'REQ-001',
        requestNumber: 'REQ-2024-001',
        serviceId: 'srv-ac-001',
        serviceName: 'AC Servicing & Maintenance',
        category: 'quick_service',
        status: 'submitted',
        requesterId: 'user-001',
        requesterName: 'John Doe',
        requesterEmail: 'john.doe@example.com',
        requesterPhone: '+91 98765 43210',
        requesterType: 'individual',
        location: 'Kottayam, Kerala',
        address: '123 MG Road',
        city: 'Kottayam',
        state: 'Kerala',
        pincode: '686001',
        title: 'Split AC Maintenance Required',
        description: 'Need regular maintenance for 2 split AC units. Both units are 1.5 ton capacity, installed 2 years ago. No major issues, just routine cleaning and gas check needed.',
        urgency: 'medium',
        budgetMin: 2000,
        budgetMax: 5000,
        budgetCurrency: 'INR',
        preferredPaymentTerms: 'Payment on completion',
        preferredStartDate: '2024-12-20',
        preferredEndDate: '2024-12-25',
        flexibleDates: true,
        attachments: [],
        submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        lastUpdatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        hasWarnings: true,
        warnings: [
          { type: 'missing_documents', message: 'No images of AC units uploaded', severity: 'info' }
        ]
      },
      {
        id: 'REQ-002',
        requestNumber: 'REQ-2024-002',
        serviceId: 'srv-elec-001',
        serviceName: 'Electrical Wiring & Installation',
        category: 'mid_complexity',
        status: 'submitted',
        requesterId: 'user-002',
        requesterName: 'ABC Enterprises',
        requesterEmail: 'contact@abcenterprises.com',
        requesterPhone: '+91 98765 12345',
        requesterType: 'sme',
        location: 'Ernakulam, Kerala',
        address: '456 Industrial Area',
        city: 'Ernakulam',
        state: 'Kerala',
        pincode: '682001',
        title: 'Complete Rewiring for Office Building',
        description: 'Complete electrical rewiring required for a 3-story office building. Current wiring is 15 years old and needs to be replaced with modern wiring for safety compliance.',
        urgency: 'high',
        technicalDetails: {
          buildingArea: '5000 sqft',
          floors: 3,
          currentLoad: '50 kVA',
          requiredLoad: '100 kVA'
        },
        budgetMin: 200000,
        budgetMax: 350000,
        budgetCurrency: 'INR',
        preferredPaymentTerms: '50% advance, 50% on completion',
        preferredStartDate: '2025-01-05',
        preferredEndDate: '2025-01-30',
        flexibleDates: false,
        attachments: [
          { id: 'att-001', fileName: 'building_layout.pdf', fileType: 'application/pdf', fileSize: 2048000, uploadedAt: new Date().toISOString(), url: '#' }
        ],
        submittedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        lastUpdatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        hasWarnings: false,
        warnings: []
      },
      {
        id: 'REQ-003',
        requestNumber: 'REQ-2024-003',
        serviceId: 'srv-trans-001',
        serviceName: 'Transformer Installation & Rewinding',
        category: 'technical',
        status: 'under_review',
        requesterId: 'user-003',
        requesterName: 'Kerala Industries Ltd',
        requesterEmail: 'procurement@keralaindustries.com',
        requesterPhone: '+91 484 2345678',
        requesterType: 'large_organization',
        location: 'Thrissur, Kerala',
        address: '789 Industrial Estate',
        city: 'Thrissur',
        state: 'Kerala',
        pincode: '680001',
        title: 'Industrial Transformer Rewinding',
        description: 'Rewinding required for 500 kVA distribution transformer. Currently experiencing overheating issues. Need expert assessment and rewinding with high-quality materials.',
        urgency: 'urgent',
        technicalDetails: {
          transformerRating: '500 kVA',
          voltageRatio: '11kV/440V',
          coolingType: 'ONAN',
          age: '8 years',
          issue: 'Overheating and insulation degradation'
        },
        budgetMin: 500000,
        budgetMax: 800000,
        budgetCurrency: 'INR',
        preferredPaymentTerms: 'As per contract terms',
        preferredStartDate: '2024-12-18',
        flexibleDates: false,
        attachments: [
          { id: 'att-002', fileName: 'transformer_specs.pdf', fileType: 'application/pdf', fileSize: 1024000, uploadedAt: new Date().toISOString(), url: '#' },
          { id: 'att-003', fileName: 'site_images.zip', fileType: 'application/zip', fileSize: 5120000, uploadedAt: new Date().toISOString(), url: '#' }
        ],
        submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        lastUpdatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        hasWarnings: true,
        warnings: [
          { type: 'tight_timeline', message: 'Urgent timeline - may limit vendor responses', severity: 'warning' }
        ],
        reviewedBy: 'admin',
        reviewedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'REQ-004',
        requestNumber: 'REQ-2024-004',
        serviceId: 'srv-plumb-001',
        serviceName: 'Plumbing Services',
        category: 'quick_service',
        status: 'approved',
        requesterId: 'user-004',
        requesterName: 'Mary Thomas',
        requesterEmail: 'mary.thomas@email.com',
        requesterPhone: '+91 94567 12345',
        requesterType: 'individual',
        location: 'Thiruvananthapuram, Kerala',
        address: '321 Beach Road',
        city: 'Thiruvananthapuram',
        state: 'Kerala',
        pincode: '695001',
        title: 'Bathroom Plumbing Repair',
        description: 'Bathroom pipes leaking. Need immediate repair and replacement of faulty fittings.',
        urgency: 'high',
        budgetMin: 3000,
        budgetMax: 8000,
        budgetCurrency: 'INR',
        preferredPaymentTerms: 'Payment on completion',
        preferredStartDate: '2024-12-16',
        flexibleDates: true,
        attachments: [],
        submittedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        lastUpdatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        hasWarnings: false,
        warnings: [],
        reviewedBy: 'admin',
        reviewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  private getMockClarifications(): Clarification[] {
    return [
      {
        id: 'CLR-001',
        tenderId: 'TND-2024-001',
        vendorId: 'vendor-001',
        vendorName: 'Vendor #1',
        question: 'What is the required material grade for the fabrication work?',
        askedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        visibleToAllVendors: false
      },
      {
        id: 'CLR-002',
        tenderId: 'TND-2024-001',
        vendorId: 'vendor-002',
        vendorName: 'Vendor #2',
        question: 'Can we use IS 2062 grade instead of the specified grade?',
        askedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        status: 'answered',
        answer: 'Yes, IS 2062 grade is acceptable for this project.',
        answeredBy: 'Management',
        answeredAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        visibleToAllVendors: true
      }
    ];
  }
}
