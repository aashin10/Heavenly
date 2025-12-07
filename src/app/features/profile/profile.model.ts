export interface ProfileFormData {
  name: string;
  phone: string;
  location: string;
  company: string;
  bio: string;
  skills: string;
  experience: string;
}

export const INITIAL_PROFILE_DATA: ProfileFormData = {
  name: '',
  phone: '',
  location: '',
  company: '',
  bio: '',
  skills: '',
  experience: ''
};
