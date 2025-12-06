import { Component } from '@angular/core';
import { Value, Stat } from './about.model';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [],
  templateUrl: './about.page.html',
  styleUrl: './about.page.scss'
})
export class AboutPageComponent {
  readonly values: Value[] = [
    {
      icon: 'target',
      title: 'Our Mission',
      description:
        'To bridge the gap between talented professionals and leading organizations, creating meaningful employment opportunities that drive success for both parties.',
    },
    {
      icon: 'eye',
      title: 'Our Vision',
      description:
        'To become the most trusted and preferred manpower solutions provider, recognized for our commitment to excellence and integrity in service delivery.',
    },
    {
      icon: 'award',
      title: 'Our Values',
      description:
        'Integrity, professionalism, and dedication to quality. We believe in building lasting relationships based on trust and mutual success.',
    },
    {
      icon: 'users',
      title: 'Our Team',
      description:
        'A dedicated team of professionals committed to understanding your needs and delivering personalized manpower solutions that exceed expectations.',
    },
  ];

  readonly stats: Stat[] = [
    { number: '10,000+', label: 'Jobs Placed' },
    { number: '500+', label: 'Partner Companies' },
    { number: '15+', label: 'Years Experience' },
    { number: '98%', label: 'Client Satisfaction' },
  ];

  readonly employerBenefits: string[] = [
    'Access to a vast pool of pre-screened, qualified candidates',
    'Customized recruitment solutions tailored to your needs',
    'Efficient hiring process with reduced time-to-hire',
    'Post-placement support and candidate management',
    'Industry-specific expertise across multiple domains',
  ];

  readonly jobSeekerBenefits: string[] = [
    'Wide range of job opportunities across various industries',
    'Career guidance and professional development support',
    'Connections with reputable and verified employers',
    'Transparent job descriptions and clear expectations',
    'Ongoing support throughout your career journey',
  ];
}
