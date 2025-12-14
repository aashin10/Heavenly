import { UserType } from '../../../core/models/user.model';

// Portal type - Jobs vs Services
export type PortalType = 'jobs' | 'services';

// Service user type for login - maps to ServiceUserType
export type ServiceLoginUserType = 'service_requester' | 'vendor';

export interface LoginFormData {
  email: string;
  password: string;
}

export interface ServiceLoginFormData {
  email: string;
  password: string;
  serviceUserType: ServiceLoginUserType;
}

export interface SignupFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  userType: UserType;
  phone: string;
  company: string;
  location: string;
}

export const INITIAL_LOGIN_DATA: LoginFormData = {
  email: '',
  password: '',
};

export const INITIAL_SERVICE_LOGIN_DATA: ServiceLoginFormData = {
  email: '',
  password: '',
  serviceUserType: 'service_requester',
};

export const INITIAL_SIGNUP_DATA: SignupFormData = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  userType: 'applicant',
  phone: '',
  company: '',
  location: '',
};
