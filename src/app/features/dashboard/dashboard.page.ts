import { Component, inject, signal, computed } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { EmployerPageComponent } from './pages/employer/employer.page';
import { JobSeekerPageComponent } from './pages/job-seeker/job-seeker.page';
import { IconComponent } from '../../shared/components/icon/icon.component';

type DashboardTab = 'employer' | 'jobseeker';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [EmployerPageComponent, JobSeekerPageComponent, IconComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class DashboardPageComponent {
  private readonly authService = inject(AuthService);

  readonly user = this.authService.user;
  
  readonly activeTab = signal<DashboardTab>(
    this.user()?.userType === 'employer' ? 'employer' : 'jobseeker'
  );

  readonly isAdmin = computed(() => this.user()?.userType === 'admin');
  readonly showEmployerDashboard = computed(() => this.user()?.userType === 'employer');
  readonly showJobSeekerDashboard = computed(() => 
    this.user()?.userType === 'applicant' || this.user()?.userType === 'admin'
  );

  readonly headerSubtitle = computed(() => {
    const userType = this.user()?.userType;
    if (userType === 'employer') {
      return 'Post and manage job opportunities';
    }
    if (userType === 'admin') {
      return 'Browse job opportunities or manage the platform';
    }
    return 'Find and apply for job opportunities';
  });

  setActiveTab(tab: DashboardTab): void {
    this.activeTab.set(tab);
  }
}
