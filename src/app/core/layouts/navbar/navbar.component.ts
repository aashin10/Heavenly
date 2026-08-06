import { Component, inject, signal, computed, HostListener, ElementRef, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ServiceAuthService } from '../../services/service-auth.service';
import { ToastService } from '../../services/toast.service';
import { ToasterComponent } from '../toaster/toaster.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

interface NavLink {
  path: string;
  label: string;
}

/**
 * A single, normalised view of "who is signed in" for the navbar.
 *
 * The app currently has two independent auth stores (jobs portal and services
 * portal). Until they are unified, the navbar presents exactly one identity so
 * the user never sees two conflicting sessions at once.
 */
interface SessionView {
  name: string;
  email: string;
  initials: string;
  roleLabel: string;
  dashboardLink: string;
  roleLinks: NavLink[];
  /**
   * Role-appropriate profile destination: /profile (jobs users),
   * /vendor-profile (vendors), /service-requester-profile (requesters).
   * Nullable for any future role without a profile page — no link beats a dead one.
   */
  profileLink: string | null;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ToasterComponent, LogoComponent, IconComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  @ViewChild('profileDropdown') profileDropdown!: ElementRef;

  isMenuOpen = signal(false);
  isProfileOpen = signal(false);

  readonly publicLinks: NavLink[] = [
    { path: '/', label: 'Home' },
    { path: '/services', label: 'Services' },
    { path: '/careers', label: 'Careers' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
  ];

  /**
   * The one identity shown in the navbar. A services-portal session takes
   * precedence, since those flows (vendor / requester) are the ones that land
   * users on role-specific dashboards.
   */
  readonly session = computed<SessionView | null>(() => {
    const serviceUser = this.serviceAuthService.currentUser();

    if (serviceUser) {
      const isVendor = serviceUser.userType === 'vendor';
      return {
        name: serviceUser.displayName,
        email: serviceUser.email,
        initials: this.authService.getInitials(serviceUser.displayName),
        roleLabel: isVendor ? 'Vendor' : 'Service Requester',
        dashboardLink: isVendor ? '/vendor-dashboard' : '/service-requester-dashboard',
        roleLinks: isVendor
          ? [
              { path: '/vendor/tenders', label: 'Browse Tenders' },
              { path: '/vendor/bids', label: 'My Bids' },
            ]
          : [{ path: '/services', label: 'Request a Service' }],
        profileLink: isVendor ? '/vendor-profile' : '/service-requester-profile',
      };
    }

    const jobsUser = this.authService.user();
    if (!jobsUser) return null;

    const roleLabels: Record<string, string> = {
      admin: 'Administrator',
      employer: 'Employer',
      applicant: 'Job Seeker',
    };

    return {
      name: jobsUser.name,
      email: jobsUser.email,
      initials: this.authService.getInitials(jobsUser.name),
      roleLabel: roleLabels[jobsUser.userType] ?? 'Member',
      dashboardLink: '/dashboard',
      // Reads the guard's own isAdmin() rather than re-deriving it from
      // userType — two independent checks answering the same question is
      // exactly how a ServiceAdmin ended up unable to see this link at all
      // (F16). One source of truth for "can this session open /management".
      roleLinks: this.authService.isAdmin()
        ? [{ path: '/management', label: 'Management' }]
        : [],
      profileLink: '/profile',
    };
  });

  /**
   * Public links plus the active role's dashboard and any role-specific
   * destinations. Role links are surfaced in the top-level nav (not buried in
   * the avatar dropdown) so admins/vendors always have their workspace to hand.
   */
  readonly allLinks = computed<NavLink[]>(() => {
    const current = this.session();
    if (!current) return [...this.publicLinks];

    return [
      ...this.publicLinks,
      { path: current.dashboardLink, label: 'Dashboard' },
      ...current.roleLinks,
    ];
  });

  toggleMenu(): void {
    this.isMenuOpen.update(v => !v);
  }

  toggleProfile(): void {
    this.isProfileOpen.update(v => !v);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  closeProfile(): void {
    this.isProfileOpen.set(false);
  }

  handleLogout(): void {
    // Clear both stores so no stale parallel session is left behind.
    this.authService.logout();
    this.serviceAuthService.logout();
    this.isMenuOpen.set(false);
    this.isProfileOpen.set(false);
    this.toastService.info('Logged out successfully');
    // Leave the (now inaccessible) page rather than showing its broken shell.
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.profileDropdown && !this.profileDropdown.nativeElement.contains(target)) {
      this.isProfileOpen.set(false);
    }
  }
}
