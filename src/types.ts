export type UserRole = 'customer' | 'provider';

export type ServiceCategoryId =
  | 'ac_appliance'
  | 'plumbing'
  | 'electrical'
  | 'carpentry'
  | 'cleaning_pest'
  | 'painting';

export interface ServiceCatalogItem {
  id: ServiceCategoryId;
  name: string;
  shortName: string;
  tagline: string;
  image?: string;
  baseVisitFeeInr: number;
  typicalTime: string;
  commonProblems: string[];
}

export interface LocationPin {
  lat: number;
  lng: number;
  address: string;
  radiusKm: number;
}

export interface CustomerAccount {
  id: string;
  role: 'customer';
  name: string;
  authMethod: 'gmail' | 'phone';
  identifier: string;
  location: LocationPin;
  preferredServices: ServiceCategoryId[];
  selectedProblems: string[];
  onboardingComplete: boolean;
}

export interface ProviderAccount {
  id: string;
  role: 'provider';
  name: string;
  authMethod: 'gmail' | 'phone';
  identifier: string;
  services: ServiceCategoryId[];
  skills: string[];
  experienceYears: number;
  certifications: string[];
  location: LocationPin;
  rating: number;
  completedJobs: number;
  verified: boolean;
  onboardingComplete: boolean;
}

export interface EstimatedPart {
  name: string;
  estimatedCostInr: string;
}

export interface DiagnosisResult {
  likelyProblem: string;
  serviceCategory: ServiceCategoryId;
  serviceCategoryLabel: string;
  confidenceLabel: string;
  detectedLanguage: string;
  transcriptSummary: string;
  estimatedParts: EstimatedPart[];
  estimatedTime: string;
  fairPriceMinInr: number;
  fairPriceMaxInr: number;
  safetyRiskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  safetyRisks: string[];
  preventiveMeasures: string[];
  recommendedQuestionsForTech: string[];
}

export type PaymentMethod = 'online' | 'cash_on_site';
export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'declined';

export interface JobBooking {
  id: string;
  customerId: string;
  customerName: string;
  customerContact: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  serviceCategory: ServiceCategoryId;
  serviceCategoryLabel: string;
  selectedProblems: string[];
  diagnosis: DiagnosisResult;
  mediaPreviewDataUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  customerNotes?: string;
  scheduledSlot: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'paid_online' | 'pay_on_site';
  status: BookingStatus;
  assignedProviderId?: string;
  assignedProviderName?: string;
  createdAt: string;
  distanceKm?: number;
}

export interface MatchedProvider {
  id: string;
  name: string;
  services: ServiceCategoryId[];
  skills: string[];
  experienceYears: number;
  certifications: string[];
  location: LocationPin;
  rating: number;
  completedJobs: number;
  verified: boolean;
  distanceKm: number;
}
