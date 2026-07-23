import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CareerDomain, HiringStep } from './careers.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-careers-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './careers.page.html',
  styleUrl: './careers.page.scss'
})
export class CareersPageComponent {
  readonly steps: HiringStep[] = [
    {
      icon: 'file-text',
      step: '01',
      title: 'Share your profile',
      description:
        'Create an account and tell us about your trade, experience and preferred locations. It takes a few minutes.',
    },
    {
      icon: 'search',
      step: '02',
      title: 'We match you to openings',
      description:
        'When a client raises a requirement, we shortlist candidates whose skills and experience fit the role.',
    },
    {
      icon: 'users',
      step: '03',
      title: 'Interview with our team',
      description:
        'We screen and interview you ourselves, so you know exactly what the role and the employer expect.',
    },
    {
      icon: 'handshake',
      step: '04',
      title: 'We present you to the employer',
      description:
        'We introduce you to the client’s HR team and support you through their process and onboarding.',
    },
  ];

  readonly domains: CareerDomain[] = [
    { icon: 'monitor', name: 'IT', roles: 'Support, development, infrastructure' },
    { icon: 'utensils', name: 'Hospitality', roles: 'Waiters, stewards, kitchen & front-of-house' },
    { icon: 'users', name: 'HR & Admin', roles: 'Coordinators, recruiters, office staff' },
    { icon: 'brick-wall', name: 'Masonry', roles: 'Masons, brickwork, structural crews' },
    { icon: 'wrench', name: 'Plumbing', roles: 'Plumbers, pipefitters, maintenance' },
    { icon: 'hard-hat', name: 'Servicing Staff', roles: 'AC, electrical & appliance technicians' },
  ];

  readonly benefits: string[] = [
    'Openings with verified, reputable employers',
    'Transparent job descriptions and clear expectations',
    'A real interview with our team — not just a CV forward',
    'Support through onboarding and after placement',
    'Opportunities across multiple industries and locations',
  ];
}
