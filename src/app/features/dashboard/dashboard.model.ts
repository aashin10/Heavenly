export type JobStatus = 'pending' | 'approved' | 'rejected';

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

export interface JobFormData {
  title: string;
  company: string;
  domain: string;
  location: string;
  type: string;
  salary: string;
  description: string;
  requirements: string;
}

export const DOMAINS = ['IT', 'Hospitality', 'HR', 'Masonry', 'Plumbing', 'Servicing Staff'] as const;
export const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'] as const;
export const DOMAIN_OPTIONS = ['All', ...DOMAINS] as const;
export const JOB_TYPE_OPTIONS = ['All', ...JOB_TYPES] as const;

export const INITIAL_JOB_FORM: JobFormData = {
  title: '',
  company: '',
  domain: DOMAINS[0],
  location: '',
  type: JOB_TYPES[0],
  salary: '',
  description: '',
  requirements: '',
};

export const DEFAULT_JOBS: Job[] = [
  {
    id: '1',
    title: 'Senior Software Engineer',
    company: 'Tech Solutions Pvt. Ltd.',
    domain: 'IT',
    location: 'New Delhi, DL',
    type: 'Full-time',
    salary: '₹18,00,000 - ₹24,00,000',
    description: 'We are seeking an experienced Senior Software Engineer to join our dynamic team.',
    requirements: "Bachelor's degree in Computer Science, 5+ years of experience in full-stack development",
    postedDate: '2025-12-01',
    status: 'approved',
    postedBy: 'demo',
  },
  {
    id: '2',
    title: 'Hotel Manager',
    company: 'Grand Luxury Hotels',
    domain: 'Hospitality',
    location: 'Gurugram, HR',
    type: 'Full-time',
    salary: '₹8,00,000 - ₹12,00,000',
    description: 'Manage daily operations of our 5-star hotel facility.',
    requirements: 'Hospitality degree, 7+ years management experience in luxury hotels',
    postedDate: '2025-12-02',
    status: 'approved',
    postedBy: 'demo',
  },
  {
    id: '3',
    title: 'HR Specialist',
    company: 'Corporate Services India',
    domain: 'HR',
    location: 'Noida, UP',
    type: 'Full-time',
    salary: '₹5,00,000 - ₹7,50,000',
    description: 'Handle recruitment, employee relations, and HR compliance.',
    requirements: 'HR certification, 3+ years of HR experience',
    postedDate: '2025-12-03',
    status: 'approved',
    postedBy: 'demo',
  },
  {
    id: '4',
    title: 'Master Mason',
    company: 'BuildRight Construction',
    domain: 'Masonry',
    location: 'Faridabad, HR',
    type: 'Contract',
    salary: '₹3,60,000 - ₹5,40,000',
    description: 'Experienced mason needed for commercial construction projects.',
    requirements: '5+ years masonry experience, ability to read blueprints',
    postedDate: '2025-12-04',
    status: 'approved',
    postedBy: 'demo',
  },
  {
    id: '5',
    title: 'Licensed Plumber',
    company: 'Metro Plumbing Services',
    domain: 'Plumbing',
    location: 'Ghaziabad, UP',
    type: 'Full-time',
    salary: '₹4,20,000 - ₹6,00,000',
    description: 'Residential and commercial plumbing installation and repair.',
    requirements: 'State plumbing license, 3+ years experience',
    postedDate: '2025-12-05',
    status: 'approved',
    postedBy: 'demo',
  },
  {
    id: '6',
    title: 'Housekeeping Supervisor',
    company: 'Premium Facilities Management',
    domain: 'Servicing Staff',
    location: 'New Delhi, DL',
    type: 'Full-time',
    salary: '₹2,40,000 - ₹3,60,000',
    description: 'Supervise housekeeping staff in commercial facilities.',
    requirements: '2+ years supervisory experience in housekeeping',
    postedDate: '2025-12-06',
    status: 'approved',
    postedBy: 'demo',
  },
];
