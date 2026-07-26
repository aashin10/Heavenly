import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AboutStream, Value, Stat } from './about.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './about.page.html',
  styleUrl: './about.page.scss'
})
export class AboutPageComponent {
  readonly streams: AboutStream[] = [
    {
      icon: 'users',
      title: 'Manpower Supply',
      description:
        'When a client needs staff — say a hotel that needs waiters — we put out the call, interview candidates, and present the best-matched people to their HR team. We cover IT, hospitality, HR, masonry, plumbing and servicing staff.',
    },
    {
      icon: 'cable',
      title: 'Transformer Rewinding',
      description:
        'We take on transformer rewinding contracts and deliver them through a vetted network of specialists, managing the work end to end so clients get quality output on agreed timelines.',
    },
    {
      icon: 'hard-hat',
      title: 'Technical Services',
      description:
        'For AC, plumbing, masonry, electrical, fabrication and allied work, we connect clients with verified technicians and vendors — through a transparent request-and-tender process.',
    },
  ];

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

  // Defensible, non-fabricated facts. Replace with verified figures
  // (years in operation, projects delivered) when available.
  readonly stats: Stat[] = [
    { number: '3', label: 'Core service streams' },
    { number: '15+', label: 'Service categories' },
    { number: 'Delhi NCR', label: 'Head office' },
    { number: 'Pan-India', label: 'Service reach' },
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
