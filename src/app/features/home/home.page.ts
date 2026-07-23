import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AudiencePath, BusinessStream, Domain, Feature, ServiceIcon, TrustPoint } from './home.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss'
})
export class HomePageComponent {
  /** Primary entry points — one per audience. */
  readonly audiencePaths: AudiencePath[] = [
    {
      icon: 'briefcase',
      title: 'Hire Manpower',
      description: 'Need waiters, technicians, or skilled staff? We interview and supply verified candidates.',
      cta: 'Request staff',
      link: '/login',
      queryParams: { mode: 'signup', role: 'employer' },
    },
    {
      icon: 'user-search',
      title: 'Find Work',
      description: 'Explore openings across IT, hospitality, HR, plumbing, masonry and more.',
      cta: 'Explore careers',
      link: '/careers',
    },
    {
      icon: 'wrench',
      title: 'Request a Service',
      description: 'From AC servicing to fabrication — submit a request and receive competitive tenders.',
      cta: 'Browse services',
      link: '/services',
    },
    {
      icon: 'handshake',
      title: 'Become a Vendor',
      description: 'Register your business to bid on tenders and grow with Heavenly Corporation.',
      cta: 'Register as vendor',
      link: '/vendor-signup',
    },
  ];

  /** Lines of business — extend this array to introduce a new stream. */
  readonly businessStreams: BusinessStream[] = [
    {
      icon: 'users',
      title: 'Manpower Supply',
      description:
        'Recruitment and staffing across IT, hospitality, HR, and skilled trades. We source, interview and present candidates matched to your requirements.',
      link: '/contact',
    },
    {
      icon: 'cable',
      title: 'Transformer Rewinding',
      description:
        'Specialist transformer rewinding and repair contracts, delivered to agreed quality standards and timelines through our vetted partner network.',
      link: '/services',
      fragment: 'transformer-rewinding',
    },
    {
      icon: 'hard-hat',
      title: 'Technical Services & Contracting',
      description:
        'AC and appliance servicing, electrical, fabrication, CCTV & fire, interiors and more — request a job and hire verified vendors.',
      link: '/services',
    },
  ];

  /** Credibility strip — kept to defensible, non-fabricated claims. */
  readonly trustPoints: TrustPoint[] = [
    { icon: 'layers', label: '3 core', sublabel: 'Service streams' },
    { icon: 'shield-check', label: 'Verified', sublabel: 'Vendor network' },
    { icon: 'map-pin', label: 'Delhi NCR', sublabel: '& pan-India reach' },
    { icon: 'clock', label: 'On-time', sublabel: 'Delivery focus' },
  ];

  readonly domains: Domain[] = [
    { name: 'IT', icon: 'monitor' },
    { name: 'Hospitality', icon: 'utensils' },
    { name: 'HR', icon: 'users' },
    { name: 'Masonry', icon: 'brick-wall' },
    { name: 'Plumbing', icon: 'wrench' },
    { name: 'Servicing Staff', icon: 'hard-hat' },
  ];

  readonly features: Feature[] = [
    {
      icon: 'briefcase',
      title: 'Quality Manpower',
      description: 'Access to skilled professionals across multiple domains',
    },
    {
      icon: 'users',
      title: 'Trusted by Employers',
      description: 'Connecting top talent with leading organizations',
    },
    {
      icon: 'search',
      title: 'Easy Job Search',
      description: 'Find opportunities that match your skills and expertise',
    },
    {
      icon: 'trending-up',
      title: 'Career Growth',
      description: 'Opportunities for professional development and advancement',
    },
    {
      icon: 'shield',
      title: 'Verified Employers',
      description: 'Work with authenticated and reliable companies',
    },
    {
      icon: 'globe',
      title: 'Global Reach',
      description: 'Opportunities across various locations and industries',
    },
  ];

  readonly serviceIcons: ServiceIcon[] = [
    { id: 'ac-servicing', name: 'AC/Appliance Servicing', icon: 'air-vent' },
    { id: 'interior-finishing', name: 'Interior & Finishing', icon: 'house' },
    { id: 'paint-polish', name: 'Paint & Polish', icon: 'paintbrush' },
    { id: 'electrical-materials', name: 'Electrical Materials', icon: 'zap' },
    { id: 'fabrication', name: 'Fabrication', icon: 'factory' },
    { id: 'cctv-fire', name: 'CCTV & Fire', icon: 'cctv' },
    { id: 'office-furniture', name: 'Furniture Supply', icon: 'armchair' },
    { id: 'transformer-rewinding', name: 'Transformer Rewinding', icon: 'cable' },
  ];
}
