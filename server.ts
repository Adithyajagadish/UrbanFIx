import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  BookingStatus,
  DiagnosisResult,
  JobBooking,
  PaymentMethod,
  ServiceCategoryId,
} from './src/types.ts';
import {
  checkSupabaseHealth,
  createBookingRecord,
  createUserAccount,
  findAuthUser,
  getUserById,
  isSupabaseConfigured,
  listAllBookings,
  listCustomerBookings,
  listProvidersForMatching,
  signAuthToken,
  updateBookingStatusRecord,
  updateCustomerPreferences,
  updateProviderProfile,
  verifyAuthToken,
  verifyPassword,
  type AuthTokenPayload,
} from './src/server/store.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AuthenticatedRequest extends Request {
  auth?: AuthTokenPayload;
}

const SERVICE_LABELS: Record<ServiceCategoryId, string> = {
  ac_appliance: 'AC & Appliance Repair',
  plumbing: 'Plumbing & Bath Fittings',
  electrical: 'Electrical & Wiring',
  carpentry: 'Carpentry & Hardware',
  cleaning_pest: 'Deep Cleaning & Pest Control',
  painting: 'Painting & Waterproofing',
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function validateAuthInput(
  role?: string,
  authMethod?: string,
  identifier?: string
): string | null {
  if (role !== 'customer' && role !== 'provider') {
    return 'Please select Customer or Service Provider.';
  }
  if (authMethod !== 'gmail' && authMethod !== 'phone') {
    return 'Please choose Gmail or Phone Number.';
  }
  const trimmed = identifier?.trim() || '';
  if (!trimmed) {
    return authMethod === 'gmail'
      ? 'Gmail address is required.'
      : 'Phone number is required.';
  }
  if (authMethod === 'gmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Please enter a valid Gmail or email address.';
  }
  if (authMethod === 'phone') {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10) {
      return 'Please enter a valid 10-digit phone number.';
    }
  }
  return null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.auth = payload;
  next();
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '40mb' }));

  app.get('/api/auth/status', async (_req, res) => {
    const configWarning = await checkSupabaseHealth();
    res.json({
      backend: isSupabaseConfigured() ? 'supabase' : 'local',
      configWarning,
    });
  });

  // Strict Sign Up: creates a new user account with a scrypt-hashed password
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { role, authMethod, identifier, name, password } = req.body as {
        role?: 'customer' | 'provider';
        authMethod?: 'gmail' | 'phone';
        identifier?: string;
        name?: string;
        password?: string;
      };

      const validationError = validateAuthInput(role, authMethod, identifier);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      if (!name?.trim() || name.trim().length < 2) {
        res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
        return;
      }
      if (!password || password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        return;
      }

      const existing = await findAuthUser(role!, authMethod!, identifier!);
      if (existing) {
        res.status(409).json({
          error: 'An account with this contact already exists. Please switch to Sign In.',
        });
        return;
      }

      const user = await createUserAccount({
        role: role!,
        authMethod: authMethod!,
        identifier: identifier!,
        name: name.trim(),
        password,
      });
      const token = signAuthToken(user);
      res.status(201).json({ user, token });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to create account right now.';
      if (msg === 'DUPLICATE_ACCOUNT') {
        res.status(409).json({
          error: 'An account with this contact already exists. Please switch to Sign In.',
        });
        return;
      }
      res.status(500).json({ error: msg });
    }
  });

  // Strict Sign In: only existing signed-up accounts with valid password are allowed
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { role, authMethod, identifier, password } = req.body as {
        role?: 'customer' | 'provider';
        authMethod?: 'gmail' | 'phone';
        identifier?: string;
        password?: string;
      };

      const validationError = validateAuthInput(role, authMethod, identifier);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      if (!password) {
        res.status(400).json({ error: 'Password is required to sign in.' });
        return;
      }

      const record = await findAuthUser(role!, authMethod!, identifier!);
      if (!record) {
        res.status(401).json({
          error: 'No account found with these details. Please sign up first to create an account.',
        });
        return;
      }

      if (!verifyPassword(password, record.passwordHash)) {
        res.status(401).json({
          error: 'Incorrect password. Please verify your password and try again.',
        });
        return;
      }

      const token = signAuthToken(record.user);
      res.json({ user: record.user, token });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in right now.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await getUserById(req.auth!.sub);
      if (!user) {
        res.status(401).json({ error: 'Account not found. Please sign in again.' });
        return;
      }
      res.json({ user });
    } catch {
      res.status(500).json({ error: 'Unable to load account details.' });
    }
  });

  // Update Customer location & service/problem preferences
  app.patch('/api/customers/:id/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.auth?.role !== 'customer' || req.auth.sub !== req.params.id) {
        res.status(403).json({ error: 'Forbidden: you can only update your own profile.' });
        return;
      }
      const { location, preferredServices, selectedProblems, onboardingComplete } = req.body;
      const updated = await updateCustomerPreferences(req.params.id, {
        location,
        preferredServices,
        selectedProblems,
        onboardingComplete,
      });
      if (!updated) {
        res.status(404).json({ error: 'Customer account not found.' });
        return;
      }
      res.json({ user: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update preferences.';
      res.status(500).json({ error: msg });
    }
  });

  // Update Service Provider expertise, certifications, and radius location
  app.patch('/api/providers/:id/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.auth?.role !== 'provider' || req.auth.sub !== req.params.id) {
        res.status(403).json({ error: 'Forbidden: you can only update your own provider profile.' });
        return;
      }
      const { services, skills, experienceYears, certifications, location, onboardingComplete, name } =
        req.body;
      const updated = await updateProviderProfile(req.params.id, {
        name,
        services,
        skills,
        experienceYears,
        certifications,
        location,
        onboardingComplete,
      });
      if (!updated) {
        res.status(404).json({ error: 'Service provider account not found.' });
        return;
      }
      res.json({ user: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update provider profile.';
      res.status(500).json({ error: msg });
    }
  });

  // Find verified Service Providers matching Customer location, radius, and category
  app.get('/api/providers/match', requireAuth, async (req, res) => {
    try {
      const lat = Number(req.query.lat ?? 12.9716);
      const lng = Number(req.query.lng ?? 77.5946);
      const radiusKm = Number(req.query.radiusKm ?? 10);
      const serviceCategory = req.query.serviceCategory as ServiceCategoryId | undefined;

      const providers = await listProvidersForMatching();
      const matches = providers
        .filter((p) => p.onboardingComplete !== false)
        .filter((p) => !serviceCategory || p.services.includes(serviceCategory))
        .map((p) => {
          const dist = haversineKm(lat, lng, p.location.lat, p.location.lng);
          return {
            id: p.id,
            name: p.name,
            services: p.services,
            skills: p.skills,
            experienceYears: p.experienceYears,
            certifications: p.certifications,
            location: p.location,
            rating: p.rating,
            completedJobs: p.completedJobs,
            verified: p.verified,
            distanceKm: dist,
          };
        })
        .filter((p) => p.distanceKm <= radiusKm && p.distanceKm <= p.location.radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      res.json({ providers: matches });
    } catch {
      res.status(500).json({ error: 'Failed to match nearby technicians.' });
    }
  });

  // Customer bookings list
  app.get('/api/bookings/customer/:customerId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.auth?.role !== 'customer' || req.auth.sub !== req.params.customerId) {
        res.status(403).json({ error: 'Forbidden: cannot access another customer bookings.' });
        return;
      }
      const bookings = await listCustomerBookings(req.params.customerId);
      res.json({ bookings });
    } catch {
      res.status(500).json({ error: 'Failed to load customer bookings.' });
    }
  });

  // Service Provider dashboard: list customer problems strictly within provider's service radius
  app.get('/api/bookings/provider/:providerId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.auth?.role !== 'provider' || req.auth.sub !== req.params.providerId) {
        res.status(403).json({ error: 'Forbidden: cannot access another provider dashboard.' });
        return;
      }
      const provider = await getUserById(req.params.providerId);
      if (!provider || provider.role !== 'provider') {
        res.status(404).json({ error: 'Provider not found.' });
        return;
      }

      const allBookings = await listAllBookings();
      const withDistances = allBookings.map((b) => ({
        ...b,
        distanceKm: haversineKm(
          provider.location.lat,
          provider.location.lng,
          b.location.lat,
          b.location.lng
        ),
      }));

      const inRadiusJobs = withDistances
        .filter((b) => {
          const withinRadius = (b.distanceKm ?? 999) <= provider.location.radiusKm;
          const assignedToMe = b.assignedProviderId === provider.id;
          return withinRadius || assignedToMe;
        })
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

      const outOfRadiusCount = withDistances.length - inRadiusJobs.length;

      res.json({
        jobs: inRadiusJobs,
        outOfRadiusCount,
        providerRadiusKm: provider.location.radiusKm,
      });
    } catch {
      res.status(500).json({ error: 'Failed to load provider jobs.' });
    }
  });

  // Create booking (customer only, identity bound from verified token)
  app.post('/api/bookings', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.auth?.role !== 'customer') {
        res.status(403).json({ error: 'Only signed-in customers can create repair bookings.' });
        return;
      }
      const customerAccount = await getUserById(req.auth.sub);
      if (!customerAccount || customerAccount.role !== 'customer') {
        res.status(401).json({ error: 'Customer account not found.' });
        return;
      }

      const {
        location,
        serviceCategory,
        selectedProblems,
        diagnosis,
        mediaPreviewDataUrl,
        mediaType,
        customerNotes,
        scheduledSlot,
        paymentMethod,
        preferredProviderId,
        preferredProviderName,
      } = req.body as {
        location: { lat: number; lng: number; address: string };
        serviceCategory: ServiceCategoryId;
        selectedProblems: string[];
        diagnosis: DiagnosisResult;
        mediaPreviewDataUrl?: string;
        mediaType?: 'image' | 'video' | 'audio';
        customerNotes?: string;
        scheduledSlot: string;
        paymentMethod: PaymentMethod;
        preferredProviderId?: string;
        preferredProviderName?: string;
      };

      if (!location || !serviceCategory || !diagnosis || !paymentMethod) {
        res.status(400).json({ error: 'Missing required booking details.' });
        return;
      }

      const booking: JobBooking = {
        id: `UF-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: customerAccount.id,
        customerName: customerAccount.name,
        customerContact: customerAccount.identifier,
        location,
        serviceCategory,
        serviceCategoryLabel: SERVICE_LABELS[serviceCategory] || diagnosis.serviceCategoryLabel,
        selectedProblems: selectedProblems || [],
        diagnosis,
        mediaPreviewDataUrl: mediaPreviewDataUrl?.slice(0, 350000),
        mediaType,
        customerNotes,
        scheduledSlot: scheduledSlot || 'Today, Next Available Slot',
        paymentMethod,
        paymentStatus: paymentMethod === 'online' ? 'paid_online' : 'pay_on_site',
        status: 'pending',
        assignedProviderId: preferredProviderId,
        assignedProviderName: preferredProviderName,
        createdAt: new Date().toISOString(),
      };

      const saved = await createBookingRecord(booking);
      res.status(201).json({ booking: saved });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to save booking.';
      res.status(500).json({ error: msg });
    }
  });

  // Update booking status (provider workflow)
  app.patch('/api/bookings/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.auth?.role !== 'provider') {
        res.status(403).json({ error: 'Only signed-in service providers can update job status.' });
        return;
      }
      const providerAccount = await getUserById(req.auth.sub);
      if (!providerAccount || providerAccount.role !== 'provider') {
        res.status(401).json({ error: 'Provider account not found.' });
        return;
      }

      const { status } = req.body as {
        status?: BookingStatus;
      };
      const validStatuses: BookingStatus[] = [
        'pending',
        'accepted',
        'en_route',
        'in_progress',
        'completed',
        'declined',
      ];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ error: 'Valid booking status is required.' });
        return;
      }

      const updated = await updateBookingStatusRecord({
        bookingId: req.params.id,
        status,
        providerId: providerAccount.id,
        providerName: providerAccount.name,
      });
      if (!updated) {
        res.status(404).json({ error: 'Booking not found.' });
        return;
      }
      res.json({ booking: updated });
    } catch {
      res.status(500).json({ error: 'Failed to update booking status.' });
    }
  });

  // Server-side Reverse Geocoding proxy (avoids client CORS Trap CF1)
  app.get('/api/geocode/reverse', requireAuth, async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
      return;
    }

    const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!mapsKey) {
      res.json({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      return;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(
        mapsKey
      )}`;
      const geoRes = await fetch(url);
      const data = (await geoRes.json()) as {
        status?: string;
        results?: Array<{ formatted_address?: string }>;
      };
      if (geoRes.status === 429 || data.status === 'OVER_QUERY_LIMIT') {
        res.status(429).json({
          error: 'Google Maps Geocoding quota exceeded.',
          address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        });
        return;
      }
      const formatted = data.results?.[0]?.formatted_address;
      res.json({ address: formatted || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    } catch {
      res.json({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    }
  });

  // Audio Transcription via Gemini API (Server-Side) using gemini-3.5-transcribe
  app.post('/api/transcribe', requireAuth, async (req, res) => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      const { audioBase64, audioMimeType, voiceLanguage } = req.body as {
        audioBase64?: string;
        audioMimeType?: string;
        voiceLanguage?: 'Kannada' | 'Hindi' | 'English';
      };

      if (!audioBase64 || !audioMimeType) {
        res.status(400).json({ error: 'Audio data and MIME type are required for transcription.' });
        return;
      }

      const ai = getGeminiClient();
      const audioPart = {
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64,
        },
      };
      const promptPart = {
        text: `Transcribe this recorded voice note accurately in the speaker's language (${voiceLanguage || 'Kannada, Hindi, or English'}). Return only the plain transcript text (if spoken in Kannada or Hindi, provide the exact spoken transcript followed by a concise English translation in parentheses if helpful).`,
      };

      const models = ['gemini-3.5-transcribe', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
      let transcript = '';
      let lastErr: unknown = null;

      for (const model of models) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: { parts: [audioPart, promptPart] },
            });
            const text = (response.text ?? '').trim();
            if (text) {
              transcript = text;
              break;
            }
          } catch (err) {
            lastErr = err;
            const msg = err instanceof Error ? err.message : String(err);
            const isTransient = /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|ETIMEDOUT|ECONNRESET/i.test(
              msg
            );
            if (isTransient && attempt === 0) {
              await sleep(700);
              continue;
            }
            break;
          }
        }
        if (transcript) break;
      }

      if (!transcript) {
        console.error('Transcription error:', lastErr);
        res.status(502).json({ error: 'Could not transcribe audio right now. You can type or run AI diagnosis directly.' });
        return;
      }

      res.json({ transcript });
    } catch (err: unknown) {
      console.error('Transcription route error:', err);
      res.status(500).json({ error: 'Failed to transcribe audio.' });
    }
  });

  // Multimodal AI Home Repair Diagnosis via Gemini API (Server-Side)
  app.post('/api/diagnose', requireAuth, async (req, res) => {
    const parseGeminiError = (err: unknown): { status: number; message: string } => {
      const fallbackMsg = 'Unable to complete AI diagnosis right now. Please try again.';
      if (!err || typeof err !== 'object') {
        return { status: 500, message: fallbackMsg };
      }

      const rawMessage = err instanceof Error ? err.message : String(err);
      let code =
        typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : 500;
      let cleanMessage = rawMessage || fallbackMsg;

      const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as {
            error?: { code?: number; message?: string; status?: string };
          };
          if (parsed?.error) {
            if (typeof parsed.error.code === 'number') code = parsed.error.code;
            if (parsed.error.message) cleanMessage = parsed.error.message;
          }
        } catch {
          // ignore malformed embedded JSON
        }
      }

      if (code === 503 || /UNAVAILABLE|high demand|overloaded/i.test(cleanMessage)) {
        return {
          status: 503,
          message:
            'The AI diagnosis model is experiencing high demand right now. Please wait a few seconds and try again.',
        };
      }
      if (code === 429 || /RESOURCE_EXHAUSTED|quota/i.test(cleanMessage)) {
        return {
          status: 429,
          message:
            'AI diagnosis request limit reached temporarily. Please wait a moment and try again, or verify your key quota in Settings > Secrets.',
        };
      }
      if (code === 403 || code === 401 || /PERMISSION_DENIED|API_KEY_INVALID|API key/i.test(cleanMessage)) {
        return {
          status: 403,
          message:
            'Gemini API key permission error. Please check your GEMINI_API_KEY in Settings > Secrets.',
        };
      }
      if (err instanceof SyntaxError || /JSON|Unterminated string|Unexpected end/i.test(cleanMessage)) {
        return {
          status: 502,
          message:
            'The AI returned an incomplete diagnosis response. Please tap Diagnose with AI again.',
        };
      }

      return { status: code >= 400 && code < 600 ? code : 500, message: cleanMessage };
    };

    const isRetryableError = (err: unknown): boolean => {
      if (err instanceof SyntaxError) return true;
      const msg = err instanceof Error ? err.message : String(err);
      const status = typeof (err as { status?: unknown })?.status === 'number'
        ? (err as { status: number }).status
        : 0;
      return (
        status === 503 ||
        status === 429 ||
        status === 502 ||
        status === 504 ||
        /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|ETIMEDOUT|ECONNRESET|fetch failed|Unterminated string|JSON|incomplete diagnosis/i.test(
          msg
        )
      );
    };

    const parseDiagnosisJson = (
      rawText: string,
      fallbackService: ServiceCategoryId
    ): DiagnosisResult => {
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned) as Partial<DiagnosisResult>;
      if (!parsed || typeof parsed !== 'object' || !parsed.likelyProblem) {
        throw new SyntaxError('Incomplete diagnosis JSON object');
      }

      const validCats: ServiceCategoryId[] = [
        'ac_appliance',
        'plumbing',
        'electrical',
        'carpentry',
        'cleaning_pest',
        'painting',
      ];
      const serviceCategory: ServiceCategoryId = validCats.includes(
        parsed.serviceCategory as ServiceCategoryId
      )
        ? (parsed.serviceCategory as ServiceCategoryId)
        : fallbackService;

      const minPrice = Number(parsed.fairPriceMinInr);
      const maxPrice = Number(parsed.fairPriceMaxInr);

      return {
        likelyProblem: String(parsed.likelyProblem).slice(0, 300),
        serviceCategory,
        serviceCategoryLabel: SERVICE_LABELS[serviceCategory],
        confidenceLabel: String(parsed.confidenceLabel || 'Moderate Confidence').slice(0, 120),
        detectedLanguage: String(parsed.detectedLanguage || 'English').slice(0, 60),
        transcriptSummary: String(parsed.transcriptSummary || parsed.likelyProblem).slice(0, 500),
        estimatedParts: Array.isArray(parsed.estimatedParts)
          ? parsed.estimatedParts.slice(0, 5).map((p) => ({
              name: String(p?.name || 'Inspection & consumable').slice(0, 140),
              estimatedCostInr: String(p?.estimatedCostInr || '₹200 – ₹400').slice(0, 60),
            }))
          : [],
        estimatedTime: String(parsed.estimatedTime || '45 – 60 mins').slice(0, 60),
        fairPriceMinInr: Number.isFinite(minPrice) && minPrice > 0 ? Math.round(minPrice) : 450,
        fairPriceMaxInr:
          Number.isFinite(maxPrice) && maxPrice > 0
            ? Math.max(Math.round(maxPrice), Number.isFinite(minPrice) ? Math.round(minPrice) : 450)
            : 950,
        safetyRiskLevel: (['Low', 'Moderate', 'High', 'Critical'].includes(
          String(parsed.safetyRiskLevel)
        )
          ? parsed.safetyRiskLevel
          : 'Moderate') as DiagnosisResult['safetyRiskLevel'],
        safetyRisks: Array.isArray(parsed.safetyRisks)
          ? parsed.safetyRisks.slice(0, 4).map((s) => String(s).slice(0, 240))
          : ['Switch off power or water supply near the affected area before inspection.'],
        preventiveMeasures: Array.isArray(parsed.preventiveMeasures)
          ? parsed.preventiveMeasures.slice(0, 4).map((s) => String(s).slice(0, 240))
          : ['Schedule periodic preventive maintenance every 6 months.'],
        recommendedQuestionsForTech: Array.isArray(parsed.recommendedQuestionsForTech)
          ? parsed.recommendedQuestionsForTech.slice(0, 4).map((s) => String(s).slice(0, 240))
          : ['Confirm spare part warranty before installation.'],
      };
    };

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      const {
        photoBase64,
        photoMimeType,
        videoBase64,
        videoMimeType,
        audioBase64,
        audioMimeType,
        voiceLanguage,
        selectedService,
        selectedProblems,
        notes,
      } = req.body as {
        photoBase64?: string;
        photoMimeType?: string;
        videoBase64?: string;
        videoMimeType?: string;
        audioBase64?: string;
        audioMimeType?: string;
        voiceLanguage?: 'Kannada' | 'Hindi' | 'English';
        selectedService?: ServiceCategoryId;
        selectedProblems?: string[];
        notes?: string;
      };

      if (
        !photoBase64 &&
        !videoBase64 &&
        !audioBase64 &&
        !notes?.trim() &&
        (!selectedProblems || selectedProblems.length === 0)
      ) {
        res.status(400).json({
          error: 'Please upload a photo, short video, record a voice note, or describe the issue.',
        });
        return;
      }

      const ai = getGeminiClient();
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (photoBase64 && photoMimeType) {
        parts.push({
          inlineData: {
            mimeType: photoMimeType,
            data: photoBase64,
          },
        });
      }
      if (videoBase64 && videoMimeType) {
        parts.push({
          inlineData: {
            mimeType: videoMimeType,
            data: videoBase64,
          },
        });
      }
      if (audioBase64 && audioMimeType) {
        parts.push({
          inlineData: {
            mimeType: audioMimeType,
            data: audioBase64,
          },
        });
      }

      const contextLines = [
        `Customer selected language preference for voice/notes: ${voiceLanguage || 'English'} (customer may speak Kannada, Hindi, or English—accurately understand and summarize concisely in English while noting the detected language).`,
        selectedService
          ? `Customer selected service category: ${SERVICE_LABELS[selectedService] || selectedService} (${selectedService})`
          : '',
        selectedProblems && selectedProblems.length > 0
          ? `Customer toggled common problems: ${selectedProblems.join('; ')}`
          : '',
        notes?.trim() ? `Customer text notes: ${notes.trim()}` : '',
        `Provide an accurate, concise home repair diagnosis, realistic Indian Rupee (INR) fair price range (labor + parts), estimated parts, realistic time required, safety risk flags, and preventive measures.`,
        `Valid serviceCategory values MUST be one of: ac_appliance, plumbing, electrical, carpentry, cleaning_pest, painting.`,
      ]
        .filter(Boolean)
        .join('\n');

      parts.push({ text: contextLines });

      const diagnosisConfig = {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are a senior master home-service diagnostician for a home repair platform in India. Inspect any uploaded photos, videos, and audio voice notes (Kannada, Hindi, or English). Return valid, compact JSON under 300 words total: keep likelyProblem under 150 characters, transcriptSummary under 220 characters, 1 to 4 estimatedParts, 1 to 3 safetyRisks, 1 to 3 preventiveMeasures, and 1 to 3 recommendedQuestionsForTech. Never repeat words, phrases, or trailing characters.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: [
            'likelyProblem',
            'serviceCategory',
            'serviceCategoryLabel',
            'confidenceLabel',
            'detectedLanguage',
            'transcriptSummary',
            'estimatedParts',
            'estimatedTime',
            'fairPriceMinInr',
            'fairPriceMaxInr',
            'safetyRiskLevel',
            'safetyRisks',
            'preventiveMeasures',
            'recommendedQuestionsForTech',
          ],
          properties: {
            likelyProblem: {
              type: Type.STRING,
              description: 'Concise diagnosis of the likely home repair fault (max 150 chars).',
            },
            serviceCategory: {
              type: Type.STRING,
              description:
                'One of: ac_appliance, plumbing, electrical, carpentry, cleaning_pest, painting',
            },
            serviceCategoryLabel: {
              type: Type.STRING,
              description: 'Human-readable service category name.',
            },
            confidenceLabel: {
              type: Type.STRING,
              description: 'e.g. High Confidence (Visual + Audio) or Moderate Confidence',
            },
            detectedLanguage: {
              type: Type.STRING,
              description: 'Kannada, Hindi, English, or Mixed',
            },
            transcriptSummary: {
              type: Type.STRING,
              description:
                'Concise English summary/translation of what the user explained (max 220 chars).',
            },
            estimatedParts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['name', 'estimatedCostInr'],
                properties: {
                  name: { type: Type.STRING },
                  estimatedCostInr: { type: Type.STRING, description: 'e.g. ₹250 – ₹450' },
                },
              },
            },
            estimatedTime: {
              type: Type.STRING,
              description: 'e.g. 45 – 75 mins',
            },
            fairPriceMinInr: {
              type: Type.INTEGER,
              description: 'Minimum fair total quote in INR including labor and parts.',
            },
            fairPriceMaxInr: {
              type: Type.INTEGER,
              description: 'Maximum fair total quote in INR including labor and parts.',
            },
            safetyRiskLevel: {
              type: Type.STRING,
              description: 'One of: Low, Moderate, High, Critical',
            },
            safetyRisks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Up to 3 immediate safety precautions for the homeowner.',
            },
            preventiveMeasures: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Up to 3 actionable preventive steps.',
            },
            recommendedQuestionsForTech: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Up to 3 verification items for the technician.',
            },
          },
        },
      };

      const modelCandidates = [
        { model: 'gemini-4-hydrogen', retries: 2, baseDelayMs: 750 },
        { model: 'gemini-3.1-flash-lite', retries: 2, baseDelayMs: 900 },
      ];

      let parsedDiagnosis: DiagnosisResult | null = null;
      let lastErr: unknown = null;

      for (const candidate of modelCandidates) {
        for (let attempt = 0; attempt <= candidate.retries; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: candidate.model,
              contents: { parts },
              config: diagnosisConfig,
            });
            const text = (response.text ?? '').trim();
            if (!text) {
              throw new Error('AI returned an empty diagnosis response.');
            }
            parsedDiagnosis = parseDiagnosisJson(text, selectedService || 'ac_appliance');
            break;
          } catch (err) {
            lastErr = err;
            if (!isRetryableError(err)) {
              throw err;
            }
            if (attempt < candidate.retries) {
              const backoff = candidate.baseDelayMs * Math.pow(2, attempt);
              await sleep(backoff);
            }
          }
        }
        if (parsedDiagnosis) break;
      }

      if (!parsedDiagnosis) {
        if (lastErr) throw lastErr;
        res.status(502).json({ error: 'AI returned an empty diagnosis response. Please try again.' });
        return;
      }

      res.json({ diagnosis: parsedDiagnosis });
    } catch (err: unknown) {
      console.error('Gemini diagnosis error:', err);
      const { status, message } = parseGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UrbanFix server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
