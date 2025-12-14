import { ServiceCategory } from '../../core/models/service.model';

export interface ServiceFormConfig {
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  totalSteps: number;
  stepLabels: string[];
}

export const FORM_CONFIGS: Record<ServiceCategory, Omit<ServiceFormConfig, 'serviceId' | 'serviceName'>> = {
  technical: {
    category: 'technical',
    totalSteps: 5,
    stepLabels: [
      'Service Identification',
      'Site & Contact',
      'Technical Scope',
      'Commercial',
      'Constraints'
    ]
  },
  mid_complexity: {
    category: 'mid_complexity',
    totalSteps: 5,
    stepLabels: [
      'Service Selection',
      'Area & Quantity',
      'Materials & Finish',
      'Execution Context',
      'Budget & Timeline'
    ]
  },
  quick_service: {
    category: 'quick_service',
    totalSteps: 4,
    stepLabels: [
      'Service Type',
      'Equipment List',
      'Service Context',
      'Budget & Timing'
    ]
  }
};

export interface DraftRestoreModalState {
  isOpen: boolean;
  draftId: string | null;
  lastSaved: Date | null;
  currentStep: number;
}
