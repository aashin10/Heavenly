export type UserType = 'employer' | 'applicant' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  userType: UserType;
  phone?: string;
  company?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  experience?: string;
  acceptedTerms: boolean;
  createdAt: string;
}
