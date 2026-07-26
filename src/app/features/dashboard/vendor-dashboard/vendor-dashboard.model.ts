import { ServiceCategory } from '../../../core/models/service.model';

// Tender opportunity
export interface TenderOpportunity {
  id: string;
  title: string;
  category: ServiceCategory;
  location: string;
  budget?: { min: number; max: number };
  deadline: Date;
  bidCount: number;
  postedAt: Date;
  isUrgent?: boolean;
}

// Vendor bid
export interface VendorBid {
  id: string;
  tenderId: string;
  tenderTitle: string;
  category: ServiceCategory;
  bidAmount: number;
  status: 'pending' | 'under-review' | 'accepted' | 'rejected';
  submittedAt: Date;
}

// Vendor dashboard stats
// NOTE: profile completion is derived from the profile section checklist on the
// dashboard component, not stored here — keeping it as a stat let the ring and
// the "X of Y sections complete" caption drift apart.
export interface VendorDashboardStats {
  openTenders: number;
  myBids: number;
  wonBids: number;
  activeProjects: number;
  rating?: number;
}

// Profile-section state now lives in
// shared/utils/vendor-profile-completion.util.ts, derived from the vendor
// record — the old static PROFILE_SECTIONS list here was hard-coded
// isComplete:false, so the dashboard ring could never move.
