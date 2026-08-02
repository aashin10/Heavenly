import { Vendor, VendorDocuments } from '../../models/service.model';
import { VendorDto } from './vendor-api.models';

const DOCUMENT_TYPE_KEYS: Record<string, keyof VendorDocuments> = {
  business_certificate: 'businessCertificate',
  gst_certificate: 'gstCertificate',
  trade_license: 'tradeLicense',
  insurance_certificate: 'insuranceCertificate',
};

function mapVendorDocuments(dto: VendorDto): VendorDocuments {
  const documents: VendorDocuments = {};
  for (const doc of dto.documents) {
    const key = DOCUMENT_TYPE_KEYS[doc.documentType];
    if (key) {
      documents[key] = doc.fileName ?? doc.fileUrl;
    }
  }
  return documents;
}

export function mapVendorDto(dto: VendorDto): Vendor {
  return {
    id: dto.id,
    businessName: dto.businessName,
    businessType: dto.businessType,
    gstNumber: dto.gstNumber ?? undefined,
    panNumber: dto.panNumber ?? '',
    yearEstablished: dto.yearEstablished ?? 0,
    primaryContactPerson: dto.primaryContactPerson ?? '',
    designation: dto.designation ?? '',
    email: dto.email ?? '',
    phone: dto.phone ?? '',
    alternatePhone: dto.alternatePhone ?? undefined,
    registeredAddress: dto.registeredAddress ?? '',
    city: dto.city ?? '',
    state: dto.state ?? '',
    pinCode: dto.pinCode ?? '',
    serviceCapabilities: dto.serviceCapabilities,
    serviceAreas: dto.serviceAreas,
    experienceByService: dto.experienceByService,
    verificationStatus: dto.verificationStatus,
    // The full account number is never returned by the API — see
    // VendorBankDetailsDto. maskAccountNumber() is idempotent on an
    // already-masked "••••1234" value (it re-slices the last 4 characters),
    // so passing the mask straight through is safe.
    documentsUploaded: mapVendorDocuments(dto),
    bankDetails: {
      accountHolderName: dto.bankDetails.accountHolderName ?? '',
      accountNumber: dto.bankDetails.maskedAccountNumber ?? '',
      ifscCode: dto.bankDetails.ifscCode ?? '',
      bankName: dto.bankDetails.bankName ?? '',
    },
    portfolio: dto.portfolio.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      year: p.year,
      clientName: p.clientName ?? undefined,
    })),
    createdAt: new Date(dto.createdAt),
    verifiedAt: dto.verifiedAt ? new Date(dto.verifiedAt) : undefined,
    isEmailVerified: dto.isEmailVerified,
    rejectionReason: dto.rejectionReason ?? undefined,
    reviewedBy: dto.reviewedById ?? undefined,
    verificationEvents: dto.verificationEvents.map(e => ({
      status: e.status,
      at: new Date(e.occurredAt),
      actor: e.actorId ?? undefined,
      note: e.note ?? undefined,
    })),
  };
}
