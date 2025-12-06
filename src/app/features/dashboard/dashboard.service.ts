import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Job, JobFormData, DEFAULT_JOBS } from './dashboard.model';

const JOBS_KEY = 'heavenly_jobs';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly jobsSignal = signal<Job[]>([]);

  readonly jobs = this.jobsSignal.asReadonly();

  constructor() {
    this.loadJobsFromStorage();
  }

  private loadJobsFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.jobsSignal.set(DEFAULT_JOBS);
      return;
    }

    const savedJobs = localStorage.getItem(JOBS_KEY);
    if (savedJobs) {
      this.jobsSignal.set(JSON.parse(savedJobs));
    } else {
      this.jobsSignal.set(DEFAULT_JOBS);
      this.saveJobsToStorage(DEFAULT_JOBS);
    }
  }

  private saveJobsToStorage(jobs: Job[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  }

  addJob(formData: JobFormData, userId: string): void {
    const newJob: Job = {
      ...formData,
      id: Date.now().toString(),
      postedDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      postedBy: userId,
    };
    
    const updatedJobs = [newJob, ...this.jobsSignal()];
    this.jobsSignal.set(updatedJobs);
    this.saveJobsToStorage(updatedJobs);
  }

  getApprovedJobs(): Job[] {
    return this.jobsSignal().filter(job => job.status === 'approved');
  }

  getUserJobs(userId: string): Job[] {
    return this.jobsSignal().filter(job => job.postedBy === userId);
  }
}
