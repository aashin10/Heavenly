import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { Vendor } from '../../../core/models/service.model';

@Component({
  selector: 'app-verification-pending-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './verification-pending.page.html',
  styleUrl: './verification-pending.page.scss',
})
export class VerificationPendingPageComponent implements OnInit {
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly router = inject(Router);

  currentUser = signal<Vendor | null>(null);
  submittedDate = signal<string>('');

  ngOnInit(): void {
    this.loadUserData();
  }

  private loadUserData(): void {
    const session = this.serviceAuthService.getCurrentUserSession();
    
    if (session?.userType !== 'vendor') {
      this.router.navigate(['/login']);
      return;
    }

    const vendor = this.serviceAuthService.getCurrentUser() as Vendor;
    
    if (!vendor) {
      this.router.navigate(['/login']);
      return;
    }

    // If already verified, redirect to dashboard
    if (vendor.verificationStatus === 'verified') {
      this.router.navigate(['/vendor-dashboard']);
      return;
    }

    this.currentUser.set(vendor);
    
    // Format the submitted date
    if (vendor.createdAt) {
      this.submittedDate.set(new Date(vendor.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }));
    }
  }

  logout(): void {
    this.serviceAuthService.logout();
    this.router.navigate(['/login']);
  }

  refreshStatus(): void {
    // Reload user data to check if verification status changed
    this.loadUserData();
  }
}
