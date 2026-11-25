import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  BookingStatus,
  CustomerAccount,
  DiagnosisResult,
  JobBooking,
  LocationPin,
  PaymentMethod,
  ProviderAccount,
  ServiceCategoryId,
  UserRole,
} from '../types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../.data');
const STORE_FILE = path.join(DATA_DIR, 'urbanfix-store.json');

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  authMethod: 'gmail' | 'phone';
  exp: number;
}

interface StoredCustomerRecord {
  user: CustomerAccount;
  passwordHash: string;
}

interface StoredProviderRecord {
  user: ProviderAccount;
  passwordHash: string;
}

interface LocalStoreFile {
  customers: StoredCustomerRecord[];
  providers: StoredProviderRecord[];
  bookings: JobBooking[];
}

interface SupabaseUserRow {
  id: string;
  role: UserRole;
  auth_method: 'gmail' | 'phone';
  identifier: string;
  name: string;
  password_hash: string;
  profile: Record<string, unknown>;
  created_at: string;
}

interface SupabaseBookingRow {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_contact: string;
  location: JobBooking['location'];
  service_category: ServiceCategoryId;
  service_category_label: string;
  selected_problems: string[];
  diagnosis: DiagnosisResult;
  media_preview_data_url: string | null;
  media_type: 'image' | 'video' | 'audio' | null;
  customer_notes: string | null;
  scheduled_slot: string;
  payment_method: PaymentMethod;
  payment_status: 'paid_online' | 'pay_on_site';
  status: BookingStatus;
  assigned_provider_id: string | null;
  assigned_provider_name: string | null;
  created_at: string;
}

const RUNTIME_SESSION_SECRET =
  process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const DIRECTORY_PROVIDERS: ProviderAccount[] = [
  {
    id: 'prov-101',
    role: 'provider',
    name: 'Karthik Gowda',
    authMethod: 'phone',
    identifier: '+919845022104',
    services: ['ac_appliance', 'electrical'],
    skills: ['Split AC Inverter PCB', 'R32 Refrigerant Leak Test', 'Compressor Capacitor Swap'],
    experienceYears: 8,
    certifications: [
      'ITI Certified Technician',
      'R32 / R410A Refrigerant Handling',
      'Background & Police Verified',
    ],
    location: {
      lat: 12.9784,
      lng: 77.6408,
      address: 'CMH Road, Indiranagar, Bengaluru',
      radiusKm: 10,
    },
    rating: 4.9,
    completedJobs: 412,
    verified: true,
    onboardingComplete: true,
  },
  {
    id: 'prov-102',
    role: 'provider',
    name: 'Ramesh Nair',
    authMethod: 'gmail',
    identifier: 'ramesh.nair.pro@gmail.com',
    services: ['plumbing', 'painting'],
    skills: [
      'Concealed Pipe Pressure Test',
      'Grohe & Jaquar Mixer Repair',
      'Damp Wall Waterproofing',
    ],
    experienceYears: 11,
    certifications: ['Plumbing & Sanitary Guild Verified', 'Background & Police Verified'],
    location: {
      lat: 12.9352,
      lng: 77.6245,
      address: '4th Block, Koramangala, Bengaluru',
      radiusKm: 12,
    },
    rating: 4.8,
    completedJobs: 538,
    verified: true,
    onboardingComplete: true,
  },
  {
    id: 'prov-103',
    role: 'provider',
    name: 'Arvind Kulkarni',
    authMethod: 'phone',
    identifier: '+919900177321',
    services: ['electrical', 'ac_appliance'],
    skills: [
      '3-Phase MCB Distribution',
      'RCCB Earth Leakage Diagnostics',
      'Stabilizer & Inverter Wiring',
    ],
    experienceYears: 9,
    certifications: [
      'Licensed Wireman (Class A/B)',
      'Electrical Safety & Lockout Trained',
      'Background & Police Verified',
    ],
    location: {
      lat: 12.9611,
      lng: 77.5902,
      address: 'Richmond Circle, Bengaluru',
      radiusKm: 9,
    },
    rating: 4.9,
    completedJobs: 367,
    verified: true,
    onboardingComplete: true,
  },
  {
    id: 'prov-104',
    role: 'provider',
    name: 'Manjunath Shetty',
    authMethod: 'phone',
    identifier: '+919741266018',
    services: ['carpentry', 'painting'],
    skills: ['Soft-Close Cabinet Hinges', 'Mortise Lock Replacement', 'Door Planing & Alignment'],
    experienceYears: 7,
    certifications: ['ITI Certified Technician', 'Background & Police Verified'],
    location: {
      lat: 12.9279,
      lng: 77.5838,
      address: 'Jayanagar 3rd Block, Bengaluru',
      radiusKm: 11,
    },
    rating: 4.7,
    completedJobs: 249,
    verified: true,
    onboardingComplete: true,
  },
  {
    id: 'prov-105',
    role: 'provider',
    name: 'Deepak Sharma',
    authMethod: 'gmail',
    identifier: 'deepak.urbanpro@gmail.com',
    services: ['cleaning_pest', 'plumbing'],
    skills: [
      'Chimney & Hob Degreasing',
      'Herbal Gel Pest Control',
      'High-Pressure Drain Jetting',
    ],
    experienceYears: 6,
    certifications: ['Background & Police Verified', 'Bosch / LG Authorized Service Trained'],
    location: {
      lat: 12.9698,
      lng: 77.7499,
      address: 'ITPL Main Rd, Whitefield, Bengaluru',
      radiusKm: 10,
    },
    rating: 4.8,
    completedJobs: 318,
    verified: true,
    onboardingComplete: true,
  },
];

function createSeedBookings(): JobBooking[] {
  return [
    {
      id: 'UF-8421',
      customerId: 'cust-seed-1',
      customerName: 'Ananya Rao',
      customerContact: 'ananya.rao@gmail.com',
      location: {
        lat: 12.9742,
        lng: 77.6192,
        address: 'Halasuru / Ulsoor Lake Rd, Bengaluru 560008',
      },
      serviceCategory: 'ac_appliance',
      serviceCategoryLabel: 'AC & Appliance Repair',
      selectedProblems: [
        'Water dripping from indoor unit',
        'AC not cooling / blowing warm air',
      ],
      diagnosis: {
        likelyProblem:
          'Clogged condensate drain line & frozen evaporator coil due to dust buildup',
        serviceCategory: 'ac_appliance',
        serviceCategoryLabel: 'AC & Appliance Repair',
        confidenceLabel: 'High Confidence (Photo + Voice Note)',
        detectedLanguage: 'Kannada',
        transcriptSummary:
          'Customer explained in Kannada that water started dripping onto the wall after 20 minutes of running and cooling dropped noticeably.',
        estimatedParts: [
          {
            name: 'Drain pipe flush & antimicrobial foam cleaner',
            estimatedCostInr: '₹250 – ₹400',
          },
          { name: 'Foam insulation sleeve (if degraded)', estimatedCostInr: '₹150 – ₹250' },
        ],
        estimatedTime: '45 – 60 mins',
        fairPriceMinInr: 650,
        fairPriceMaxInr: 1150,
        safetyRiskLevel: 'Moderate',
        safetyRisks: [
          'Water dripping near live wall power socket below indoor unit.',
          'Switch off AC main isolator MCB before technician opens front fascia.',
        ],
        preventiveMeasures: [
          'Rinse mesh air filters under running water every 15 days during summer.',
          'Keep indoor set temperature at 24°C to avoid coil icing.',
        ],
        recommendedQuestionsForTech: [
          'Please check suction pressure after clearing the drain line.',
          'Confirm if drain pipe slope needs re-securing.',
        ],
      },
      customerNotes: 'Indoor unit mounted above study desk; please bring waterproof wash bag.',
      scheduledSlot: 'Today, 4:00 PM – 5:00 PM',
      paymentMethod: 'online',
      paymentStatus: 'paid_online',
      status: 'pending',
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    },
    {
      id: 'UF-8422',
      customerId: 'cust-seed-2',
      customerName: 'Vikram Deshmukh',
      customerContact: '+91 98801 44519',
      location: {
        lat: 12.9592,
        lng: 77.6411,
        address: 'Domlur 2nd Stage, Bengaluru 560071',
      },
      serviceCategory: 'electrical',
      serviceCategoryLabel: 'Electrical & Wiring',
      selectedProblems: ['MCB / RCCB tripping repeatedly', 'Sparking or scorched power socket'],
      diagnosis: {
        likelyProblem: 'Loose neutral terminal & carbon arcing inside 16A geyser power socket',
        serviceCategory: 'electrical',
        serviceCategoryLabel: 'Electrical & Wiring',
        confidenceLabel: 'High Confidence (Photo Analysis)',
        detectedLanguage: 'Hindi',
        transcriptSummary:
          'Customer reported in Hindi that the bathroom geyser switch sparked and tripped the main breaker twice this morning.',
        estimatedParts: [
          { name: '16A Modular Heavy-Duty Socket & Switch', estimatedCostInr: '₹320 – ₹480' },
          { name: 'Heat-resistant 2.5 sqmm copper pigtail', estimatedCostInr: '₹120 – ₹180' },
        ],
        estimatedTime: '35 – 50 mins',
        fairPriceMinInr: 550,
        fairPriceMaxInr: 950,
        safetyRiskLevel: 'Critical',
        safetyRisks: [
          'Active fire & arc-flash hazard from carbonized socket terminals.',
          'Keep the geyser MCB switched OFF and do not plug any load into this outlet.',
        ],
        preventiveMeasures: [
          'Use dedicated 16A/20A DP switch for geysers instead of standard 6A extension cords.',
          'Schedule annual thermal/tightness inspection on high-load bathroom circuits.',
        ],
        recommendedQuestionsForTech: [
          'Inspect the backbox wire insulation for heat damage.',
          'Verify RCCB trip current at 30mA.',
        ],
      },
      customerNotes: 'Need urgent visit before evening.',
      scheduledSlot: 'Today, 2:30 PM – 3:30 PM',
      paymentMethod: 'cash_on_site',
      paymentStatus: 'pay_on_site',
      status: 'pending',
      createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    },
    {
      id: 'UF-8423',
      customerId: 'cust-seed-3',
      customerName: 'Meera Krishnan',
      customerContact: 'meera.k.home@gmail.com',
      location: {
        lat: 12.9344,
        lng: 77.6114,
        address: 'Koramangala 7th Block, Bengaluru 560095',
      },
      serviceCategory: 'plumbing',
      serviceCategoryLabel: 'Plumbing & Bath Fittings',
      selectedProblems: ['Leaking pipe or under-sink P-trap', 'Dripping mixer tap or angle valve'],
      diagnosis: {
        likelyProblem:
          'Worn-out ceramic cartridge and hardened rubber gasket on kitchen sink P-trap',
        serviceCategory: 'plumbing',
        serviceCategoryLabel: 'Plumbing & Bath Fittings',
        confidenceLabel: 'High Confidence (Photo + English Note)',
        detectedLanguage: 'English',
        transcriptSummary:
          'Water pools beneath the stainless sink whenever the pull-out faucet runs for more than 30 seconds.',
        estimatedParts: [
          { name: '35mm Ceramic Tap Cartridge', estimatedCostInr: '₹280 – ₹450' },
          {
            name: '40mm Silicone P-Trap Washer Set & PTFE Tape',
            estimatedCostInr: '₹90 – ₹150',
          },
        ],
        estimatedTime: '40 – 60 mins',
        fairPriceMinInr: 520,
        fairPriceMaxInr: 920,
        safetyRiskLevel: 'Low',
        safetyRisks: [
          'Slippery kitchen floor if cabinet puddle overflows; shut off under-sink angle valve.',
        ],
        preventiveMeasures: [
          'Avoid pouring hot cooking oil down the kitchen sink trap to protect washers.',
          'Operate quarter-turn angle valves gently every few months to prevent seizing.',
        ],
        recommendedQuestionsForTech: ['Check braided hot/cold flexi hoses for hairline cracks.'],
      },
      scheduledSlot: 'Tomorrow, 10:00 AM – 11:00 AM',
      paymentMethod: 'online',
      paymentStatus: 'paid_online',
      status: 'pending',
      createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    },
  ];
}

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedSupabaseSignature = '';

function cleanEnvValue(raw?: string): string {
  if (!raw) return '';
  let val = raw.trim().replace(/[\r\n]/g, '');
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

function getCleanedSupabaseCreds(): { url: string; serviceKey: string } {
  const url = cleanEnvValue(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const serviceKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return { url, serviceKey };
}

export function getSupabaseConfigIssue(): string | null {
  const { url, serviceKey } = getCleanedSupabaseCreds();
  if (!url && !serviceKey) return null;
  if (!url || !serviceKey) {
    return 'Both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in AI Studio Settings > Secrets.';
  }
  if (serviceKey.startsWith('http://') || serviceKey.startsWith('https://')) {
    return 'SUPABASE_SERVICE_ROLE_KEY contains a URL. Please check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not swapped in Settings > Secrets.';
  }
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return 'SUPABASE_URL must start with https:// (for example https://your-project.supabase.co).';
    }
  } catch {
    return 'SUPABASE_URL is not a valid URL. Copy the Project URL from Supabase Project Settings > Data API / API.';
  }
  if (serviceKey.startsWith('sb_publishable_')) {
    return 'SUPABASE_SERVICE_ROLE_KEY is set to a Publishable key (sb_publishable_...). Copy your Secret key (sb_secret_...) or Legacy service_role key instead.';
  }
  if (serviceKey.startsWith('sbp_')) {
    return 'SUPABASE_SERVICE_ROLE_KEY is set to a Personal Access Token (sbp_...). Copy your Project Secret key (sb_secret_...) or Legacy service_role key from Supabase Project Settings > API Keys.';
  }
  const jwtParts = serviceKey.split('.');
  if (jwtParts.length === 3 && serviceKey.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(
        Buffer.from(jwtParts[1], 'base64url').toString('utf-8')
      ) as { role?: string; ref?: string };
      if (payload.role === 'anon') {
        return 'SUPABASE_SERVICE_ROLE_KEY is set to the public anon key. Please use the service_role key from Supabase Project Settings > API Keys.';
      }
      if (payload.ref && url.includes('.supabase.co') && !url.includes(payload.ref)) {
        return 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY belong to different Supabase projects. Verify both come from the same project in Settings > Secrets.';
      }
    } catch {
      // ignore malformed JWT payload decode
    }
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  const { url, serviceKey } = getCleanedSupabaseCreds();
  return Boolean(url && serviceKey);
}

function getSupabaseClient(): SupabaseClient | null {
  const { url, serviceKey } = getCleanedSupabaseCreds();
  if (!url || !serviceKey) return null;

  const configIssue = getSupabaseConfigIssue();
  if (configIssue) {
    throw new Error(configIssue);
  }

  const signature = `${url}::${serviceKey.slice(0, 12)}::${serviceKey.length}`;
  if (!cachedSupabaseClient || cachedSupabaseSignature !== signature) {
    cachedSupabaseClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedSupabaseSignature = signature;
  }
  return cachedSupabaseClient;
}

export async function checkSupabaseHealth(): Promise<string | null> {
  const configIssue = getSupabaseConfigIssue();
  if (configIssue) return configIssue;
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { error } = await supabase.from('urbanfix_users').select('id').limit(1);
    if (!error) return null;

    if (
      error.code === '42P01' ||
      /relation .* does not exist|Could not find the table/i.test(error.message || '')
    ) {
      return 'Supabase connected, but tables are missing. Run /supabase/schema.sql in your Supabase SQL Editor.';
    }
    if (error.code === '42501' || /permission denied/i.test(error.message || '')) {
      return 'Supabase permission denied for table urbanfix_users. Run the GRANT statements in /supabase/schema.sql in Supabase SQL Editor (grant all privileges on public.urbanfix_users and public.urbanfix_bookings to service_role), and verify SUPABASE_SERVICE_ROLE_KEY is your service_role / sb_secret_ key.';
    }
    if (/Invalid API key|No API key found|JWT|apikey/i.test(error.message || '')) {
      return 'Supabase rejected SUPABASE_SERVICE_ROLE_KEY (Invalid API key). Copy the Secret key (sb_secret_...) or Legacy service_role key from Supabase Project Settings → API Keys into AI Studio Settings → Secrets without quotes, and make sure SUPABASE_URL is from the same project.';
    }
    return error.message || 'Unable to verify Supabase connection.';
  } catch (err: unknown) {
    return err instanceof Error ? err.message : null;
  }
}

export function normalizeIdentifier(authMethod: 'gmail' | 'phone', rawIdentifier: string): string {
  const trimmed = rawIdentifier.trim();
  if (authMethod === 'gmail') {
    return trimmed.toLowerCase();
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

export function signAuthToken(user: CustomerAccount | ProviderAccount): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    role: user.role,
    authMethod: user.authMethod,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', RUNTIME_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, sig] = parts;
  if (!encodedPayload || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', RUNTIME_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    ) as AuthTokenPayload;
    if (!payload?.sub || !payload?.role || typeof payload.exp !== 'number') {
      return null;
    }
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function loadLocalStore(): LocalStoreFile {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    const initial: LocalStoreFile = {
      customers: [],
      providers: [],
      bookings: createSeedBookings(),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as Partial<LocalStoreFile> & {
      customers?: Array<StoredCustomerRecord | CustomerAccount>;
      providers?: Array<StoredProviderRecord | ProviderAccount>;
    };

    // Migrate cleanly if older local file stored plain accounts without passwordHash
    const customers: StoredCustomerRecord[] = (raw.customers || []).filter(
      (item): item is StoredCustomerRecord =>
        Boolean(item && typeof item === 'object' && 'user' in item && 'passwordHash' in item)
    );
    const providers: StoredProviderRecord[] = (raw.providers || []).filter(
      (item): item is StoredProviderRecord =>
        Boolean(item && typeof item === 'object' && 'user' in item && 'passwordHash' in item)
    );
    const bookings = Array.isArray(raw.bookings) ? raw.bookings : createSeedBookings();

    return { customers, providers, bookings };
  } catch {
    const initial: LocalStoreFile = {
      customers: [],
      providers: [],
      bookings: createSeedBookings(),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

function saveLocalStore(store: LocalStoreFile): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function defaultLocationForRole(role: UserRole): LocationPin {
  if (role === 'customer') {
    return {
      lat: 12.9716,
      lng: 77.5946,
      address: 'Indiranagar 100 Feet Rd, Bengaluru, Karnataka 560038',
      radiusKm: 6,
    };
  }
  return {
    lat: 12.9716,
    lng: 77.5946,
    address: 'MG Road / Indiranagar, Bengaluru, Karnataka',
    radiusKm: 8,
  };
}

function rowToAccount(row: SupabaseUserRow): CustomerAccount | ProviderAccount {
  const profile = row.profile || {};
  if (row.role === 'customer') {
    return {
      id: row.id,
      role: 'customer',
      name: row.name,
      authMethod: row.auth_method,
      identifier: row.identifier,
      location:
        (profile.location as LocationPin | undefined) || defaultLocationForRole('customer'),
      preferredServices: Array.isArray(profile.preferredServices)
        ? (profile.preferredServices as ServiceCategoryId[])
        : [],
      selectedProblems: Array.isArray(profile.selectedProblems)
        ? (profile.selectedProblems as string[])
        : [],
      onboardingComplete: Boolean(profile.onboardingComplete),
    };
  }
  return {
    id: row.id,
    role: 'provider',
    name: row.name,
    authMethod: row.auth_method,
    identifier: row.identifier,
    services: Array.isArray(profile.services)
      ? (profile.services as ServiceCategoryId[])
      : ['ac_appliance'],
    skills: Array.isArray(profile.skills) ? (profile.skills as string[]) : [],
    experienceYears:
      typeof profile.experienceYears === 'number' ? profile.experienceYears : 3,
    certifications: Array.isArray(profile.certifications)
      ? (profile.certifications as string[])
      : ['Background & Police Verified'],
    location:
      (profile.location as LocationPin | undefined) || defaultLocationForRole('provider'),
    rating: typeof profile.rating === 'number' ? profile.rating : 4.8,
    completedJobs: typeof profile.completedJobs === 'number' ? profile.completedJobs : 0,
    verified: typeof profile.verified === 'boolean' ? profile.verified : true,
    onboardingComplete: Boolean(profile.onboardingComplete),
  };
}

function accountToProfileJson(user: CustomerAccount | ProviderAccount): Record<string, unknown> {
  if (user.role === 'customer') {
    return {
      location: user.location,
      preferredServices: user.preferredServices,
      selectedProblems: user.selectedProblems,
      onboardingComplete: user.onboardingComplete,
    };
  }
  return {
    services: user.services,
    skills: user.skills,
    experienceYears: user.experienceYears,
    certifications: user.certifications,
    location: user.location,
    rating: user.rating,
    completedJobs: user.completedJobs,
    verified: user.verified,
    onboardingComplete: user.onboardingComplete,
  };
}

function rowToBooking(row: SupabaseBookingRow): JobBooking {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerContact: row.customer_contact,
    location: row.location,
    serviceCategory: row.service_category,
    serviceCategoryLabel: row.service_category_label,
    selectedProblems: Array.isArray(row.selected_problems) ? row.selected_problems : [],
    diagnosis: row.diagnosis,
    mediaPreviewDataUrl: row.media_preview_data_url || undefined,
    mediaType: row.media_type || undefined,
    customerNotes: row.customer_notes || undefined,
    scheduledSlot: row.scheduled_slot,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    status: row.status,
    assignedProviderId: row.assigned_provider_id || undefined,
    assignedProviderName: row.assigned_provider_name || undefined,
    createdAt: row.created_at,
  };
}

function bookingToRow(booking: JobBooking): SupabaseBookingRow {
  return {
    id: booking.id,
    customer_id: booking.customerId,
    customer_name: booking.customerName,
    customer_contact: booking.customerContact,
    location: booking.location,
    service_category: booking.serviceCategory,
    service_category_label: booking.serviceCategoryLabel,
    selected_problems: booking.selectedProblems,
    diagnosis: booking.diagnosis,
    media_preview_data_url: booking.mediaPreviewDataUrl ?? null,
    media_type: booking.mediaType ?? null,
    customer_notes: booking.customerNotes ?? null,
    scheduled_slot: booking.scheduledSlot,
    payment_method: booking.paymentMethod,
    payment_status: booking.paymentStatus,
    status: booking.status,
    assigned_provider_id: booking.assignedProviderId ?? null,
    assigned_provider_name: booking.assignedProviderName ?? null,
    created_at: booking.createdAt,
  };
}

function mapSupabaseError(err: { code?: string; message?: string }, fallback: string): Error {
  if (err?.code === '23505') {
    return new Error('DUPLICATE_ACCOUNT');
  }
  if (err?.code === '42P01' || /relation .* does not exist|Could not find the table/i.test(err?.message || '')) {
    return new Error(
      'Supabase tables are not initialized yet. Run /supabase/schema.sql in your Supabase SQL Editor first.'
    );
  }
  if (err?.code === '42501' || /permission denied/i.test(err?.message || '')) {
    console.warn('Supabase permission error:', err?.code, err?.message);
    return new Error(
      'Supabase permission denied for table urbanfix_users. Run the GRANT statements from /supabase/schema.sql in your Supabase SQL Editor and verify SUPABASE_SERVICE_ROLE_KEY is your service_role / sb_secret_ key.'
    );
  }
  if (/Invalid API key|No API key found|JWT|apikey/i.test(err?.message || '')) {
    const configIssue = getSupabaseConfigIssue();
    console.warn('Supabase authentication error:', err?.message);
    return new Error(
      configIssue ||
        'Supabase rejected SUPABASE_SERVICE_ROLE_KEY (Invalid API key). In Supabase Dashboard → Project Settings → API Keys, copy the Secret key (sb_secret_...) or Legacy service_role key into AI Studio Settings → Secrets without quotes, and verify SUPABASE_URL matches that same project.'
    );
  }
  console.warn('Supabase database error:', err?.code, err?.message);
  return new Error(fallback);
}

export async function findAuthUser(
  role: UserRole,
  authMethod: 'gmail' | 'phone',
  rawIdentifier: string
): Promise<{ user: CustomerAccount | ProviderAccount; passwordHash: string } | null> {
  const normalizedId = normalizeIdentifier(authMethod, rawIdentifier);
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from('urbanfix_users')
      .select('*')
      .eq('role', role)
      .eq('auth_method', authMethod)
      .eq('identifier', normalizedId)
      .maybeSingle<SupabaseUserRow>();

    if (error) {
      throw mapSupabaseError(error, 'Database lookup failed.');
    }
    if (!data) return null;
    return {
      user: rowToAccount(data),
      passwordHash: data.password_hash,
    };
  }

  const store = loadLocalStore();
  if (role === 'customer') {
    const found = store.customers.find(
      (c) =>
        c.user.authMethod === authMethod &&
        normalizeIdentifier(authMethod, c.user.identifier) === normalizedId
    );
    return found ? { user: found.user, passwordHash: found.passwordHash } : null;
  }
  const found = store.providers.find(
    (p) =>
      p.user.authMethod === authMethod &&
      normalizeIdentifier(authMethod, p.user.identifier) === normalizedId
  );
  return found ? { user: found.user, passwordHash: found.passwordHash } : null;
}

export async function createUserAccount(params: {
  role: UserRole;
  authMethod: 'gmail' | 'phone';
  identifier: string;
  name: string;
  password: string;
}): Promise<CustomerAccount | ProviderAccount> {
  const normalizedId = normalizeIdentifier(params.authMethod, params.identifier);
  const passwordHash = hashPassword(params.password);
  const id = `${params.role === 'customer' ? 'cust' : 'prov'}-${crypto.randomUUID()}`;

  const newUser: CustomerAccount | ProviderAccount =
    params.role === 'customer'
      ? {
          id,
          role: 'customer',
          name: params.name.trim(),
          authMethod: params.authMethod,
          identifier: normalizedId,
          location: defaultLocationForRole('customer'),
          preferredServices: [],
          selectedProblems: [],
          onboardingComplete: false,
        }
      : {
          id,
          role: 'provider',
          name: params.name.trim(),
          authMethod: params.authMethod,
          identifier: normalizedId,
          services: ['ac_appliance'],
          skills: [],
          experienceYears: 3,
          certifications: ['Background & Police Verified'],
          location: defaultLocationForRole('provider'),
          rating: 4.8,
          completedJobs: 0,
          verified: true,
          onboardingComplete: false,
        };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('urbanfix_users')
      .insert({
        id: newUser.id,
        role: newUser.role,
        auth_method: newUser.authMethod,
        identifier: newUser.identifier,
        name: newUser.name,
        password_hash: passwordHash,
        profile: accountToProfileJson(newUser),
      })
      .select('*')
      .single<SupabaseUserRow>();

    if (error) {
      throw mapSupabaseError(error, 'Failed to create account.');
    }

    if (params.authMethod === 'gmail') {
      try {
        await supabase.auth.admin.createUser({
          email: normalizedId,
          password: params.password,
          email_confirm: true,
          user_metadata: {
            name: newUser.name,
            role: newUser.role,
            urbanfix_user_id: newUser.id,
          },
        });
      } catch {
        // Non-blocking sync to Supabase Auth Users
      }
    }

    return rowToAccount(data);
  }

  const store = loadLocalStore();
  if (newUser.role === 'customer') {
    const dup = store.customers.some(
      (c) =>
        c.user.authMethod === newUser.authMethod &&
        normalizeIdentifier(newUser.authMethod, c.user.identifier) === normalizedId
    );
    if (dup) throw new Error('DUPLICATE_ACCOUNT');
    store.customers.push({ user: newUser, passwordHash });
  } else {
    const dup = store.providers.some(
      (p) =>
        p.user.authMethod === newUser.authMethod &&
        normalizeIdentifier(newUser.authMethod, p.user.identifier) === normalizedId
    );
    if (dup) throw new Error('DUPLICATE_ACCOUNT');
    store.providers.push({ user: newUser, passwordHash });
  }
  saveLocalStore(store);
  return newUser;
}

export async function getUserById(
  id: string
): Promise<CustomerAccount | ProviderAccount | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('urbanfix_users')
      .select('*')
      .eq('id', id)
      .maybeSingle<SupabaseUserRow>();

    if (error) {
      throw mapSupabaseError(error, 'Database lookup failed.');
    }
    return data ? rowToAccount(data) : null;
  }

  const store = loadLocalStore();
  const cust = store.customers.find((c) => c.user.id === id);
  if (cust) return cust.user;
  const prov = store.providers.find((p) => p.user.id === id);
  if (prov) return prov.user;
  return null;
}

export async function updateCustomerPreferences(
  id: string,
  updates: {
    location?: LocationPin;
    preferredServices?: ServiceCategoryId[];
    selectedProblems?: string[];
    onboardingComplete?: boolean;
  }
): Promise<CustomerAccount | null> {
  const existing = await getUserById(id);
  if (!existing || existing.role !== 'customer') return null;

  const updated: CustomerAccount = {
    ...existing,
    location: updates.location || existing.location,
    preferredServices: Array.isArray(updates.preferredServices)
      ? updates.preferredServices
      : existing.preferredServices,
    selectedProblems: Array.isArray(updates.selectedProblems)
      ? updates.selectedProblems
      : existing.selectedProblems,
    onboardingComplete:
      typeof updates.onboardingComplete === 'boolean'
        ? updates.onboardingComplete
        : existing.onboardingComplete,
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('urbanfix_users')
      .update({
        profile: accountToProfileJson(updated),
      })
      .eq('id', id)
      .eq('role', 'customer')
      .select('*')
      .maybeSingle<SupabaseUserRow>();

    if (error) {
      throw mapSupabaseError(error, 'Failed to update customer preferences.');
    }
    return data ? (rowToAccount(data) as CustomerAccount) : null;
  }

  const store = loadLocalStore();
  const record = store.customers.find((c) => c.user.id === id);
  if (!record) return null;
  record.user = updated;
  saveLocalStore(store);
  return updated;
}

export async function updateProviderProfile(
  id: string,
  updates: {
    name?: string;
    services?: ServiceCategoryId[];
    skills?: string[];
    experienceYears?: number;
    certifications?: string[];
    location?: LocationPin;
    onboardingComplete?: boolean;
    incrementCompletedJobs?: boolean;
  }
): Promise<ProviderAccount | null> {
  const existing = await getUserById(id);
  if (!existing || existing.role !== 'provider') return null;

  const updated: ProviderAccount = {
    ...existing,
    name: typeof updates.name === 'string' && updates.name.trim() ? updates.name.trim() : existing.name,
    services: Array.isArray(updates.services) ? updates.services : existing.services,
    skills: Array.isArray(updates.skills) ? updates.skills : existing.skills,
    experienceYears:
      typeof updates.experienceYears === 'number'
        ? updates.experienceYears
        : existing.experienceYears,
    certifications: Array.isArray(updates.certifications)
      ? updates.certifications
      : existing.certifications,
    location: updates.location || existing.location,
    onboardingComplete:
      typeof updates.onboardingComplete === 'boolean'
        ? updates.onboardingComplete
        : existing.onboardingComplete,
    completedJobs: updates.incrementCompletedJobs
      ? existing.completedJobs + 1
      : existing.completedJobs,
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('urbanfix_users')
      .update({
        name: updated.name,
        profile: accountToProfileJson(updated),
      })
      .eq('id', id)
      .eq('role', 'provider')
      .select('*')
      .maybeSingle<SupabaseUserRow>();

    if (error) {
      throw mapSupabaseError(error, 'Failed to update provider profile.');
    }
    return data ? (rowToAccount(data) as ProviderAccount) : null;
  }

  const store = loadLocalStore();
  const record = store.providers.find((p) => p.user.id === id);
  if (!record) return null;
  record.user = updated;
  saveLocalStore(store);
  return updated;
}

export async function listProvidersForMatching(): Promise<ProviderAccount[]> {
  const supabase = getSupabaseClient();
  let registeredProviders: ProviderAccount[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .from('urbanfix_users')
      .select('*')
      .eq('role', 'provider');

    if (error) {
      throw mapSupabaseError(error, 'Failed to load service providers.');
    }
    registeredProviders = ((data || []) as SupabaseUserRow[]).map(
      (row) => rowToAccount(row) as ProviderAccount
    );
  } else {
    const store = loadLocalStore();
    registeredProviders = store.providers.map((p) => p.user);
  }

  const seenIds = new Set(registeredProviders.map((p) => p.id));
  const combined = [...registeredProviders];
  for (const dirProv of DIRECTORY_PROVIDERS) {
    if (!seenIds.has(dirProv.id)) {
      combined.push(dirProv);
    }
  }
  return combined;
}

export async function listCustomerBookings(customerId: string): Promise<JobBooking[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('urbanfix_bookings')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw mapSupabaseError(error, 'Failed to fetch bookings.');
    }
    return ((data || []) as SupabaseBookingRow[]).map(rowToBooking);
  }

  const store = loadLocalStore();
  return store.bookings
    .filter((b) => b.customerId === customerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listAllBookings(): Promise<JobBooking[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('urbanfix_bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw mapSupabaseError(error, 'Failed to load bookings.');
    }
    const rows = (data || []) as SupabaseBookingRow[];
    if (rows.length === 0) {
      const seeds = createSeedBookings();
      const { error: seedErr } = await supabase
        .from('urbanfix_bookings')
        .upsert(seeds.map(bookingToRow), { onConflict: 'id' });
      if (!seedErr) {
        return seeds;
      }
    }
    return rows.map(rowToBooking);
  }

  const store = loadLocalStore();
  return store.bookings;
}

export async function createBookingRecord(booking: JobBooking): Promise<JobBooking> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('urbanfix_bookings')
      .insert(bookingToRow(booking))
      .select('*')
      .single<SupabaseBookingRow>();

    if (error) {
      throw mapSupabaseError(error, 'Failed to save booking.');
    }
    return rowToBooking(data);
  }

  const store = loadLocalStore();
  store.bookings.unshift(booking);
  saveLocalStore(store);
  return booking;
}

export async function updateBookingStatusRecord(params: {
  bookingId: string;
  status: BookingStatus;
  providerId: string;
  providerName: string;
}): Promise<JobBooking | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('urbanfix_bookings')
      .update({
        status: params.status,
        assigned_provider_id: params.providerId,
        assigned_provider_name: params.providerName,
      })
      .eq('id', params.bookingId)
      .select('*')
      .maybeSingle<SupabaseBookingRow>();

    if (error) {
      throw mapSupabaseError(error, 'Failed to update booking status.');
    }
    if (!data) return null;

    if (params.status === 'completed') {
      await updateProviderProfile(params.providerId, { incrementCompletedJobs: true });
    }
    return rowToBooking(data);
  }

  const store = loadLocalStore();
  const booking = store.bookings.find((b) => b.id === params.bookingId);
  if (!booking) return null;

  booking.status = params.status;
  booking.assignedProviderId = params.providerId;
  booking.assignedProviderName = params.providerName;

  if (params.status === 'completed') {
    const prov = store.providers.find((p) => p.user.id === params.providerId);
    if (prov) {
      prov.user.completedJobs += 1;
    }
  }
  saveLocalStore(store);
  return booking;
}
