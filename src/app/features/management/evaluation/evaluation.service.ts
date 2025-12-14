import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  LiveTender,
  TenderStats,
  EvaluationBid,
  TechnicalEvaluation,
  NegotiationNote,
  AwardData,
  AwardResult,
  DisqualifyData,
  EvaluationPhase,
  BidComparison
} from './evaluation.model';
import { ToastService } from '../../../core/services/toast.service';

const EVALUATION_TENDERS_KEY = 'heavenly_evaluation_tenders';
const EVALUATION_BIDS_KEY = 'heavenly_evaluation_bids';

@Injectable({
  providedIn: 'root'
})
export class EvaluationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastService = inject(ToastService);

  // Signals
  private readonly tendersSignal = signal<LiveTender[]>([]);
  private readonly bidsSignal = signal<EvaluationBid[]>([]);

  // Public readonly
  readonly tenders = this.tendersSignal.asReadonly();
  readonly bids = this.bidsSignal.asReadonly();

  // Computed stats
  readonly stats = computed<TenderStats>(() => {
    const tenders = this.tendersSignal();
    const bids = this.bidsSignal();
    
    return {
      activeTenders: tenders.filter(t => t.evaluationPhase !== 'cancelled' && t.evaluationPhase !== 'awarded').length,
      receivingBids: tenders.filter(t => t.evaluationPhase === 'accepting_bids').length,
      readyForEvaluation: tenders.filter(t => t.evaluationPhase === 'bid_closed' && t.totalBids > 0).length,
      underEvaluation: tenders.filter(t => 
        t.evaluationPhase === 'technical_review' || 
        t.evaluationPhase === 'commercial_review' ||
        t.evaluationPhase === 'shortlisted'
      ).length,
      awarded: tenders.filter(t => t.evaluationPhase === 'awarded').length,
      totalBidsReceived: bids.length
    };
  });

  constructor() {
    this.loadData();
  }

  // ==================== DATA LOADING ====================
  private loadData(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadTenders();
    this.loadBids();
  }

  private loadTenders(): void {
    const saved = localStorage.getItem(EVALUATION_TENDERS_KEY);
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
    const saved = localStorage.getItem(EVALUATION_BIDS_KEY);
    if (saved) {
      try {
        this.bidsSignal.set(JSON.parse(saved));
      } catch {
        this.bidsSignal.set(this.getMockBids());
        this.saveBids();
      }
    } else {
      this.bidsSignal.set(this.getMockBids());
      this.saveBids();
    }
  }

  private saveTenders(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(EVALUATION_TENDERS_KEY, JSON.stringify(this.tendersSignal()));
  }

  private saveBids(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(EVALUATION_BIDS_KEY, JSON.stringify(this.bidsSignal()));
  }

  // ==================== DASHBOARD OPERATIONS ====================
  getLiveTenders(): LiveTender[] {
    return this.tendersSignal();
  }

  getLiveTendersFiltered(status: string, searchQuery: string): LiveTender[] {
    let tenders = this.tendersSignal();
    
    if (status && status !== 'all') {
      tenders = tenders.filter(t => t.evaluationPhase === status);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tenders = tenders.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.tenderId.toLowerCase().includes(query)
      );
    }
    
    return tenders;
  }

  getTenderStats(): TenderStats {
    return this.stats();
  }

  // ==================== TENDER DETAIL ====================
  getTenderDetail(tenderId: string): LiveTender | undefined {
    return this.tendersSignal().find(t => t.id === tenderId || t.tenderId === tenderId);
  }

  getTenderBids(tenderId: string): EvaluationBid[] {
    return this.bidsSignal().filter(b => b.tenderId === tenderId);
  }

  getBidDetail(bidId: string): EvaluationBid | undefined {
    return this.bidsSignal().find(b => b.id === bidId || b.bidId === bidId);
  }

  // ==================== TECHNICAL EVALUATION ====================
  getTechnicalEvaluation(bidId: string): TechnicalEvaluation | null {
    const bid = this.getBidDetail(bidId);
    return bid?.technicalEvaluation || null;
  }

  saveTechnicalEvaluation(data: Partial<TechnicalEvaluation> & { bidId: string }): void {
    const bids = this.bidsSignal().map(bid => {
      if (bid.id === data.bidId || bid.bidId === data.bidId) {
        const evaluation: TechnicalEvaluation = {
          id: `TECH-${Date.now()}`,
          bidId: data.bidId,
          complianceScore: data.complianceScore || 0,
          experienceRating: data.experienceRating || 0,
          technicalApproachRating: data.technicalApproachRating || 0,
          timelineRating: data.timelineRating || 0,
          overallScore: data.overallScore || 0,
          notes: data.notes || '',
          status: 'draft',
          evaluatedBy: 'current-user',
          evaluatedAt: new Date().toISOString()
        };
        
        return {
          ...bid,
          technicalEvaluation: evaluation,
          technicalNotes: data.notes || ''
        };
      }
      return bid;
    });
    
    this.bidsSignal.set(bids);
    this.saveBids();
    this.toastService.success('Evaluation saved');
  }

  submitTechnicalEvaluation(data: Partial<TechnicalEvaluation> & { bidId: string; overallScore: number }): void {
    const bids = this.bidsSignal().map(bid => {
      if (bid.id === data.bidId || bid.bidId === data.bidId) {
        const evaluation: TechnicalEvaluation = {
          id: `TECH-${Date.now()}`,
          bidId: data.bidId,
          complianceScore: data.complianceScore || 0,
          experienceRating: data.experienceRating || 0,
          technicalApproachRating: data.technicalApproachRating || 0,
          timelineRating: data.timelineRating || 0,
          overallScore: data.overallScore,
          notes: data.notes || '',
          status: 'submitted',
          evaluatedBy: 'current-user',
          evaluatedAt: new Date().toISOString()
        };
        
        return {
          ...bid,
          technicalEvaluation: evaluation,
          technicalStatus: 'qualified' as const,
          technicalScore: data.overallScore,
          technicalNotes: data.notes || '',
          status: 'under_review' as const
        };
      }
      return bid;
    });
    
    this.bidsSignal.set(bids);
    this.saveBids();
    this.updateTenderPhase(data.bidId);
    this.toastService.success('Bid marked as technically qualified');
  }

  disqualifyBid(data: DisqualifyData): void {
    const bids = this.bidsSignal().map(bid => {
      if (bid.id === data.bidId || bid.bidId === data.bidId) {
        return {
          ...bid,
          technicalStatus: 'disqualified' as const,
          status: 'rejected' as const,
          disqualificationReason: data.reason,
          rejectionReason: data.explanation
        };
      }
      return bid;
    });
    
    this.bidsSignal.set(bids);
    this.saveBids();
    this.toastService.success('Bid disqualified');
  }

  // ==================== COMMERCIAL EVALUATION ====================
  getQualifiedBids(tenderId: string): EvaluationBid[] {
    return this.getTenderBids(tenderId).filter(b => b.technicalStatus === 'qualified');
  }

  getComparisonData(tenderId: string): BidComparison[] {
    const qualified = this.getQualifiedBids(tenderId);
    const prices = qualified.map(b => b.totalPrice);
    const minPrice = Math.min(...prices);
    
    return qualified.map(bid => {
      const priceScore = minPrice > 0 ? (minPrice / bid.totalPrice) * 100 : 100;
      const valueScore = Math.round(
        (bid.technicalScore * 0.4) + 
        (priceScore * 0.4) + 
        (80 * 0.2) // Terms score placeholder
      );
      
      return {
        bidId: bid.id,
        vendorCode: bid.vendorCode,
        vendorName: bid.vendorDisplayName,
        technicalScore: bid.technicalScore,
        bidAmount: bid.totalPrice,
        paymentTerms: bid.paymentTerms,
        warranty: bid.warrantyPricing,
        validityPeriod: bid.validityPeriod,
        valueScore,
        shortlisted: bid.shortlisted
      };
    });
  }

  updateBidValueScore(bidId: string, valueScore: number): void {
    const bids = this.bidsSignal().map(bid => {
      if (bid.id === bidId || bid.bidId === bidId) {
        return {
          ...bid,
          valueScore
        };
      }
      return bid;
    });
    
    this.bidsSignal.set(bids);
    this.saveBids();
  }

  addToShortlist(bidId: string): void {
    const bids = this.bidsSignal().map(bid => {
      if (bid.id === bidId || bid.bidId === bidId) {
        return {
          ...bid,
          shortlisted: true,
          status: 'shortlisted' as const,
          negotiationStatus: 'not_started' as const
        };
      }
      return bid;
    });
    
    this.bidsSignal.set(bids);
    this.saveBids();
    this.toastService.success('Bid added to shortlist');
  }

  removeFromShortlist(bidId: string): void {
    const bids = this.bidsSignal().map(bid => {
      if (bid.id === bidId || bid.bidId === bidId) {
        return {
          ...bid,
          shortlisted: false,
          status: 'under_review' as const
        };
      }
      return bid;
    });
    
    this.bidsSignal.set(bids);
    this.saveBids();
    this.toastService.success('Bid removed from shortlist');
  }

  // ==================== NEGOTIATION ====================
  getShortlistedBids(tenderId: string): EvaluationBid[] {
    return this.getTenderBids(tenderId).filter(b => b.shortlisted);
  }

  addNegotiationNote(bidId: string, noteData: Partial<NegotiationNote>): void {
    const bids = this.bidsSignal().map(bid => {
      if (bid.id === bidId || bid.bidId === bidId) {
        const newNote: NegotiationNote = {
          id: `NOTE-${Date.now()}`,
          bidId,
          text: noteData.text || '',
          negotiatedAmount: noteData.negotiatedAmount,
          channel: noteData.channel || 'platform',
          createdBy: 'Current User',
          createdAt: new Date().toISOString()
        };
        
        return {
          ...bid,
          negotiationNotes: [...(bid.negotiationNotes || []), newNote],
          negotiationStatus: 'in_progress' as const,
          negotiatedAmount: noteData.negotiatedAmount || bid.negotiatedAmount
        };
      }
      return bid;
    });
    
    this.bidsSignal.set(bids);
    this.saveBids();
    this.toastService.success('Negotiation note added');
  }

  // ==================== AWARD ====================
  awardContract(data: AwardData): AwardResult {
    const contractId = `CON-${Date.now()}`;
    
    // Update winning bid
    const bids = this.bidsSignal().map(bid => {
      if (bid.tenderId === data.tenderId) {
        if (bid.id === data.selectedBidId || bid.bidId === data.selectedBidId) {
          return {
            ...bid,
            status: 'awarded' as const,
            negotiationStatus: 'completed' as const
          };
        } else {
          // Mark other bids as rejected
          return {
            ...bid,
            status: 'rejected' as const,
            rejectionReason: 'Contract awarded to another vendor'
          };
        }
      }
      return bid;
    });
    
    this.bidsSignal.set(bids);
    this.saveBids();
    
    // Update tender
    const tenders = this.tendersSignal().map(tender => {
      if (tender.id === data.tenderId || tender.tenderId === data.tenderId) {
        return {
          ...tender,
          evaluationPhase: 'awarded' as EvaluationPhase,
          awardedBidId: data.selectedBidId
        };
      }
      return tender;
    });
    
    this.tendersSignal.set(tenders);
    this.saveTenders();
    
    this.toastService.success('Contract awarded successfully!');
    
    return {
      success: true,
      contractId,
      tenderId: data.tenderId,
      awardedBidId: data.selectedBidId,
      message: 'Contract awarded successfully'
    };
  }

  // ==================== PHASE UPDATES ====================
  private updateTenderPhase(bidId: string): void {
    const bid = this.getBidDetail(bidId);
    if (!bid) return;
    
    const tenderBids = this.getTenderBids(bid.tenderId);
    const allEvaluated = tenderBids.every(b => 
      b.technicalStatus === 'qualified' || b.technicalStatus === 'disqualified'
    );
    
    if (allEvaluated) {
      const hasQualified = tenderBids.some(b => b.technicalStatus === 'qualified');
      
      const tenders = this.tendersSignal().map(tender => {
        if (tender.id === bid.tenderId || tender.tenderId === bid.tenderId) {
          return {
            ...tender,
            evaluationPhase: hasQualified ? 'commercial_review' as EvaluationPhase : 'cancelled' as EvaluationPhase,
            technicalCompliant: tenderBids.filter(b => b.technicalStatus === 'qualified').length,
            technicalRejected: tenderBids.filter(b => b.technicalStatus === 'disqualified').length
          };
        }
        return tender;
      });
      
      this.tendersSignal.set(tenders);
      this.saveTenders();
    }
  }

  startTechnicalEvaluation(tenderId: string): void {
    const tenders = this.tendersSignal().map(tender => {
      if (tender.id === tenderId || tender.tenderId === tenderId) {
        return {
          ...tender,
          evaluationPhase: 'technical_review' as EvaluationPhase
        };
      }
      return tender;
    });
    
    this.tendersSignal.set(tenders);
    this.saveTenders();
  }

  // ==================== MOCK DATA ====================
  private getMockTenders(): LiveTender[] {
    const now = new Date();
    const pastDate = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    const futureDate = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    
    return [
      {
        id: 'tender-eval-1',
        tenderId: 'TND-2024-001',
        title: 'Annual AC Maintenance Contract - Head Office',
        category: 'mid_complexity',
        categoryLabel: 'Mid Complexity',
        publishedAt: pastDate(10),
        bidWindowStart: pastDate(10),
        bidWindowEnd: pastDate(2),
        totalBids: 4,
        technicalCompliant: 0,
        technicalRejected: 0,
        commercialEvaluated: 0,
        shortlistedCount: 0,
        awardedBidId: null,
        evaluationPhase: 'bid_closed',
        requesterName: 'John Smith',
        requesterId: 'user-1',
        budgetEstimate: 250000
      },
      {
        id: 'tender-eval-2',
        tenderId: 'TND-2024-002',
        title: 'Office Renovation - Conference Room',
        category: 'technical',
        categoryLabel: 'Technical',
        publishedAt: pastDate(15),
        bidWindowStart: pastDate(15),
        bidWindowEnd: pastDate(5),
        totalBids: 3,
        technicalCompliant: 2,
        technicalRejected: 1,
        commercialEvaluated: 0,
        shortlistedCount: 0,
        awardedBidId: null,
        evaluationPhase: 'commercial_review',
        requesterName: 'Sarah Johnson',
        requesterId: 'user-2',
        budgetEstimate: 500000
      },
      {
        id: 'tender-eval-3',
        tenderId: 'TND-2024-003',
        title: 'IT Network Infrastructure Upgrade',
        category: 'technical',
        categoryLabel: 'Technical',
        publishedAt: pastDate(5),
        bidWindowStart: pastDate(5),
        bidWindowEnd: futureDate(3),
        totalBids: 2,
        technicalCompliant: 0,
        technicalRejected: 0,
        commercialEvaluated: 0,
        shortlistedCount: 0,
        awardedBidId: null,
        evaluationPhase: 'accepting_bids',
        requesterName: 'Mike Davis',
        requesterId: 'user-3',
        budgetEstimate: 800000
      },
      {
        id: 'tender-eval-4',
        tenderId: 'TND-2024-004',
        title: 'Security Camera Installation',
        category: 'quick_service',
        categoryLabel: 'Quick Service',
        publishedAt: pastDate(20),
        bidWindowStart: pastDate(20),
        bidWindowEnd: pastDate(10),
        totalBids: 5,
        technicalCompliant: 3,
        technicalRejected: 2,
        commercialEvaluated: 3,
        shortlistedCount: 2,
        awardedBidId: null,
        evaluationPhase: 'shortlisted',
        requesterName: 'Emily Chen',
        requesterId: 'user-4',
        budgetEstimate: 150000
      }
    ];
  }

  private getMockBids(): EvaluationBid[] {
    const pastDate = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    return [
      // Bids for tender-eval-1 (bid_closed - ready for technical review)
      {
        id: 'bid-eval-1',
        bidId: 'BID-2024-001',
        tenderId: 'tender-eval-1',
        vendorId: 'vendor-1',
        vendorCode: 'VND-001',
        vendorDisplayName: 'CoolTech HVAC Solutions',
        companyName: 'CoolTech HVAC Solutions Pvt Ltd',
        submittedAt: pastDate(4),
        companyProfile: 'CoolTech HVAC Solutions is a leading provider of air conditioning maintenance and installation services with over 15 years of experience in commercial and industrial HVAC systems.',
        relevantExperience: 'We have successfully completed AMC contracts for over 50 commercial buildings including corporate offices, hospitals, and shopping malls. Our team includes certified HVAC technicians with expertise in all major AC brands.',
        yearsOfExperience: 15,
        similarWorkReferences: [
          { clientName: 'TechPark Ltd', projectType: 'Annual AMC for 200+ units', contactPerson: 'Raj Kumar', phone: '9876543210' },
          { clientName: 'City Hospital', projectType: 'HVAC Maintenance Contract', contactPerson: 'Dr. Sharma', phone: '9876543211' }
        ],
        technicalApproach: 'Our approach includes quarterly preventive maintenance, 24/7 breakdown support, genuine spare parts, and detailed maintenance reports. We use IoT-based monitoring for predictive maintenance.',
        manpowerPlan: '2 dedicated technicians for routine maintenance, 1 supervisor, access to specialized team for complex repairs',
        equipmentPlan: 'Fully equipped service vans, diagnostic tools, refrigerant recovery systems, and standard replacement parts inventory',
        deliveryTimeline: '12 months AMC with response time within 4 hours',
        deviations: '',
        location: 'Kottayam',
        documents: [
          { id: 'doc-1', name: 'Company Brochure', type: 'pdf', size: 2500000, uploaded: true },
          { id: 'doc-2', name: 'Experience Certificates', type: 'pdf', size: 1500000, uploaded: true },
          { id: 'doc-3', name: 'ISO Certification', type: 'pdf', size: 500000, uploaded: true }
        ],
        totalPrice: 180000,
        priceBreakdown: [
          { description: 'Preventive Maintenance (4 visits)', amount: 80000 },
          { description: 'Breakdown Support', amount: 60000 },
          { description: 'Spare Parts Provision', amount: 40000 }
        ],
        taxesAndDuties: 'GST @ 18% extra',
        paymentTerms: '25% advance, 25% quarterly',
        validityPeriod: '90 days',
        warrantyPricing: 'Standard manufacturer warranty applicable',
        amcPricing: 'Included in total price',
        technicalStatus: 'pending',
        commercialStatus: 'sealed',
        shortlisted: false,
        technicalScore: 0,
        technicalNotes: '',
        valueScore: 0,
        negotiationStatus: 'not_started',
        negotiationNotes: [],
        originalBidAmount: 180000,
        negotiatedAmount: null,
        status: 'submitted'
      },
      {
        id: 'bid-eval-2',
        bidId: 'BID-2024-002',
        tenderId: 'tender-eval-1',
        vendorId: 'vendor-2',
        vendorCode: 'VND-002',
        vendorDisplayName: 'Arctic Climate Services',
        companyName: 'Arctic Climate Services India Pvt Ltd',
        submittedAt: pastDate(3),
        companyProfile: 'Arctic Climate Services specializes in commercial HVAC solutions with a focus on energy efficiency and sustainable cooling technologies.',
        relevantExperience: '8 years in commercial AC maintenance, serving 30+ corporate clients across Kerala.',
        yearsOfExperience: 8,
        similarWorkReferences: [
          { clientName: 'InfoPark Kochi', projectType: 'Multi-building AMC', contactPerson: 'Anil Thomas', phone: '9876543212' }
        ],
        technicalApproach: 'Comprehensive maintenance program with bi-monthly visits, energy audits, and performance optimization.',
        manpowerPlan: '3 technicians available on-call basis',
        equipmentPlan: 'Standard service equipment and tools',
        deliveryTimeline: '12 months with 6-hour response time',
        deviations: 'Sunday service available at additional cost',
        location: 'Ernakulam',
        documents: [
          { id: 'doc-4', name: 'Company Profile', type: 'pdf', size: 1800000, uploaded: true },
          { id: 'doc-5', name: 'Client References', type: 'pdf', size: 800000, uploaded: true }
        ],
        totalPrice: 165000,
        priceBreakdown: [
          { description: 'Annual Maintenance Package', amount: 120000 },
          { description: 'Emergency Support', amount: 45000 }
        ],
        taxesAndDuties: 'GST @ 18% extra',
        paymentTerms: '30% advance, balance monthly',
        validityPeriod: '60 days',
        warrantyPricing: 'N/A',
        amcPricing: 'As quoted',
        technicalStatus: 'pending',
        commercialStatus: 'sealed',
        shortlisted: false,
        technicalScore: 0,
        technicalNotes: '',
        valueScore: 0,
        negotiationStatus: 'not_started',
        negotiationNotes: [],
        originalBidAmount: 165000,
        negotiatedAmount: null,
        status: 'submitted'
      },
      {
        id: 'bid-eval-3',
        bidId: 'BID-2024-003',
        tenderId: 'tender-eval-1',
        vendorId: 'vendor-3',
        vendorCode: 'VND-003',
        vendorDisplayName: 'AirCare Pro',
        companyName: 'AirCare Professional Services',
        submittedAt: pastDate(5),
        companyProfile: 'AirCare Pro is a new entrant in HVAC services with fresh perspective and competitive pricing.',
        relevantExperience: '2 years in residential and small commercial AC servicing.',
        yearsOfExperience: 2,
        similarWorkReferences: [],
        technicalApproach: 'Basic maintenance schedule with monthly visits.',
        manpowerPlan: '1 technician',
        equipmentPlan: 'Basic tools',
        deliveryTimeline: '12 months',
        deviations: 'Cannot guarantee 24/7 support',
        location: 'Kottayam',
        documents: [
          { id: 'doc-6', name: 'Company Registration', type: 'pdf', size: 500000, uploaded: true }
        ],
        totalPrice: 120000,
        priceBreakdown: [
          { description: 'Full Year Service', amount: 120000 }
        ],
        taxesAndDuties: 'GST inclusive',
        paymentTerms: '50% advance',
        validityPeriod: '30 days',
        warrantyPricing: 'Not included',
        amcPricing: 'As quoted',
        technicalStatus: 'pending',
        commercialStatus: 'sealed',
        shortlisted: false,
        technicalScore: 0,
        technicalNotes: '',
        valueScore: 0,
        negotiationStatus: 'not_started',
        negotiationNotes: [],
        originalBidAmount: 120000,
        negotiatedAmount: null,
        status: 'submitted'
      },
      {
        id: 'bid-eval-4',
        bidId: 'BID-2024-004',
        tenderId: 'tender-eval-1',
        vendorId: 'vendor-4',
        vendorCode: 'VND-004',
        vendorDisplayName: 'Premium HVAC Corp',
        companyName: 'Premium HVAC Corporation',
        submittedAt: pastDate(3),
        companyProfile: 'Premium HVAC Corp is an ISO certified company providing enterprise-grade HVAC solutions.',
        relevantExperience: '20+ years serving Fortune 500 companies and large industrial facilities.',
        yearsOfExperience: 20,
        similarWorkReferences: [
          { clientName: 'MNC Technologies', projectType: 'Campus-wide HVAC', contactPerson: 'VP Operations', phone: '9876543213' },
          { clientName: 'Grand Hotel Chain', projectType: 'Multi-property AMC', contactPerson: 'Facilities Director', phone: '9876543214' }
        ],
        technicalApproach: 'Enterprise maintenance program with dedicated team, real-time monitoring, predictive analytics, and guaranteed SLA.',
        manpowerPlan: '4 dedicated technicians, 1 project manager, engineering support',
        equipmentPlan: 'State-of-the-art diagnostic equipment, mobile service units, comprehensive spare parts inventory',
        deliveryTimeline: '12 months with 2-hour emergency response',
        deviations: '',
        location: 'Multiple locations',
        documents: [
          { id: 'doc-7', name: 'ISO Certificates', type: 'pdf', size: 3000000, uploaded: true },
          { id: 'doc-8', name: 'Client Testimonials', type: 'pdf', size: 2000000, uploaded: true },
          { id: 'doc-9', name: 'Technical Proposal', type: 'pdf', size: 5000000, uploaded: true }
        ],
        totalPrice: 280000,
        priceBreakdown: [
          { description: 'Preventive Maintenance Premium', amount: 120000 },
          { description: 'Dedicated Support Team', amount: 80000 },
          { description: 'Spare Parts & Materials', amount: 50000 },
          { description: 'Monitoring & Analytics', amount: 30000 }
        ],
        taxesAndDuties: 'GST @ 18% extra',
        paymentTerms: '20% advance, 80% monthly',
        validityPeriod: '120 days',
        warrantyPricing: 'Extended warranty available',
        amcPricing: 'Includes comprehensive coverage',
        technicalStatus: 'pending',
        commercialStatus: 'sealed',
        shortlisted: false,
        technicalScore: 0,
        technicalNotes: '',
        valueScore: 0,
        negotiationStatus: 'not_started',
        negotiationNotes: [],
        originalBidAmount: 280000,
        negotiatedAmount: null,
        status: 'submitted'
      },
      
      // Bids for tender-eval-4 (shortlisted phase)
      {
        id: 'bid-eval-5',
        bidId: 'BID-2024-010',
        tenderId: 'tender-eval-4',
        vendorId: 'vendor-5',
        vendorCode: 'VND-005',
        vendorDisplayName: 'SecureTech Solutions',
        companyName: 'SecureTech Security Solutions Pvt Ltd',
        submittedAt: pastDate(12),
        companyProfile: 'SecureTech is a leading security systems integrator with expertise in CCTV, access control, and surveillance systems.',
        relevantExperience: '12 years in security installations for commercial and residential properties.',
        yearsOfExperience: 12,
        similarWorkReferences: [
          { clientName: 'Bank of Kerala', projectType: '50 Branch CCTV Installation', contactPerson: 'Security Head', phone: '9876543220' }
        ],
        technicalApproach: 'Complete end-to-end security solution with high-definition cameras, cloud storage, and mobile monitoring.',
        manpowerPlan: '5 installation technicians, 2 system engineers',
        equipmentPlan: 'IP cameras, NVRs, cabling, mounting hardware',
        deliveryTimeline: '30 working days',
        deviations: '',
        location: 'Kottayam',
        documents: [
          { id: 'doc-20', name: 'Company Profile', type: 'pdf', size: 2000000, uploaded: true },
          { id: 'doc-21', name: 'Technical Specifications', type: 'pdf', size: 3000000, uploaded: true }
        ],
        totalPrice: 145000,
        priceBreakdown: [
          { description: 'Cameras and Equipment', amount: 80000 },
          { description: 'Installation and Cabling', amount: 40000 },
          { description: 'Configuration and Training', amount: 25000 }
        ],
        taxesAndDuties: 'GST @ 18% extra',
        paymentTerms: '40-50-10',
        validityPeriod: '60 days',
        warrantyPricing: '2 years comprehensive',
        amcPricing: '₹15,000/year after warranty',
        technicalStatus: 'qualified',
        commercialStatus: 'opened',
        shortlisted: true,
        technicalEvaluation: {
          id: 'TECH-001',
          bidId: 'bid-eval-5',
          complianceScore: 85,
          experienceRating: 4,
          technicalApproachRating: 4,
          timelineRating: 5,
          overallScore: 82,
          notes: 'Strong experience in banking sector, good technical approach',
          status: 'submitted',
          evaluatedBy: 'admin',
          evaluatedAt: pastDate(8)
        },
        technicalScore: 82,
        technicalNotes: 'Strong experience in banking sector, good technical approach',
        valueScore: 85,
        negotiationStatus: 'in_progress',
        negotiationNotes: [
          {
            id: 'NOTE-001',
            bidId: 'bid-eval-5',
            text: 'Discussed extended warranty options. Vendor agreed to provide 3-year warranty at no extra cost.',
            channel: 'phone',
            createdBy: 'Admin',
            createdAt: pastDate(5)
          }
        ],
        originalBidAmount: 145000,
        negotiatedAmount: 140000,
        status: 'shortlisted'
      },
      {
        id: 'bid-eval-6',
        bidId: 'BID-2024-011',
        tenderId: 'tender-eval-4',
        vendorId: 'vendor-6',
        vendorCode: 'VND-006',
        vendorDisplayName: 'WatchGuard Systems',
        companyName: 'WatchGuard Security Systems',
        submittedAt: pastDate(11),
        companyProfile: 'WatchGuard specializes in advanced surveillance and monitoring systems for enterprise clients.',
        relevantExperience: '8 years in security infrastructure.',
        yearsOfExperience: 8,
        similarWorkReferences: [
          { clientName: 'IT Park Trivandrum', projectType: 'Campus Security', contactPerson: 'Facilities Manager', phone: '9876543221' }
        ],
        technicalApproach: 'Modern IP-based surveillance with AI-powered analytics.',
        manpowerPlan: '3 technicians',
        equipmentPlan: 'Premium brand cameras and NVR',
        deliveryTimeline: '25 working days',
        deviations: '',
        location: 'Trivandrum',
        documents: [
          { id: 'doc-22', name: 'Technical Proposal', type: 'pdf', size: 2500000, uploaded: true }
        ],
        totalPrice: 160000,
        priceBreakdown: [
          { description: 'Equipment', amount: 100000 },
          { description: 'Installation', amount: 45000 },
          { description: 'Training', amount: 15000 }
        ],
        taxesAndDuties: 'GST @ 18% extra',
        paymentTerms: '30-60-10',
        validityPeriod: '90 days',
        warrantyPricing: '3 years',
        amcPricing: '₹20,000/year',
        technicalStatus: 'qualified',
        commercialStatus: 'opened',
        shortlisted: true,
        technicalEvaluation: {
          id: 'TECH-002',
          bidId: 'bid-eval-6',
          complianceScore: 80,
          experienceRating: 4,
          technicalApproachRating: 5,
          timelineRating: 4,
          overallScore: 78,
          notes: 'Excellent technical approach with AI features',
          status: 'submitted',
          evaluatedBy: 'admin',
          evaluatedAt: pastDate(7)
        },
        technicalScore: 78,
        technicalNotes: 'Excellent technical approach with AI features',
        valueScore: 75,
        negotiationStatus: 'in_progress',
        negotiationNotes: [
          {
            id: 'NOTE-002',
            bidId: 'bid-eval-6',
            text: 'Discussed pricing. Vendor offered 5% discount.',
            channel: 'email',
            createdBy: 'Admin',
            createdAt: pastDate(4)
          }
        ],
        originalBidAmount: 160000,
        negotiatedAmount: 152000,
        status: 'shortlisted'
      }
    ];
  }
}
