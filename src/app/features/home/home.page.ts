import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Domain, Feature, ServiceIcon } from './home.model';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss'
})
export class HomePageComponent {
  readonly domains: Domain[] = [
    { name: 'IT', icon: '💻' },
    { name: 'Hospitality', icon: '🏨' },
    { name: 'HR', icon: '👥' },
    { name: 'Masonry', icon: '🧱' },
    { name: 'Plumbing', icon: '🔧' },
    { name: 'Servicing Staff', icon: '🛎️' },
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
    { id: 'ac-servicing', name: 'AC/Appliance Servicing', icon: '❄️' },
    { id: 'interior-finishing', name: 'Interior & Finishing', icon: '🏠' },
    { id: 'paint-polish', name: 'Paint & Polish', icon: '🎨' },
    { id: 'electrical-materials', name: 'Electrical Materials', icon: '💡' },
    { id: 'fabrication', name: 'Fabrication', icon: '⚙️' },
    { id: 'cctv-fire', name: 'CCTV & Fire', icon: '📹' },
    { id: 'office-furniture', name: 'Furniture Supply', icon: '🪑' },
    { id: 'transformer-rewinding', name: 'Transformer Rewinding', icon: '⚡' },
  ];
}
