import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
  Navigation,
  Plus,
  ShieldCheck,
  UserCog,
  Wrench,
  X,
} from 'lucide-react';
import {
  PROVIDER_CERTIFICATION_OPTIONS,
  SERVICES_CATALOG,
} from '../data/servicesCatalog.ts';
import type {
  BookingStatus,
  JobBooking,
  LocationPin,
  ProviderAccount,
  ServiceCategoryId,
} from '../types.ts';
import { LocationPinMap, type MapSecondaryPin } from './LocationPinMap.tsx';

interface ProviderWorkspaceProps {
  provider: ProviderAccount;
  authToken: string;
  onProviderUpdated: (updated: ProviderAccount) => void;
  onSessionExpired: () => void;
}

export const ProviderWorkspace: React.FC<ProviderWorkspaceProps> = ({
  provider,
  authToken,
  onProviderUpdated,
  onSessionExpired,
}) => {
  const [activeView, setActiveView] = useState<'requests' | 'profile'>(
    provider.onboardingComplete ? 'requests' : 'profile'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');

  // Profile / Onboarding Form State
  const [name, setName] = useState(provider.name);
  const [services, setServices] = useState<ServiceCategoryId[]>(provider.services);
  const [skills, setSkills] = useState<string[]>(provider.skills);
  const [newSkill, setNewSkill] = useState('');
  const [experienceYears, setExperienceYears] = useState<number>(provider.experienceYears);
  const [certifications, setCertifications] = useState<string[]>(provider.certifications);
  const [customCert, setCustomCert] = useState('');
  const [location, setLocation] = useState<LocationPin>(provider.location);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // Job Requests within Provider's Radius
  const [jobs, setJobs] = useState<JobBooking[]>([]);
  const [outOfRadiusCount, setOutOfRadiusCount] = useState(0);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);

  const fetchRadiusJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch(`/api/bookings/provider/${provider.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = (await res.json()) as {
        jobs?: JobBooking[];
        outOfRadiusCount?: number;
      };
      setJobs(data.jobs || []);
      setOutOfRadiusCount(data.outOfRadiusCount || 0);
    } catch {
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, [provider.id, authToken, onSessionExpired]);

  useEffect(() => {
    void fetchRadiusJobs();
  }, [fetchRadiusJobs]);

  const toggleService = (id: ServiceCategoryId) => {
    setServices((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((s) => s !== id) : prev) : [...prev, id]
    );
  };

  const toggleCertification = (cert: string) => {
    setCertifications((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed) return;
    if (!skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setNewSkill('');
  };

  const handleAddCert = () => {
    const trimmed = customCert.trim();
    if (!trimmed) return;
    if (!certifications.includes(trimmed)) {
      setCertifications((prev) => [...prev, trimmed]);
    }
    setCustomCert('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await fetch(`/api/providers/${provider.id}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name,
          services,
          skills,
          experienceYears,
          certifications,
          location,
          onboardingComplete: true,
        }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      const data = (await res.json()) as { user?: ProviderAccount };
      if (data.user) {
        onProviderUpdated(data.user);
        setProfileMessage(
          'Profile & service radius saved. Showing customer problems within your coverage radius.'
        );
        await fetchRadiusJobs();
        setActiveView('requests');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateJobStatus = async (jobId: string, status: BookingStatus) => {
    setUpdatingJobId(jobId);
    try {
      const res = await fetch(`/api/bookings/${jobId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          status,
        }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      if (res.ok) {
        await fetchRadiusJobs();
      }
    } finally {
      setUpdatingJobId(null);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (statusFilter === 'pending') return job.status === 'pending';
    if (statusFilter === 'active')
      return job.status === 'accepted' || job.status === 'en_route' || job.status === 'in_progress';
    if (statusFilter === 'completed') return job.status === 'completed';
    return job.status !== 'declined';
  });

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;
  const activeCount = jobs.filter((j) =>
    ['accepted', 'en_route', 'in_progress'].includes(j.status)
  ).length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;

  const jobMapPins: MapSecondaryPin[] = filteredJobs.map((j) => ({
    id: j.id,
    lat: j.location.lat,
    lng: j.location.lng,
    title: `${j.id} · ${j.serviceCategoryLabel}`,
    subtitle: j.diagnosis.likelyProblem,
    meta: `${j.distanceKm ?? 0} km · ₹${j.diagnosis.fairPriceMinInr}–₹${j.diagnosis.fairPriceMaxInr}`,
  }));

  return (
    <div className="bg-obsidian-glow min-h-[calc(100vh-120px)] pb-24 lg:pb-12">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        {/* Top Summary Bar */}
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-5 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-medium text-[#A78BFA]">
              Service Provider Hub · {provider.location.address}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white">
              {provider.name}
            </h1>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#14141D] p-1">
            <button
              type="button"
              onClick={() => setActiveView('requests')}
              className={`min-h-[40px] rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeView === 'requests'
                  ? 'bg-[#262140] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Job Requests ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveView('profile')}
              className={`min-h-[40px] rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeView === 'profile'
                  ? 'bg-[#262140] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Skills, Certifications &amp; Radius
            </button>
          </div>
        </div>

        {/* 4-Column Tabular KPI Strip */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="surface-card rounded-2xl p-4">
            <p className="text-xs text-slate-400">Pending in Radius</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {pendingCount}
            </p>
          </div>
          <div className="surface-card rounded-2xl p-4">
            <p className="text-xs text-slate-400">Active Assigned Jobs</p>
            <p className="mt-1 font-mono text-2xl font-bold text-[#A78BFA] tabular-nums">
              {activeCount}
            </p>
          </div>
          <div className="surface-card rounded-2xl p-4">
            <p className="text-xs text-slate-400">Completed Jobs</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
              {provider.completedJobs + completedCount}
            </p>
          </div>
          <div className="surface-card rounded-2xl p-4">
            <p className="text-xs text-slate-400">Service Radius</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {provider.location.radiusKm} km
            </p>
          </div>
        </div>

        {activeView === 'profile' ? (
          <form
            onSubmit={(e) => void handleSaveProfile(e)}
            className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12"
          >
            {/* Left Column: Services, Skills, Experience & Certifications */}
            <div className="surface-card space-y-5 rounded-3xl p-6 lg:col-span-6">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Services, Skills &amp; Certifications
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Declare the services you offer, years of experience, and verified certifications.
                </p>
              </div>

              <div>
                <label htmlFor="prov-name" className="block text-xs font-semibold text-slate-200">
                  Technician / Business Name
                </label>
                <input
                  id="prov-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#1C1C27] px-3.5 py-2.5 text-sm text-white focus:border-[#7C5CFF] focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-200">
                  Services Provided
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SERVICES_CATALOG.map((svc) => {
                    const active = services.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => toggleService(svc.id)}
                        className={`flex min-h-[42px] items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          active
                            ? 'border-[#7C5CFF] bg-[#282246] text-white'
                            : 'border-white/10 bg-[#1C1C27] text-slate-300 hover:bg-[#232333]'
                        }`}
                      >
                        <span className="truncate">{svc.shortName}</span>
                        {active && <Check className="ml-1 h-3.5 w-3.5 shrink-0 text-[#A78BFA]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="prov-exp" className="block text-xs font-semibold text-slate-200">
                  Years of Field Experience
                </label>
                <input
                  id="prov-exp"
                  type="number"
                  min={0}
                  max={50}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  className="mt-1.5 w-32 rounded-xl border border-white/10 bg-[#1C1C27] px-3 py-2 font-mono text-sm text-white"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-200">
                  Specialized Skills
                </span>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    placeholder="e.g. Split AC Inverter PCB, RCCB Testing..."
                    className="flex-1 rounded-xl border border-white/10 bg-[#1C1C27] px-3 py-2 text-xs text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#22222F] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2B2B3B]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>
                {skills.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {skills.map((sk) => (
                      <span
                        key={sk}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#1C1C27] px-2.5 py-1 text-xs text-slate-200"
                      >
                        <span>{sk}</span>
                        <button
                          type="button"
                          onClick={() => setSkills((prev) => prev.filter((item) => item !== sk))}
                          className="text-slate-400 hover:text-white"
                          aria-label={`Remove ${sk}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <Award className="h-3.5 w-3.5 text-[#A78BFA]" />
                  <span>Certifications &amp; Licenses</span>
                </span>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {PROVIDER_CERTIFICATION_OPTIONS.map((cert) => {
                    const selected = certifications.includes(cert);
                    return (
                      <button
                        key={cert}
                        type="button"
                        onClick={() => toggleCertification(cert)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                          selected
                            ? 'border-[#7C5CFF] bg-[#282246] font-semibold text-white'
                            : 'border-white/10 bg-[#1C1C27] text-slate-300 hover:bg-[#232333]'
                        }`}
                      >
                        <Check
                          className={`h-3.5 w-3.5 shrink-0 ${
                            selected ? 'text-[#A78BFA] opacity-100' : 'opacity-20'
                          }`}
                        />
                        <span className="truncate">{cert}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={customCert}
                    onChange={(e) => setCustomCert(e.target.value)}
                    placeholder="Add custom certification or license number..."
                    className="flex-1 rounded-xl border border-white/10 bg-[#1C1C27] px-3 py-2 text-xs text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCert}
                    className="rounded-xl border border-white/10 bg-[#22222F] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2B2B3B]"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Base Pin-Drop Location & Service Radius */}
            <div className="surface-card space-y-5 rounded-3xl p-6 lg:col-span-6">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Base Location &amp; Service Radius
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Customer problems are listed strictly when they fall inside your service radius.
                </p>
              </div>

              <LocationPinMap
                value={location}
                onChange={setLocation}
                authToken={authToken}
                radiusLabel="Coverage radius"
                heightClass="h-80"
                minRadiusKm={2}
                maxRadiusKm={30}
              />

              {profileMessage && (
                <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {profileMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="btn-violet-primary min-h-[48px] w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
              >
                {savingProfile ? 'Saving Profile...' : 'Save Profile & View Jobs in Radius'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left 7 Columns: Radius-Filtered Customer Problem List */}
            <div className="space-y-4 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Customer Requests Within {provider.location.radiusKm} km
                  </h2>
                  <p className="text-xs text-slate-400">
                    Sorted by distance · {outOfRadiusCount} request(s) outside your radius hidden
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#14141D] p-1">
                  {(['all', 'pending', 'active', 'completed'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                        statusFilter === tab
                          ? 'bg-[#262140] text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {loadingJobs ? (
                <div className="surface-card rounded-3xl p-10 text-center text-sm text-slate-400">
                  Scanning requests inside your {provider.location.radiusKm} km radius...
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="surface-card rounded-3xl p-10 text-center">
                  <Wrench className="mx-auto h-8 w-8 text-[#A78BFA]" />
                  <h3 className="mt-3 font-display text-base font-semibold text-white">
                    No matching jobs in this view
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Try widening your service radius in Skills, Certifications &amp; Radius or switch filters.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <div key={job.id} className="surface-card rounded-3xl p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span className="font-mono font-semibold text-white">{job.id}</span>
                            <span>·</span>
                            <span>{job.serviceCategoryLabel}</span>
                            <span>·</span>
                            <span className="font-mono font-semibold text-[#A78BFA] tabular-nums">
                              {job.distanceKm ?? 0} km away
                            </span>
                            <span>·</span>
                            <span>{job.diagnosis.detectedLanguage}</span>
                          </div>
                          <h3 className="mt-1 font-display text-base font-bold text-white">
                            {job.diagnosis.likelyProblem}
                          </h3>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-300">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#A78BFA]" />
                            <span>
                              {job.customerName} — {job.location.address}
                            </span>
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-mono text-base font-bold text-white tabular-nums">
                            ₹{job.diagnosis.fairPriceMinInr} – ₹{job.diagnosis.fairPriceMaxInr}
                          </p>
                          <p className="text-[11px] text-emerald-400">
                            {job.paymentMethod === 'online' ? 'Paid Online' : 'Cash on Site'} ·{' '}
                            {job.scheduledSlot}
                          </p>
                        </div>
                      </div>

                      <div className="surface-elevated mt-3.5 flex flex-col gap-3 rounded-2xl p-3.5 sm:flex-row">
                        {job.mediaPreviewDataUrl && (
                          <img
                            src={job.mediaPreviewDataUrl}
                            alt="Customer issue attachment"
                            className="h-24 w-28 shrink-0 rounded-xl border border-white/10 object-cover"
                          />
                        )}
                        <div className="flex-1 space-y-1.5 text-xs text-slate-300">
                          <p>
                            <strong className="text-white">AI Summary:</strong>{' '}
                            {job.diagnosis.transcriptSummary || job.diagnosis.likelyProblem}
                          </p>
                          <p className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-slate-200">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>Est. {job.diagnosis.estimatedTime}</span>
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                job.diagnosis.safetyRiskLevel === 'Critical' ||
                                job.diagnosis.safetyRiskLevel === 'High'
                                  ? 'text-red-400'
                                  : 'text-amber-300'
                              }`}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>{job.diagnosis.safetyRiskLevel} Risk</span>
                            </span>
                          </p>
                          {job.diagnosis.estimatedParts?.length > 0 && (
                            <p className="text-slate-400">
                              <strong className="text-slate-200">Carry parts:</strong>{' '}
                              {job.diagnosis.estimatedParts.map((p) => p.name).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold capitalize text-slate-300">
                          <ShieldCheck className="h-4 w-4 text-[#A78BFA]" />
                          <span>Status: {job.status.replace('_', ' ')}</span>
                        </span>

                        <div className="flex flex-wrap items-center gap-2">
                          {job.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={updatingJobId === job.id}
                                onClick={() => void handleUpdateJobStatus(job.id, 'declined')}
                                className="rounded-xl border border-white/10 bg-[#22222F] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-[#2C2C3D]"
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                disabled={updatingJobId === job.id}
                                onClick={() => void handleUpdateJobStatus(job.id, 'accepted')}
                                className="btn-violet-primary rounded-xl px-4 py-1.5 text-xs font-semibold text-white"
                              >
                                Accept Job
                              </button>
                            </>
                          )}
                          {job.status === 'accepted' && (
                            <button
                              type="button"
                              disabled={updatingJobId === job.id}
                              onClick={() => void handleUpdateJobStatus(job.id, 'en_route')}
                              className="btn-violet-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold text-white"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                              <span>Mark En Route</span>
                            </button>
                          )}
                          {job.status === 'en_route' && (
                            <button
                              type="button"
                              disabled={updatingJobId === job.id}
                              onClick={() => void handleUpdateJobStatus(job.id, 'in_progress')}
                              className="btn-violet-primary rounded-xl px-4 py-1.5 text-xs font-semibold text-white"
                            >
                              Start Work on Site
                            </button>
                          )}
                          {job.status === 'in_progress' && (
                            <button
                              type="button"
                              disabled={updatingJobId === job.id}
                              onClick={() => void handleUpdateJobStatus(job.id, 'completed')}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Mark Completed</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right 5 Columns: Live Coverage Map with Customer Pins */}
            <div className="lg:col-span-5">
              <div className="surface-card sticky top-20 rounded-3xl p-5">
                <h3 className="font-display text-base font-bold text-white">
                  Service Radius &amp; Customer Pins
                </h3>
                <p className="mt-0.5 mb-3 text-xs text-slate-400">
                  Green pin is your base; violet pins are customer problems inside your{' '}
                  {provider.location.radiusKm} km radius.
                </p>
                <LocationPinMap
                  value={provider.location}
                  onChange={(nextLoc) => {
                    setLocation(nextLoc);
                    onProviderUpdated({ ...provider, location: nextLoc });
                  }}
                  authToken={authToken}
                  secondaryPins={jobMapPins}
                  showRadiusSlider={false}
                  heightClass="h-80"
                />
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Certifications: {provider.certifications.length}</span>
                  <button
                    type="button"
                    onClick={() => setActiveView('profile')}
                    className="font-semibold text-[#A78BFA] hover:underline"
                  >
                    Adjust radius or skills
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact Mobile Bottom Dock for Provider */}
      <nav className="fixed right-0 bottom-0 left-0 z-40 border-t border-white/10 bg-[#0E0E15]/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3 items-center py-1.5">
          {[
            {
              id: 'requests',
              label: 'Requests',
              Icon: Compass,
              action: () => setActiveView('requests'),
            },
            {
              id: 'skills',
              label: 'Skills',
              Icon: Award,
              action: () => setActiveView('profile'),
            },
            {
              id: 'profile',
              label: 'Radius',
              Icon: UserCog,
              action: () => setActiveView('profile'),
            },
          ].map(({ id, label, Icon, action }) => {
            const active =
              (id === 'requests' && activeView === 'requests') ||
              (id !== 'requests' && activeView === 'profile');
            return (
              <button
                key={id}
                type="button"
                onClick={action}
                className="flex flex-col items-center justify-center py-1 text-[10px] font-medium"
              >
                <span
                  className={`flex h-7 w-9 items-center justify-center rounded-xl transition-colors ${
                    active ? 'bg-[#7C5CFF]/25 text-[#A78BFA]' : 'text-slate-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
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
