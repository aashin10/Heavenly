import { ServiceCategory } from '../../core/models/service.model';

export interface ServiceCardData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ServiceCategory;
  isPopular?: boolean;
  aiAssisted?: boolean;
}

export interface ServiceGroupData {
  id: ServiceCategory;
  title: string;
  emoji: string;
  badge: string;
  formTime: string;
  indicator: string;
  services: ServiceCardData[];
}

export type ServiceFilterType = 'all' | 'quick' | 'home_office' | 'industrial';

export interface AuthModalState {
  isOpen: boolean;
  selectedService: ServiceCardData | null;
}
