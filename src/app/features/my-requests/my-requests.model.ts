import { RequestStatus } from '../../core/services/service-request.service';

/**
 * Status filter groups for the My Requests list. Individual statuses are shown
 * per-card by the badge; these pills group them into the buckets a requester
 * actually thinks in. This is where the old dead `/my-tenders` and
 * `/request-history` routes now live — as filters, not separate pages.
 */
export interface RequestFilter {
  id: string;
  label: string;
  statuses: RequestStatus[] | 'all';
}

export const REQUEST_FILTERS: RequestFilter[] = [
  { id: 'all', label: 'All', statuses: 'all' },
  { id: 'in-review', label: 'In Review', statuses: ['submitted', 'under_review'] },
  { id: 'changes', label: 'Changes Needed', statuses: ['changes_required'] },
  { id: 'approved', label: 'Approved', statuses: ['approved'] },
  { id: 'live', label: 'Live Tenders', statuses: ['published'] },
  { id: 'closed', label: 'Closed', statuses: ['closed', 'cancelled'] },
];
