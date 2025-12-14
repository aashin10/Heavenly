/**
 * Service Category Utilities
 * Maps services to their respective categories and provides helper functions
 */

import { ServiceCategory, SERVICES, SERVICE_CATEGORIES, ServiceType, ServiceCategoryInfo } from '../../core/models/service.model';

/** Service name to category mapping for quick lookup */
export const SERVICE_TO_CATEGORY: Record<string, ServiceCategory> = {
  // Quick Services (Category 3)
  'AC Servicing': 'quick_service',
  'Appliance Servicing': 'quick_service',
  'Appliance Servicing & Repair': 'quick_service',
  'Tools & Accessories Supply': 'quick_service',

  // Mid-Complexity (Category 2)
  'Interior Finishing': 'mid_complexity',
  'Paint & Polish': 'mid_complexity',
  'Office Furniture Supply': 'mid_complexity',
  'Puff Panel Furniture': 'mid_complexity',
  'Boundary Wall': 'mid_complexity',
  'Signage Works': 'mid_complexity',

  // Technical (Category 1)
  'Transformer Rewinding': 'technical',
  'Structure & Brickwork': 'technical',
  'Electrical Materials Supply': 'technical',
  'Fabrication (MS/SS/Aluminium)': 'technical',
  'CCTV & Fire Systems': 'technical'
};

/** Get category for a service by name */
export function getCategoryByServiceName(serviceName: string): ServiceCategory {
  return SERVICE_TO_CATEGORY[serviceName] || 'mid_complexity';
}

/** Get category info for a service by name */
export function getCategoryInfoByServiceName(serviceName: string): ServiceCategoryInfo {
  const category = getCategoryByServiceName(serviceName);
  return SERVICE_CATEGORIES[category];
}

/** What to expect info for each category */
export interface WhatToExpectInfo {
  formType: string;
  estimatedTime: string;
  requirements: string[];
  approvalTimeline: string;
}

export const CATEGORY_EXPECTATIONS: Record<ServiceCategory, WhatToExpectInfo> = {
  quick_service: {
    formType: 'Quick Request Form',
    estimatedTime: '5-10 minutes',
    requirements: [
      'Basic service details',
      'Preferred timing',
      'Location/address',
      'Contact information'
    ],
    approvalTimeline: '24-48 hours'
  },
  mid_complexity: {
    formType: 'Guided Form',
    estimatedTime: '10-15 minutes',
    requirements: [
      'Detailed service requirements',
      'Site/location details',
      'Quantity/scope specifications',
      'Timeline preferences',
      'Budget range (optional)'
    ],
    approvalTimeline: '24-48 hours'
  },
  technical: {
    formType: 'Technical Specifications Form',
    estimatedTime: '15-25 minutes',
    requirements: [
      'Technical specifications',
      'Drawings/blueprints (if available)',
      'Material requirements',
      'Quality standards',
      'Compliance requirements',
      'Detailed scope of work'
    ],
    approvalTimeline: '48-72 hours'
  }
};

/** Get what to expect info for a service */
export function getWhatToExpect(serviceName: string): WhatToExpectInfo {
  const category = getCategoryByServiceName(serviceName);
  return CATEGORY_EXPECTATIONS[category];
}

/** Homepage service icons data */
export interface HomeServiceIcon {
  id: string;
  name: string;
  icon: string;
  shortName: string;
}

export const HOMEPAGE_SERVICES: HomeServiceIcon[] = [
  { id: 'ac-servicing', name: 'AC/Appliance Servicing', icon: '❄️', shortName: 'AC Servicing' },
  { id: 'interior-finishing', name: 'Interior & Finishing', icon: '🏠', shortName: 'Interior' },
  { id: 'paint-polish', name: 'Paint & Polish', icon: '🎨', shortName: 'Paint' },
  { id: 'electrical-materials', name: 'Electrical Materials', icon: '💡', shortName: 'Electrical' },
  { id: 'fabrication', name: 'Fabrication', icon: '⚙️', shortName: 'Fabrication' },
  { id: 'cctv-fire', name: 'CCTV & Fire', icon: '📹', shortName: 'CCTV/Fire' },
  { id: 'office-furniture', name: 'Furniture Supply', icon: '🪑', shortName: 'Furniture' },
  { id: 'transformer-rewinding', name: 'Transformer Rewinding', icon: '⚡', shortName: 'Transformer' }
];

/** Filter options for services page */
export type ServiceFilterType = 'all' | 'quick' | 'home_office' | 'industrial';

export interface ServiceFilter {
  id: ServiceFilterType;
  label: string;
  category?: ServiceCategory;
}

export const SERVICE_FILTERS: ServiceFilter[] = [
  { id: 'all', label: 'All Services' },
  { id: 'quick', label: 'Quick Services', category: 'quick_service' },
  { id: 'home_office', label: 'Home & Office', category: 'mid_complexity' },
  { id: 'industrial', label: 'Industrial & Technical', category: 'technical' }
];

/** Filter services by filter type */
export function filterServices(filterType: ServiceFilterType): ServiceType[] {
  if (filterType === 'all') {
    return SERVICES;
  }
  
  const filter = SERVICE_FILTERS.find(f => f.id === filterType);
  if (!filter?.category) {
    return SERVICES;
  }
  
  return SERVICES.filter(s => s.category === filter.category);
}

/** Search services by query */
export function searchServices(query: string): ServiceType[] {
  const searchTerm = query.toLowerCase().trim();
  if (!searchTerm) {
    return SERVICES;
  }
  
  return SERVICES.filter(service => 
    service.name.toLowerCase().includes(searchTerm) ||
    service.description.toLowerCase().includes(searchTerm)
  );
}

/** Get grouped services for display */
export interface GroupedServices {
  quick: ServiceType[];
  midComplexity: ServiceType[];
  technical: ServiceType[];
}

export function getGroupedServices(): GroupedServices {
  return {
    quick: SERVICES.filter(s => s.category === 'quick_service'),
    midComplexity: SERVICES.filter(s => s.category === 'mid_complexity'),
    technical: SERVICES.filter(s => s.category === 'technical')
  };
}

/** Indian states for address forms */
export const INDIAN_STATES: string[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

/** Major cities for service area selection */
export const MAJOR_CITIES: string[] = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
  'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
  'Surat', 'Kanpur', 'Nagpur', 'Patna', 'Indore',
  'Thane', 'Bhopal', 'Visakhapatnam', 'Vadodara', 'Firozabad',
  'Ludhiana', 'Rajkot', 'Agra', 'Siliguri', 'Nashik',
  'Faridabad', 'Patiala', 'Meerut', 'Kalyan-Dombivali', 'Vasai-Virar'
];
