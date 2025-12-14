import { VendorBusinessType } from '../../../core/models/service.model';

export interface BusinessTypeOption {
  type: VendorBusinessType;
  label: string;
}

export const BUSINESS_TYPES: BusinessTypeOption[] = [
  { type: 'individual_contractor', label: 'Individual Contractor' },
  { type: 'partnership', label: 'Partnership' },
  { type: 'private_limited', label: 'Private Limited' },
  { type: 'llp', label: 'LLP' },
  { type: 'others', label: 'Others' }
];

export interface VendorStepInfo {
  number: number;
  title: string;
  isActive: boolean;
  isCompleted: boolean;
}
