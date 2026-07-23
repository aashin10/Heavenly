import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

interface FooterLink {
  label: string;
  path: string;
  fragment?: string;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, LogoComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly year = new Date().getFullYear();

  readonly services: FooterLink[] = [
    { label: 'Manpower Supply', path: '/services' },
    { label: 'Transformer Rewinding', path: '/services', fragment: 'transformer-rewinding' },
    { label: 'AC & Appliance Servicing', path: '/services', fragment: 'ac-servicing' },
    { label: 'Fabrication', path: '/services', fragment: 'fabrication' },
    { label: 'CCTV & Fire Systems', path: '/services', fragment: 'cctv-fire' },
    { label: 'All Services', path: '/services' },
  ];

  readonly company: FooterLink[] = [
    { label: 'Home', path: '/' },
    { label: 'About Us', path: '/about' },
    { label: 'Careers', path: '/careers' },
    { label: 'Contact', path: '/contact' },
    { label: 'Become a Vendor', path: '/vendor-signup' },
  ];
}
