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
export interface VendorDashboardStats {
  openTenders: number;
  myBids: number;
  wonBids: number;
  activeProjects: number;
  profileCompletion: number;
  rating?: number;
}

// Profile section for completion tracking
export interface ProfileSection {
  id: string;
  label: string;
  isComplete: boolean;
  route: string;
}

// Profile sections for vendors
export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    id: 'basic',
    label: 'Basic Information',
    isComplete: false,
    route: '/vendor-profile/basic',
  },
  {
    id: 'documents',
    label: 'Business Documents',
    isComplete: false,
    route: '/vendor-profile/documents',
  },
  {
    id: 'services',
    label: 'Services Offered',
    isComplete: false,
    route: '/vendor-profile/services',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    isComplete: false,
    route: '/vendor-profile/portfolio',
  },
  {
    id: 'bank',
    label: 'Bank Details',
    isComplete: false,
    route: '/vendor-profile/bank',
  },
];
