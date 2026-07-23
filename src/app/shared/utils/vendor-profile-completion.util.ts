import { Vendor } from '../../core/models/service.model';

/**
 * One profile section's completion state, as shown on the vendor dashboard
 * checklist and the /vendor-profile section nav.
 */
export interface VendorProfileSection {
  id: 'basic' | 'documents' | 'services' | 'portfolio' | 'bank';
  label: string;
  isComplete: boolean;
  route: string;
}

/**
 * Derives completion for all five sections from the vendor record.
 *
 * This is the single source of the rules — the dashboard ring, its caption and
 * the profile page's nav all call this, so they can never disagree (the BG6
 * lesson). The rules intentionally mirror the backend contract in
 * docs/backend/02-API-VENDOR-DASHBOARD.md so the two sides can't drift either.
 */
export function computeProfileSections(vendor: Vendor | null): VendorProfileSection[] {
  const v = vendor;

  const basicComplete = !!(
    v?.businessName &&
    v.businessType &&
    v.gstNumber &&
    v.panNumber &&
    v.yearEstablished &&
    v.primaryContactPerson &&
    v.phone &&
    v.registeredAddress &&
    v.city &&
    v.state &&
    v.pinCode
  );

  // Business certificate + GST certificate are mandatory for verification;
  // trade licence and insurance are optional extras.
  const documentsComplete = !!(
    v?.documentsUploaded?.businessCertificate && v.documentsUploaded.gstCertificate
  );

  const servicesComplete = !!(
    v?.serviceCapabilities?.length && v.serviceAreas?.length
  );

  const portfolioComplete = !!v?.portfolio?.length;

  const bank = v?.bankDetails;
  const bankComplete = !!(
    bank?.accountHolderName && bank.accountNumber && bank.ifscCode && bank.bankName
  );

  return [
    { id: 'basic', label: 'Basic Information', isComplete: basicComplete, route: '/vendor-profile/basic' },
    { id: 'documents', label: 'Business Documents', isComplete: documentsComplete, route: '/vendor-profile/documents' },
    { id: 'services', label: 'Services Offered', isComplete: servicesComplete, route: '/vendor-profile/services' },
    { id: 'portfolio', label: 'Portfolio', isComplete: portfolioComplete, route: '/vendor-profile/portfolio' },
    { id: 'bank', label: 'Bank Details', isComplete: bankComplete, route: '/vendor-profile/bank' },
  ];
}

/** "••••6789" — the only form the account number takes outside the edit field. */
export function maskAccountNumber(accountNumber: string | undefined): string {
  if (!accountNumber) return '';
  return '••••' + accountNumber.slice(-4);
}
