import { UserType } from '../../../core/models/user.model';

export interface LoginFormData {
  email: string;
  password: string;
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
