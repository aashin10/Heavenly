import { ServiceCategory, RequestStatus } from '../../../core/models/service.model';

// Quick action item
export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  description: string;
  route: string;
  color: string;
}

// Request summary for dashboard cards
export interface RequestSummary {
  id: string;
  title: string;
  category: ServiceCategory;
  status: RequestStatus;
  createdAt: Date;
  dueDate?: Date;
  bidCount?: number;
}

// Draft request
export interface DraftRequest {
  id: string;
  title: string;
  category: ServiceCategory;
  lastModified: Date;
  expiresAt: Date;
  completionPercent: number;
}

// Dashboard stats
export interface DashboardStats {
  totalRequests: number;
  activeRequests: number;
  pendingReview: number;
  completedRequests: number;
  draftsCount: number;
  activeTenders: number;
}

// Quick actions for service requester
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-request',
    label: 'New Request',
    icon: 'file-plus',
    description: 'Create a new service request',
    route: '/services',
    color: 'primary',
  },
  {
    id: 'view-tenders',
    label: 'Active Tenders',
    icon: 'clipboard-list',
    description: 'View your active tender opportunities',
    route: '/my-requests?filter=live',
    color: 'success',
  },
  {
    id: 'drafts',
    label: 'Draft Requests',
    icon: 'file-text',
    description: 'Continue working on saved drafts',
    route: '/my-requests?tab=drafts',
    color: 'warning',
  },
  {
    id: 'history',
    label: 'Request History',
    icon: 'clock',
    description: 'View past requests and their status',
    route: '/my-requests',
    color: 'neutral',
  },
];
