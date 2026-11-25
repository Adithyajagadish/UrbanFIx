import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileAudio,
  History,
  Home,
  MapPin,
  Mic,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  Upload,
  Video,
  Wallet,
  Wrench,
} from 'lucide-react';
import { SERVICES_CATALOG, SERVICE_MAP } from '../data/servicesCatalog.ts';
import type {
  CustomerAccount,
  DiagnosisResult,
  JobBooking,
  LocationPin,
  MatchedProvider,
  PaymentMethod,
  ServiceCategoryId,
} from '../types.ts';
import { LocationPinMap, type MapSecondaryPin } from './LocationPinMap.tsx';

interface CustomerWorkspaceProps {
  customer: CustomerAccount;
  authToken: string;
  activeTab: 'explore' | 'diagnose' | 'bookings';
  onTabChange: (tab: 'explore' | 'diagnose' | 'bookings') => void;
  onCustomerUpdated: (updated: CustomerAccount) => void;
  onSessionExpired: () => void;
}

const TIME_SLOTS = [
  'Today, Next 2 Hours (Express)',
  'Today, 4:00 PM – 6:00 PM',
  'Tomorrow, 9:30 AM – 11:30 AM',
  'Tomorrow, 2:00 PM – 4:00 PM',
];

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read media file.'));
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read preview.'));
    reader.readAsDataURL(file);
  });
}

interface BrowserSpeechResultAlternative {
  transcript: string;
}

interface BrowserSpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: BrowserSpeechResultAlternative;
}

interface BrowserSpeechEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: BrowserSpeechResult;
  };
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const CustomerWorkspace: React.FC<CustomerWorkspaceProps> = ({
  customer,
  authToken,
  activeTab,
  onTabChange,
  onCustomerUpdated,
  onSessionExpired,
}) => {
  const [location, setLocation] = useState<LocationPin>(customer.location);
  const [preferredServices, setPreferredServices] = useState<ServiceCategoryId[]>(
    customer.preferredServices.length > 0 ? customer.preferredServices : ['ac_appliance']
  );
  const [selectedProblems, setSelectedProblems] = useState<string[]>(customer.selectedProblems);
  const [activeProblemService, setActiveProblemService] = useState<ServiceCategoryId>(
    customer.preferredServices[0] || 'ac_appliance'
  );
  const [showMapModal, setShowMapModal] = useState(!customer.onboardingComplete);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Media upload & voice recording state
  const [voiceLanguage, setVoiceLanguage] = useState<'Kannada' | 'Hindi' | 'English'>('English');
  const [photoFile, setPhotoFile] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
    name: string;
  } | null>(null);
  const [videoFile, setVideoFile] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
    name: string;
  } | null>(null);
  const [audioClip, setAudioClip] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
    durationSec: number;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [mediaPermissionMsg, setMediaPermissionMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordStartMsRef = useRef<number>(0);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const liveTranscriptRef = useRef<string>('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  // Diagnosis & matching state
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);

  const [matchedProviders, setMatchedProviders] = useState<MatchedProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [scheduledSlot, setScheduledSlot] = useState(TIME_SLOTS[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [isBooking, setIsBooking] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<JobBooking | null>(null);

  // Customer Bookings list
  const [myBookings, setMyBookings] = useState<JobBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Mobile bottom dock active state & section anchors
  const [activeDockTab, setActiveDockTab] = useState<
    'home' | 'services' | 'diagnose' | 'pin' | 'bookings'
  >(activeTab === 'bookings' ? 'bookings' : activeTab === 'diagnose' ? 'diagnose' : 'home');
  const servicesPanelRef = useRef<HTMLDivElement | null>(null);
  const hubPanelRef = useRef<HTMLDivElement | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const diagnosePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === 'bookings') {
      setActiveDockTab('bookings');
    } else if (activeTab === 'diagnose') {
      setActiveDockTab('diagnose');
    } else if (activeDockTab === 'bookings' || activeDockTab === 'diagnose') {
      setActiveDockTab('home');
    }
  }, [activeTab, activeDockTab]);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>, block: ScrollLogicalPosition = 'start') => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block });
    }, 60);
  };

  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const res = await fetch(`/api/bookings/customer/${customer.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = (await res.json()) as { bookings?: JobBooking[] };
      setMyBookings(data.bookings || []);
    } catch {
      // ignore transient
    } finally {
      setLoadingBookings(false);
    }
  }, [customer.id, authToken, onSessionExpired]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const fetchMatchedProviders = useCallback(
    async (loc: LocationPin, category?: ServiceCategoryId) => {
      setLoadingProviders(true);
      try {
        const params = new URLSearchParams({
          lat: String(loc.lat),
          lng: String(loc.lng),
          radiusKm: String(loc.radiusKm),
        });
        if (category) params.set('serviceCategory', category);
        const res = await fetch(`/api/providers/match?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.status === 401) {
          onSessionExpired();
          return;
        }
        const data = (await res.json()) as { providers?: MatchedProvider[] };
        const list = data.providers || [];
        setMatchedProviders(list);
        if (list.length > 0) {
          setSelectedProviderId((prev) => (list.some((p) => p.id === prev) ? prev : list[0].id));
        } else {
          setSelectedProviderId('');
        }
      } catch {
        setMatchedProviders([]);
      } finally {
        setLoadingProviders(false);
      }
    },
    [authToken, onSessionExpired]
  );

  useEffect(() => {
    const cat = diagnosis?.serviceCategory || activeProblemService;
    void fetchMatchedProviders(location, cat);
  }, [location, diagnosis?.serviceCategory, activeProblemService, fetchMatchedProviders]);

  const toggleServicePreference = (id: ServiceCategoryId) => {
    setPreferredServices((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
      if (!exists) {
        setActiveProblemService(id);
      } else if (next.length > 0 && activeProblemService === id) {
        setActiveProblemService(next[0]);
      }
      return next;
    });
  };

  const toggleProblem = (problem: string) => {
    setSelectedProblems((prev) =>
      prev.includes(problem) ? prev.filter((p) => p !== problem) : [...prev, problem]
    );
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          location,
          preferredServices,
          selectedProblems,
          onboardingComplete: true,
        }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = (await res.json()) as { user?: CustomerAccount };
      if (data.user) {
        onCustomerUpdated(data.user);
      }
      setShowMapModal(false);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaPermissionMsg(null);
    if (file.size > 15 * 1024 * 1024) {
      setMediaPermissionMsg('Photo must be under 15 MB.');
      return;
    }
    const [base64, previewUrl] = await Promise.all([fileToBase64(file), fileToDataUrl(file)]);
    setPhotoFile({
      base64,
      mimeType: file.type || 'image/jpeg',
      previewUrl,
      name: file.name,
    });
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaPermissionMsg(null);
    if (file.size > 25 * 1024 * 1024) {
      setMediaPermissionMsg('Short video must be under 25 MB.');
      return;
    }
    const [base64, previewUrl] = await Promise.all([fileToBase64(file), fileToDataUrl(file)]);
    setVideoFile({
      base64,
      mimeType: file.type || 'video/mp4',
      previewUrl,
      name: file.name,
    });
  };

  const transcribeRecordedAudio = async (base64: string, mimeType: string) => {
    setIsTranscribing(true);
    setTranscriptError(null);
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          audioBase64: base64,
          audioMimeType: mimeType,
          voiceLanguage,
        }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = (await res.json()) as { transcript?: string; error?: string };
      if (res.ok && data.transcript) {
        liveTranscriptRef.current = data.transcript;
        setLiveTranscript(data.transcript);
        setInterimTranscript('');
      } else if (!liveTranscriptRef.current) {
        setTranscriptError(
          data.error || 'Could not auto-transcribe audio; AI diagnosis will still analyze it.'
        );
      }
    } catch {
      if (!liveTranscriptRef.current) {
        setTranscriptError('Audio saved; AI diagnosis will analyze the recording directly.');
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaPermissionMsg(null);
    if (file.size > 15 * 1024 * 1024) {
      setMediaPermissionMsg('Audio file must be under 15 MB.');
      return;
    }
    const [base64, previewUrl] = await Promise.all([fileToBase64(file), fileToDataUrl(file)]);
    const mimeType = file.type || 'audio/webm';
    liveTranscriptRef.current = '';
    setLiveTranscript('');
    setInterimTranscript('');
    setTranscriptError(null);
    setAudioClip({
      base64,
      mimeType,
      previewUrl,
      durationSec: 0,
    });
    void transcribeRecordedAudio(base64, mimeType);
  };

  const startVoiceRecording = async () => {
    setMediaPermissionMsg(null);
    setTranscriptError(null);
    setLiveTranscript('');
    setInterimTranscript('');
    liveTranscriptRef.current = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaPermissionMsg(
        'Microphone recording is not supported in this browser. Upload an audio file instead.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - recordStartMsRef.current) / 1000)
        );
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const mimeType = blob.type || 'audio/webm';
        const [base64, previewUrl] = await Promise.all([fileToBase64(blob), fileToDataUrl(blob)]);
        setAudioClip({
          base64,
          mimeType,
          previewUrl,
          durationSec,
        });
        void transcribeRecordedAudio(base64, mimeType);
      };
      mediaRecorderRef.current = recorder;
      recordStartMsRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      // Start live browser SpeechRecognition alongside MediaRecorder for instant live captions
      const SpeechRecCtor = (
        window as unknown as {
          SpeechRecognition?: new () => BrowserSpeechRecognition;
          webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
        }
      ).SpeechRecognition ||
        (
          window as unknown as {
            webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
          }
        ).webkitSpeechRecognition;

      if (SpeechRecCtor) {
        try {
          const recognition = new SpeechRecCtor();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang =
            voiceLanguage === 'Kannada'
              ? 'kn-IN'
              : voiceLanguage === 'Hindi'
              ? 'hi-IN'
              : 'en-IN';
          recognition.onresult = (event) => {
            let finalText = '';
            let interimText = '';
            for (let i = 0; i < event.results.length; i++) {
              const resItem = event.results[i];
              const chunk = resItem[0]?.transcript || '';
              if (resItem.isFinal) {
                finalText += `${chunk} `;
              } else {
                interimText += chunk;
              }
            }
            const cleanFinal = finalText.trim();
            liveTranscriptRef.current = cleanFinal;
            setLiveTranscript(cleanFinal);
            setInterimTranscript(interimText.trim());
          };
          recognition.onerror = () => {
            // Silent fallback to server transcription after recording finishes
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // Ignore SpeechRecognition startup error; server transcription handles it cleanly
        }
      }
    } catch {
      setMediaPermissionMsg(
        'Microphone access denied. Allow mic permission in browser settings or upload an audio clip.'
      );
    }
  };

  const stopVoiceRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }
    setInterimTranscript('');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleRunDiagnosis = async () => {
    setDiagnosisError(null);
    setConfirmedBooking(null);
    setIsDiagnosing(true);
    try {
      const combinedNotes = [
        notes.trim(),
        liveTranscript.trim() ? `Voice transcript: ${liveTranscript.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          photoBase64: photoFile?.base64,
          photoMimeType: photoFile?.mimeType,
          videoBase64: videoFile?.base64,
          videoMimeType: videoFile?.mimeType,
          audioBase64: audioClip?.base64,
          audioMimeType: audioClip?.mimeType,
          voiceLanguage,
          selectedService: activeProblemService,
          selectedProblems,
          notes: combinedNotes,
        }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const raw = await res.text();
      let data: { diagnosis?: DiagnosisResult; error?: string } = {};
      try {
        data = JSON.parse(raw) as { diagnosis?: DiagnosisResult; error?: string };
      } catch {
        setDiagnosisError(
          res.status === 413
            ? 'Uploaded media is too large. Please keep photo/video under 20 MB.'
            : 'Unable to parse diagnosis response. Please try again.'
        );
        return;
      }
      if (!res.ok || !data.diagnosis) {
        setDiagnosisError(data.error || 'Unable to generate AI diagnosis.');
        return;
      }
      setDiagnosis(data.diagnosis);
      setActiveProblemService(data.diagnosis.serviceCategory);
      await fetchMatchedProviders(location, data.diagnosis.serviceCategory);
    } catch {
      setDiagnosisError('Network error while analyzing media. Please try again.');
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!diagnosis) return;
    setIsBooking(true);
    setDiagnosisError(null);
    try {
      const chosenProvider = matchedProviders.find((p) => p.id === selectedProviderId);
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          location: {
            lat: location.lat,
            lng: location.lng,
            address: location.address,
          },
          serviceCategory: diagnosis.serviceCategory,
          selectedProblems,
          diagnosis,
          mediaPreviewDataUrl: photoFile?.previewUrl,
          mediaType: photoFile ? 'image' : videoFile ? 'video' : audioClip ? 'audio' : undefined,
          customerNotes: notes,
          scheduledSlot,
          paymentMethod,
          preferredProviderId: chosenProvider?.id,
          preferredProviderName: chosenProvider?.name,
        }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = (await res.json()) as { booking?: JobBooking; error?: string };
      if (!res.ok || !data.booking) {
        setDiagnosisError(data.error || 'Booking confirmation failed.');
        return;
      }
      setConfirmedBooking(data.booking);
      await fetchBookings();
    } catch {
      setDiagnosisError('Network error while confirming booking.');
    } finally {
      setIsBooking(false);
    }
  };

  const providerPins: MapSecondaryPin[] = matchedProviders.map((p) => ({
    id: p.id,
    lat: p.location.lat,
    lng: p.location.lng,
    title: p.name,
    subtitle: `${p.experienceYears} yrs exp · ★ ${p.rating}`,
    meta: `${p.distanceKm} km away`,
  }));

  const currentCatalogService = SERVICE_MAP[activeProblemService];

  return (
    <div className="bg-obsidian-glow min-h-[calc(100vh-120px)] pb-24 lg:pb-12">
      {activeTab === 'bookings' ? (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <p className="text-xs font-medium text-[#A78BFA]">Activity &amp; Tracking</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-white">My Bookings</h1>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveDockTab('diagnose');
                onTabChange('diagnose');
                scrollToRef(diagnosePanelRef);
              }}
              className="btn-violet-primary inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" />
              <span>New AI Diagnosis</span>
            </button>
          </div>

          {loadingBookings ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading your bookings...</div>
          ) : myBookings.length === 0 ? (
            <div className="surface-card mt-8 rounded-3xl p-10 text-center">
              <Wrench className="mx-auto h-8 w-8 text-[#A78BFA]" />
              <h2 className="mt-3 font-display text-lg font-semibold text-white">No bookings yet</h2>
              <p className="mt-1 text-sm text-slate-400">
                Upload a photo, video, or voice note to diagnose an issue and book a technician.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveDockTab('diagnose');
                  onTabChange('diagnose');
                  scrollToRef(diagnosePanelRef);
                }}
                className="btn-violet-primary mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              >
                Start AI Diagnosis
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {myBookings.map((b) => (
                <div key={b.id} className="surface-card rounded-3xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-mono font-semibold text-white">{b.id}</span>
                        <span>·</span>
                        <span>{b.serviceCategoryLabel}</span>
                        <span>·</span>
                        <span>{b.scheduledSlot}</span>
                      </div>
                      <h3 className="mt-1.5 font-display text-lg font-semibold text-white">
                        {b.diagnosis.likelyProblem}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">{b.location.address}</p>
                    </div>

                    <div className="text-right">
                      <span className="inline-block rounded-lg border border-white/10 bg-[#22222F] px-2.5 py-1 text-xs font-semibold capitalize text-[#A78BFA]">
                        {b.status.replace('_', ' ')}
                      </span>
                      <p className="mt-1.5 font-mono text-sm font-semibold text-white tabular-nums">
                        ₹{b.diagnosis.fairPriceMinInr} – ₹{b.diagnosis.fairPriceMaxInr}
                      </p>
                      <p className="text-[11px] text-emerald-400">
                        {b.paymentMethod === 'online' ? 'Paid Online' : 'Cash on Site'}
                      </p>
                    </div>
                  </div>

                  {b.assignedProviderName && (
                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3 text-xs text-slate-300">
                      <span>
                        Technician: <strong className="text-white">{b.assignedProviderName}</strong>
                      </span>
                      <span className="text-slate-400">
                        Safety Level: {b.diagnosis.safetyRiskLevel}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          {/* Hidden File Inputs for Media Access */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void handlePhotoUpload(e)}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => void handleVideoUpload(e)}
            className="hidden"
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => void handleAudioUpload(e)}
            className="hidden"
          />

          {/* 3-Panel Framework Matching Attached Reference Image */}
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
            {/* PANEL 1 (Left 4 cols): Service Preferences Toggle & Specific Common Problems Toggle */}
            <div
              ref={servicesPanelRef}
              className="surface-card space-y-5 scroll-mt-20 rounded-3xl p-5 lg:col-span-4"
            >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400">Step 1 · Service Preferences</p>
                <h2 className="font-display text-lg font-bold text-white">
                  What needs repair?
                </h2>
              </div>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                {preferredServices.length} selected
              </span>
            </div>

            {/* Service Categories Toggle List (Styled like Reference List Rows) */}
            <div className="space-y-2">
              {SERVICES_CATALOG.map((svc) => {
                const isPreferred = preferredServices.includes(svc.id);
                const isFocused = activeProblemService === svc.id;
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => {
                      toggleServicePreference(svc.id);
                      setActiveProblemService(svc.id);
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-all ${
                      isFocused
                        ? 'border-[#7C5CFF] bg-[#221E38]'
                        : isPreferred
                        ? 'border-white/20 bg-[#1B1B28]'
                        : 'border-white/[0.06] bg-[#171722] hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          isPreferred
                            ? 'bg-[#7C5CFF] text-white'
                            : 'bg-[#252536] text-slate-300'
                        }`}
                      >
                        {isPreferred ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Wrench className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {svc.shortName}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {svc.tagline}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 pl-2 text-right">
                      <p className="font-mono text-xs font-semibold text-white tabular-nums">
                        ₹{svc.baseVisitFeeInr}
                      </p>
                      <p className="font-mono text-[11px] text-emerald-400 tabular-nums">
                        {svc.typicalTime}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Toggle Menu 2: Specific Common Problems for Active Service */}
            <div className="surface-elevated rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-white">
                    Common Problems · {currentCatalogService.shortName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Toggle symptoms to refine AI quote
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[#A78BFA] tabular-nums">
                  {selectedProblems.length}
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                {currentCatalogService.commonProblems.map((prob) => {
                  const selected = selectedProblems.includes(prob);
                  return (
                    <button
                      key={prob}
                      type="button"
                      onClick={() => toggleProblem(prob)}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                        selected
                          ? 'border-[#7C5CFF]/70 bg-[#2B244D] font-medium text-white'
                          : 'border-white/[0.06] bg-[#14141D] text-slate-300 hover:bg-[#1B1B28]'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                          selected
                            ? 'bg-[#7C5CFF] text-white'
                            : 'border border-white/20 bg-transparent'
                        }`}
                      >
                        {selected && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span>{prob}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PANEL 2 (Center 4 cols): Customer Hub, 4-Square Media Grid & Pin-Drop Location Map */}
          <div
            ref={hubPanelRef}
            className="surface-card space-y-5 scroll-mt-20 rounded-3xl p-5 lg:col-span-4"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 95% 42% at 50% 0%, rgba(124, 92, 255, 0.25), transparent 68%)',
            }}
          >
            {/* User Profile Header matching Center Screen */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="btn-violet-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white">
                  {customer.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-slate-300">{customer.identifier}</p>
                  <p className="truncate text-sm font-semibold text-white">{customer.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onTabChange('bookings')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                title="Booking History"
              >
                <History className="h-4 w-4" />
              </button>
            </div>

            {/* Big Hero Quote / Service Readout */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">
                  {diagnosis ? 'AI Fair Quote Estimate' : `${currentCatalogService.shortName} Visit`}
                </span>
                <select
                  aria-label="Voice language"
                  value={voiceLanguage}
                  onChange={(e) =>
                    setVoiceLanguage(e.target.value as 'Kannada' | 'Hindi' | 'English')
                  }
                  className="rounded-lg border border-white/15 bg-[#1B1B28] px-2.5 py-1 text-[11px] font-semibold text-white focus:outline-none"
                >
                  <option value="English">EN · English</option>
                  <option value="Kannada">KN · ಕನ್ನಡ</option>
                  <option value="Hindi">HI · हिन्दी</option>
                </select>
              </div>
              <p className="mt-1 font-mono text-3xl font-bold tracking-tight text-white tabular-nums sm:text-4xl">
                {diagnosis
                  ? `₹${diagnosis.fairPriceMinInr} – ₹${diagnosis.fairPriceMaxInr}`
                  : `₹${currentCatalogService.baseVisitFeeInr}.00+`}
              </p>
              <p className="mt-1 font-mono text-xs font-medium text-emerald-400 tabular-nums">
                {diagnosis
                  ? `${diagnosis.estimatedTime} · ${diagnosis.safetyRiskLevel} Safety Risk`
                  : `+${matchedProviders.length} pros active within ${location.radiusKm} km`}
              </p>
            </div>

            {/* 4-Square Quick Action Grid (Photo, Video, Voice, Pin Map) */}
            <div className="grid grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className={`flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition-colors ${
                  photoFile
                    ? 'border-[#7C5CFF] bg-[#282246]'
                    : 'border-white/[0.08] bg-[#1E1E2B] hover:bg-[#262637]'
                }`}
              >
                <Camera className="h-4 w-4 text-white" />
                <span className="text-[11px] font-medium text-slate-200">
                  {photoFile ? 'Photo ✓' : 'Photo'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className={`flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition-colors ${
                  videoFile
                    ? 'border-[#7C5CFF] bg-[#282246]'
                    : 'border-white/[0.08] bg-[#1E1E2B] hover:bg-[#262637]'
                }`}
              >
                <Video className="h-4 w-4 text-white" />
                <span className="text-[11px] font-medium text-slate-200">
                  {videoFile ? 'Video ✓' : 'Video'}
                </span>
              </button>

              <button
                type="button"
                onClick={isRecording ? stopVoiceRecording : () => void startVoiceRecording()}
                className={`flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition-colors ${
                  isRecording
                    ? 'border-red-400 bg-red-500/20 text-red-200'
                    : audioClip
                    ? 'border-[#7C5CFF] bg-[#282246]'
                    : 'border-white/[0.08] bg-[#1E1E2B] hover:bg-[#262637]'
                }`}
              >
                {isRecording ? (
                  <Square className="h-4 w-4 fill-current text-red-300" />
                ) : (
                  <Mic className="h-4 w-4 text-white" />
                )}
                <span className="text-[11px] font-medium text-slate-200">
                  {isRecording ? `${recordSeconds}s` : audioClip ? 'Voice ✓' : 'Voice'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowMapModal((v) => !v)}
                className={`flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition-colors ${
                  showMapModal
                    ? 'border-[#7C5CFF] bg-[#282246]'
                    : 'border-white/[0.08] bg-[#1E1E2B] hover:bg-[#262637]'
                }`}
              >
                <MapPin className="h-4 w-4 text-white" />
                <span className="text-[11px] font-medium text-slate-200">Map Pin</span>
              </button>
            </div>

            {/* Pinned Location Bar (like Available balance + Add funds) */}
            <div
              ref={mapSectionRef}
              className="surface-elevated flex scroll-mt-20 items-center justify-between gap-3 rounded-2xl px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400">
                  Service Radius · {location.radiusKm} km
                </p>
                <p className="truncate text-xs font-semibold text-white">{location.address}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal((v) => !v)}
                className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 whitespace-nowrap"
              >
                {showMapModal ? 'Done' : 'Pin Drop'}
              </button>
            </div>

            {/* Expandable Pin-Drop Map */}
            {showMapModal && (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#101018] p-3">
                <LocationPinMap
                  value={location}
                  onChange={setLocation}
                  authToken={authToken}
                  secondaryPins={providerPins}
                  heightClass="h-56"
                />
                <button
                  type="button"
                  onClick={() => void handleSavePreferences()}
                  disabled={savingPrefs}
                  className="btn-violet-primary min-h-[42px] w-full rounded-xl px-4 py-2 text-xs font-semibold text-white"
                >
                  {savingPrefs ? 'Saving Pin & Preferences...' : 'Save Pin & Preferences'}
                </button>
              </div>
            )}

            {/* Matched Technicians List */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-white">
                  Matched Technicians Nearby
                </h3>
                <span className="text-xs text-slate-400">
                  {loadingProviders ? 'Scanning...' : `${matchedProviders.length} in radius`}
                </span>
              </div>

              {matchedProviders.length === 0 ? (
                <p className="mt-2.5 rounded-2xl border border-white/[0.08] bg-[#181824] p-3.5 text-xs text-slate-400">
                  No specialist inside {location.radiusKm} km yet—widen your map radius or confirm
                  booking to notify nearby partners.
                </p>
              ) : (
                <div className="mt-2.5 space-y-2">
                  {matchedProviders.map((prov) => {
                    const selected = selectedProviderId === prov.id;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => setSelectedProviderId(prov.id)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
                          selected
                            ? 'border-[#7C5CFF] bg-[#221E38]'
                            : 'border-white/[0.06] bg-[#181824] hover:bg-[#1E1E2D]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-white">
                              {prov.name}
                            </span>
                            <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-amber-300">
                              <Star className="h-3 w-3 fill-amber-300" />
                              {prov.rating}
                            </span>
                          </div>
                          <p className="truncate text-[11px] text-slate-400">
                            {prov.experienceYears}y exp · {prov.certifications[0]}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-xs font-semibold text-[#A78BFA] tabular-nums">
                            {prov.distanceKm} km
                          </p>
                          <p className="text-[11px] text-emerald-400">
                            {selected ? 'Selected' : 'Select'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* PANEL 3 (Right 4 cols): Stacked Multimodal Input -> AI Quote & Cost Breakdown -> Book */}
          <div
            ref={diagnosePanelRef}
            className="surface-card space-y-4 scroll-mt-20 rounded-3xl p-5 lg:col-span-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] text-slate-400">Multimodal AI Quote</p>
                <h2 className="font-display text-lg font-bold text-white">
                  Diagnose &amp; Confirm
                </h2>
              </div>
              <select
                aria-label="Diagnosis voice language"
                value={voiceLanguage}
                onChange={(e) =>
                  setVoiceLanguage(e.target.value as 'Kannada' | 'Hindi' | 'English')
                }
                className="rounded-lg border border-white/15 bg-[#1B1B28] px-2.5 py-1 text-[11px] font-semibold text-[#A78BFA] focus:border-[#7C5CFF] focus:outline-none"
              >
                <option value="English">English</option>
                <option value="Kannada">Kannada</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>

            {mediaPermissionMsg && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {mediaPermissionMsg}
              </p>
            )}

            {/* Stacked Pair Blocks + Center Action Button (Mirrors Screen 3) */}
            <div className="relative space-y-2">
              {/* Top Input Block */}
              <div className="surface-elevated rounded-2xl p-4">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Issue Media &amp; Description</span>
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-[#A78BFA] hover:underline"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Upload audio file</span>
                  </button>
                </div>

                {/* Multimodal Input Options: Photo Upload, Video Upload, Audio Recording */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className={`flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-colors ${
                      photoFile
                        ? 'border-[#7C5CFF] bg-[#282246] text-white'
                        : 'border-white/10 bg-[#14141D] text-slate-200 hover:border-[#7C5CFF]/60 hover:bg-[#1D1D2B]'
                    }`}
                  >
                    <Camera className="h-4 w-4 text-[#A78BFA]" />
                    <span className="text-[11px] font-semibold leading-tight">
                      {photoFile ? 'Photo Ready' : 'Photo Upload'}
                    </span>
                    <span className="text-[10px] text-slate-400">JPG / PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className={`flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-colors ${
                      videoFile
                        ? 'border-[#7C5CFF] bg-[#282246] text-white'
                        : 'border-white/10 bg-[#14141D] text-slate-200 hover:border-[#7C5CFF]/60 hover:bg-[#1D1D2B]'
                    }`}
                  >
                    <Video className="h-4 w-4 text-[#A78BFA]" />
                    <span className="text-[11px] font-semibold leading-tight">
                      {videoFile ? 'Video Ready' : 'Video Upload'}
                    </span>
                    <span className="text-[10px] text-slate-400">Short clip</span>
                  </button>

                  <button
                    type="button"
                    onClick={isRecording ? stopVoiceRecording : () => void startVoiceRecording()}
                    className={`flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-colors ${
                      isRecording
                        ? 'border-red-400 bg-red-500/20 text-red-100'
                        : audioClip
                        ? 'border-[#7C5CFF] bg-[#282246] text-white'
                        : 'border-white/10 bg-[#14141D] text-slate-200 hover:border-[#7C5CFF]/60 hover:bg-[#1D1D2B]'
                    }`}
                  >
                    {isRecording ? (
                      <Square className="h-4 w-4 fill-current text-red-300" />
                    ) : (
                      <Mic className="h-4 w-4 text-[#A78BFA]" />
                    )}
                    <span className="text-[11px] font-semibold leading-tight tabular-nums">
                      {isRecording
                        ? `Stop (${recordSeconds}s)`
                        : audioClip
                        ? 'Audio Ready'
                        : 'Record Audio'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isRecording ? 'Listening...' : voiceLanguage}
                    </span>
                  </button>
                </div>

                {/* Live Speech Transcript While Recording */}
                {isRecording && (
                  <div className="mt-2.5 rounded-xl border border-red-400/35 bg-red-500/10 p-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-red-200">
                        Recording in {voiceLanguage} ({recordSeconds}s)
                      </span>
                      <button
                        type="button"
                        onClick={stopVoiceRecording}
                        className="font-semibold text-red-300 underline hover:text-white"
                      >
                        Stop
                      </button>
                    </div>
                    <p className="mt-1.5 min-h-[20px] text-xs leading-relaxed text-white">
                      {liveTranscript || interimTranscript ? (
                        <>
                          <span>{liveTranscript}</span>
                          {interimTranscript && (
                            <span className="text-slate-300 italic">
                              {liveTranscript ? ' ' : ''}
                              {interimTranscript}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-300">
                          Listening... your spoken words will transcribe here.
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {/* Attached Media Previews */}
                {(photoFile || videoFile || audioClip) && (
                  <div className="mt-2.5 space-y-2">
                    {photoFile && (
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-[#12121A] p-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={photoFile.previewUrl}
                            alt="Issue preview"
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                          <span className="truncate text-xs text-white">{photoFile.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPhotoFile(null)}
                          className="text-[11px] text-slate-400 hover:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {videoFile && (
                      <div className="rounded-xl bg-[#12121A] p-2">
                        <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                          <span className="inline-flex items-center gap-1.5 truncate text-xs text-white">
                            <Video className="h-3.5 w-3.5 shrink-0 text-[#A78BFA]" />
                            <span className="truncate">{videoFile.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setVideoFile(null)}
                            className="shrink-0 text-[11px] text-slate-400 hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                        <video
                          controls
                          src={videoFile.previewUrl}
                          className="max-h-32 w-full rounded-lg bg-black"
                        />
                      </div>
                    )}
                    {audioClip && (
                      <div className="rounded-xl bg-[#12121A] p-2.5">
                        <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            <FileAudio className="h-3.5 w-3.5 text-[#A78BFA]" />
                            Voice ({voiceLanguage}
                            {audioClip.durationSec > 0 ? ` · ${audioClip.durationSec}s` : ''})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAudioClip(null);
                              setLiveTranscript('');
                              setInterimTranscript('');
                              setTranscriptError(null);
                              liveTranscriptRef.current = '';
                            }}
                            className="text-slate-400 hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                        <audio controls src={audioClip.previewUrl} className="h-8 w-full" />

                        <div className="mt-2 rounded-lg border border-white/[0.06] bg-[#181823] p-2.5">
                          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#A78BFA]">
                            <span>Transcribed Text</span>
                            {isTranscribing && (
                              <span className="text-emerald-400 normal-case">
                                Transcribing audio...
                              </span>
                            )}
                          </div>
                          {liveTranscript ? (
                            <textarea
                              rows={2}
                              value={liveTranscript}
                              onChange={(e) => {
                                liveTranscriptRef.current = e.target.value;
                                setLiveTranscript(e.target.value);
                              }}
                              aria-label="Transcribed audio text"
                              className="mt-1.5 w-full resize-none rounded-md border border-white/10 bg-[#111119] px-2.5 py-1.5 text-xs leading-relaxed text-white focus:border-[#7C5CFF] focus:outline-none"
                            />
                          ) : isTranscribing ? (
                            <p className="mt-1 text-xs text-slate-400">
                              Converting your {voiceLanguage} voice recording to text...
                            </p>
                          ) : transcriptError ? (
                            <p className="mt-1 text-[11px] text-slate-400">{transcriptError}</p>
                          ) : (
                            <p className="mt-1 text-[11px] text-slate-400">
                              No speech detected in recording.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    voiceLanguage === 'Kannada'
                      ? 'ಕನ್ನಡ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ವಿವರಿಸಿ...'
                      : voiceLanguage === 'Hindi'
                      ? 'हिन्दी या अंग्रेजी में समस्या लिखें...'
                      : 'Describe leak, sparks, noise, or upload photo/video/voice...'
                  }
                  className="mt-2.5 w-full rounded-xl border border-white/10 bg-[#12121A] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#7C5CFF] focus:outline-none"
                />
              </div>

              {/* Center Swap / Diagnose Icon */}
              <div className="flex justify-center -my-3 relative z-10">
                <button
                  type="button"
                  onClick={() => void handleRunDiagnosis()}
                  disabled={isDiagnosing}
                  title="Run AI Diagnosis"
                  className="flex h-10 w-10 items-center justify-center rounded-full border-4 border-[#14141D] bg-[#2B244D] text-[#A78BFA] shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
                >
                  <ArrowDownUp className="h-4 w-4" />
                </button>
              </div>

              {/* Bottom AI Quote Output Block */}
              <div className="surface-elevated rounded-2xl p-4">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{diagnosis ? diagnosis.serviceCategoryLabel : 'Estimated Fair Range'}</span>
                  <span className="text-emerald-400">
                    {diagnosis ? diagnosis.detectedLanguage : 'Ready'}
                  </span>
                </div>
                {diagnosis ? (
                  <>
                    <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
                      ₹{diagnosis.fairPriceMinInr} – ₹{diagnosis.fairPriceMaxInr}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-200">
                      {diagnosis.likelyProblem}
                    </p>
                    {diagnosis.transcriptSummary &&
                      diagnosis.transcriptSummary !== diagnosis.likelyProblem && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                          {diagnosis.transcriptSummary}
                        </p>
                      )}
                  </>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Tap <strong className="text-white">Diagnose with AI</strong> below to calculate
                    parts, repair time, fair price range, and safety risks.
                  </p>
                )}
              </div>
            </div>

            {diagnosisError && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {diagnosisError}
              </p>
            )}

            {!diagnosis ? (
              <button
                type="button"
                onClick={() => void handleRunDiagnosis()}
                disabled={isDiagnosing}
                className="btn-violet-primary flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-all disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                <span>{isDiagnosing ? 'Analyzing Media...' : 'Diagnose with AI'}</span>
              </button>
            ) : (
              <>
                {/* Cost Breakdown Table (Exact Structure of Screen 3) */}
                <div className="space-y-2.5 border-t border-white/[0.08] pt-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Confidence</span>
                    <span className="text-right font-medium text-slate-200">
                      {diagnosis.confidenceLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Estimated Time</span>
                    <span className="inline-flex items-center gap-1 font-mono font-semibold text-white tabular-nums">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {diagnosis.estimatedTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Safety Risk</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        diagnosis.safetyRiskLevel === 'Critical' ||
                        diagnosis.safetyRiskLevel === 'High'
                          ? 'text-red-400'
                          : diagnosis.safetyRiskLevel === 'Moderate'
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {diagnosis.safetyRiskLevel}
                    </span>
                  </div>
                  {diagnosis.estimatedParts?.map((part, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span className="truncate text-slate-400">{part.name}</span>
                      <span className="shrink-0 font-mono text-white tabular-nums">
                        {part.estimatedCostInr}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Safety & Preventive Measures Accordion/Cards */}
                <div className="space-y-2">
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <p className="font-semibold text-amber-300">Safety Precautions</p>
                    <ul className="mt-1 space-y-1 text-[11px]">
                      {diagnosis.safetyRisks.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                    <p className="flex items-center gap-1 font-semibold text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Preventive Measures
                    </p>
                    <ul className="mt-1 space-y-1 text-[11px]">
                      {diagnosis.preventiveMeasures.map((pm, i) => (
                        <li key={i}>• {pm}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {confirmedBooking ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                      <div>
                        <p className="text-sm font-bold text-white">
                          Booking {confirmedBooking.id} Confirmed
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          {confirmedBooking.scheduledSlot} ·{' '}
                          {confirmedBooking.paymentMethod === 'online'
                            ? 'Paid Online'
                            : 'Cash on Site'}
                        </p>
                        <button
                          type="button"
                          onClick={() => onTabChange('bookings')}
                          className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:underline"
                        >
                          <span>View in Bookings</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 border-t border-white/[0.08] pt-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Schedule Slot</span>
                      </label>
                      <select
                        value={scheduledSlot}
                        onChange={(e) => setScheduledSlot(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#1C1C27] px-3 py-2 text-xs text-white"
                      >
                        {TIME_SLOTS.map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('online')}
                        className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                          paymentMethod === 'online'
                            ? 'border-[#7C5CFF] bg-[#282246] text-white'
                            : 'border-white/10 bg-[#1C1C27] text-slate-300'
                        }`}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Online Pay</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash_on_site')}
                        className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                          paymentMethod === 'cash_on_site'
                            ? 'border-[#7C5CFF] bg-[#282246] text-white'
                            : 'border-white/10 bg-[#1C1C27] text-slate-300'
                        }`}
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        <span>Cash on Site</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRunDiagnosis()}
                        disabled={isDiagnosing}
                        className="min-h-[46px] rounded-2xl border border-white/10 bg-[#22222F] px-3 text-xs font-semibold text-white hover:bg-[#2C2C3D]"
                      >
                        Re-Analyze
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleConfirmBooking()}
                        disabled={isBooking}
                        className="btn-violet-primary min-h-[46px] rounded-2xl px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {isBooking ? 'Booking...' : 'Confirm Booking'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Compact Mobile Bottom Dock matching Reference Image (5 tabs) */}
      <nav
        aria-label="Customer bottom navigation"
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-white/10 bg-[#0E0E15]/95 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-center py-1.5">
          {[
            {
              id: 'home' as const,
              label: 'Home',
              Icon: Home,
              action: () => {
                setActiveDockTab('home');
                onTabChange('explore');
                scrollToRef(hubPanelRef);
              },
            },
            {
              id: 'services' as const,
              label: 'Services',
              Icon: Wrench,
              action: () => {
                setActiveDockTab('services');
                onTabChange('explore');
                scrollToRef(servicesPanelRef);
              },
            },
            {
              id: 'diagnose' as const,
              label: 'Diagnose',
              Icon: Sparkles,
              action: () => {
                setActiveDockTab('diagnose');
                onTabChange('diagnose');
                scrollToRef(diagnosePanelRef);
              },
            },
            {
              id: 'pin' as const,
              label: 'Map Pin',
              Icon: MapPin,
              action: () => {
                setActiveDockTab('pin');
                onTabChange('explore');
                setShowMapModal(true);
                scrollToRef(mapSectionRef, 'center');
              },
            },
            {
              id: 'bookings' as const,
              label: 'Activity',
              Icon: History,
              action: () => {
                setActiveDockTab('bookings');
                onTabChange('bookings');
                void fetchBookings();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              },
            },
          ].map(({ id, label, Icon, action }) => {
            const active = activeDockTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={action}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center py-1 text-[10px] font-medium transition-colors"
              >
                <span
                  className={`relative flex h-7 w-9 items-center justify-center rounded-xl transition-colors ${
                    active ? 'bg-[#7C5CFF]/25 text-[#A78BFA]' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {id === 'bookings' && myBookings.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#7C5CFF] px-1 font-mono text-[9px] font-bold text-white tabular-nums">
                      {myBookings.length}
                    </span>
                  )}
                </span>
                <span className={`mt-0.5 ${active ? 'text-white' : 'text-slate-400'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
