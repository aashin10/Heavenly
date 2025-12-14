import { Component, inject, signal, HostListener, ElementRef, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ToasterComponent } from '../toaster/toaster.component';

interface NavLink {
  path: string;
  label: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ToasterComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  @ViewChild('profileDropdown') profileDropdown!: ElementRef;

  isMenuOpen = signal(false);
  isProfileOpen = signal(false);

  readonly user = this.authService.user;
  readonly isAdmin = this.authService.isAdmin;

  readonly publicLinks: NavLink[] = [
    { path: '/', label: 'Home' },
    { path: '/services', label: 'Services' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
  ];

  get allLinks(): NavLink[] {
    const protectedLinks = this.user() ? [{ path: '/dashboard', label: 'Dashboard' }] : [];
    return [...this.publicLinks, ...protectedLinks];
  }

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
    this.authService.logout();
    this.isMenuOpen.set(false);
    this.isProfileOpen.set(false);
    this.toastService.info('Logged out successfully');
  }

  getInitials(name: string): string {
    return this.authService.getInitials(name);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.profileDropdown && !this.profileDropdown.nativeElement.contains(target)) {
      this.isProfileOpen.set(false);
    }
  }
}
