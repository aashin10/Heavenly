export interface Job {
  id: string;
  title: string;
  company: string;
  domain: string;
  location: string;
  type: string;
  salary: string;
  description: string;
  requirements: string;
  postedDate: string;
  status: JobStatus;
  postedBy: string;
}

export type JobStatus = 'pending' | 'approved' | 'rejected';

export type JobFilter = 'all' | 'pending' | 'approved' | 'rejected';

export interface JobStatistics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}
