import { ServiceCategory } from '../../../core/models/service.model';
import { BidStatus } from '../../vendor/vendor.model';

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
  // Canonical BidStatus, matching BidStatus.cs. This was an inline union with
  // hyphens and two values the domain has never had (`pending`, `accepted`),
  // which Slice 4 would have had to translate at the API boundary — exactly
  // the translation layer the wire-format conventions exist to avoid.
  status: BidStatus;
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
