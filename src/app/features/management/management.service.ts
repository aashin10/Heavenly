import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Job, JobStatus, JobFilter, JobStatistics } from './management.model';
import { ToastService } from '../../core/services/toast.service';

const JOBS_KEY = 'heavenly_jobs';

const DEFAULT_JOBS: Job[] = [
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
    postedDate: '2025-11-15',
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
    postedDate: '2025-11-18',
    status: 'approved',
    postedBy: 'demo',
  },
  {
    id: '3',
    title: 'HR Specialist',
    company: 'PeopleFirst Services',
    domain: 'Human Resources',
    location: 'Noida, UP',
    type: 'Full-time',
    salary: '₹5,00,000 - ₹7,50,000',
    description: 'Handle recruitment, employee relations, and HR administrative duties.',
    requirements: "Bachelor's degree in HR or related field, 3+ years HR experience",
    postedDate: '2025-11-22',
    status: 'pending',
    postedBy: 'demo',
  }
];

@Injectable({
  providedIn: 'root'
})
export class ManagementService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastService = inject(ToastService);
  
  private readonly jobsSignal = signal<Job[]>([]);
  private readonly filterSignal = signal<JobFilter>('pending');

  readonly jobs = this.jobsSignal.asReadonly();
  readonly filter = this.filterSignal.asReadonly();

  readonly filteredJobs = computed(() => {
    const currentFilter = this.filterSignal();
    const allJobs = this.jobsSignal();
    
    if (currentFilter === 'all') {
      return allJobs;
    }
    return allJobs.filter(job => job.status === currentFilter);
  });

  readonly statistics = computed<JobStatistics>(() => {
    const allJobs = this.jobsSignal();
    return {
      total: allJobs.length,
      pending: allJobs.filter(j => j.status === 'pending').length,
      approved: allJobs.filter(j => j.status === 'approved').length,
      rejected: allJobs.filter(j => j.status === 'rejected').length
    };
  });

  constructor() {
    this.loadJobs();
  }

  loadJobs(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const savedJobs = localStorage.getItem(JOBS_KEY);
    if (savedJobs) {
      try {
        const parsedJobs = JSON.parse(savedJobs) as Job[];
        this.jobsSignal.set(parsedJobs);
      } catch (error) {
        console.error('Failed to parse jobs from localStorage, using defaults:', error);
        this.jobsSignal.set(DEFAULT_JOBS);
        this.saveJobs();
      }
    } else {
      this.jobsSignal.set(DEFAULT_JOBS);
      this.saveJobs();
    }
  }

  setFilter(filter: JobFilter): void {
    this.filterSignal.set(filter);
  }

  updateJobStatus(jobId: string, status: JobStatus): void {
    const updatedJobs = this.jobsSignal().map(job =>
      job.id === jobId ? { ...job, status } : job
    );
    this.jobsSignal.set(updatedJobs);
    this.saveJobs();

    switch (status) {
      case 'approved':
        this.toastService.success('Job has been approved and is now visible to job seekers!');
        break;
      case 'rejected':
        this.toastService.error('Job has been rejected.');
        break;
      case 'pending':
        this.toastService.info('Job status has been set to pending for review.');
        break;
    }
  }

  private saveJobs(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    localStorage.setItem(JOBS_KEY, JSON.stringify(this.jobsSignal()));
  }
}
