import { RequesterType } from '../../../core/models/service.model';

export interface RequesterAccountTypeOption {
  type: RequesterType;
  icon: string;
  title: string;
  description: string;
}

export const REQUESTER_ACCOUNT_TYPES: RequesterAccountTypeOption[] = [
  {
    type: 'individual',
    icon: 'user',
    title: 'Individual',
    description: 'For personal service needs'
  },
  {
    type: 'sme',
    icon: 'building-2',
    title: 'Small/Medium Enterprise (SME)',
    description: 'For business requirements'
  },
  {
    type: 'large_organization',
    icon: 'factory',
    title: 'Large Organization',
    description: 'For institutional/large-scale needs'
  }
];

export interface StepInfo {
  number: number;
  title: string;
  isActive: boolean;
  isCompleted: boolean;
}
