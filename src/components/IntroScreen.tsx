import React from 'react';
import {
  ArrowDownUp,
  ArrowRight,
  Camera,
  ChevronRight,
  MapPin,
  Mic,
  ShieldAlert,
  Sparkles,
  Video,
  Wrench,
} from 'lucide-react';
import { SERVICES_CATALOG } from '../data/servicesCatalog.ts';

interface IntroScreenProps {
  onGetStarted: () => void;
  onQuickRole: (role: 'customer' | 'provider') => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onGetStarted, onQuickRole }) => {
  return (
    <div className="bg-obsidian-glow pb-16">
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:pt-12">
        {/* Intro Headline */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium tracking-wide text-[#A78BFA]">
            Multimodal AI Home Diagnosis · Kannada, Hindi &amp; English
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-5xl leading-[1.12] [text-wrap:balance]">
            Diagnose home repairs fairly before any technician arrives
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
            Customers often cannot explain technical faults—causing the wrong technician and
            on-site price surprises. Upload a photo, short video, or voice note in Kannada, Hindi,
            or English for an instant diagnosis, parts list, fair quote, and safety check.
          </p>
        </div>

        {/* 3-Card Framework Mirroring Reference Layout */}
        <div className="mt-10 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
          {/* Left Panel: Purpose, Fair Pricing Trend & Dual Action Buttons */}
          <div className="surface-card flex flex-col justify-between rounded-3xl p-6 lg:col-span-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Typical Pre-Visit Fair Quote</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-tight text-white tabular-nums">
                ₹550 – ₹1,150
              </p>
              <p className="mt-1 font-mono text-xs font-medium text-emerald-400 tabular-nums">
                +0% surprise charges · Upfront parts &amp; labor
              </p>

              {/* Emerald Trend Curve SVG matching reference Card 1 */}
              <div className="mt-5 rounded-2xl bg-[#0F0F16] p-3 border border-white/[0.06]">
                <svg viewBox="0 0 300 96" className="h-24 w-full overflow-visible">
                  <defs>
                    <linearGradient id="emeraldArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 78 L28 68 L52 72 L78 52 L106 58 L138 36 L168 44 L198 22 L228 34 L258 26 L288 30 L300 22 L300 96 L0 96 Z"
                    fill="url(#emeraldArea)"
                  />
                  <path
                    d="M0 78 L28 68 L52 72 L78 52 L106 58 L138 36 L168 44 L198 22 L228 34 L258 26 L288 30 L300 22"
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="296" cy="24" r="4" fill="#34D399" />
                </svg>
                <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-400">
                  <span>Photo</span>
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-white">AI Quote</span>
                  <span>Parts</span>
                  <span>Safety</span>
                  <span>Match</span>
                </div>
              </div>

              <div className="mt-5 space-y-2.5">
                <div className="surface-elevated flex items-center justify-between rounded-2xl p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2B2548] text-[#A78BFA]">
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Safety Risk Alerts</p>
                      <p className="text-[11px] text-slate-400">Immediate hazard precautions</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-semibold text-emerald-400">Active</span>
                </div>

                <div className="surface-elevated rounded-2xl p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Multilingual Accuracy</span>
                    <span className="text-slate-400">3 languages</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-emerald-400/25 bg-[#12121A] px-2 py-2 text-center">
                      <p className="text-xs font-semibold text-white">English</p>
                      <p className="mt-0.5 text-[10px] text-emerald-400">EN</p>
                    </div>
                    <div className="rounded-xl border border-[#7C5CFF]/35 bg-[#12121A] px-2 py-2 text-center">
                      <p className="text-xs font-semibold text-white">Hindi</p>
                      <p className="mt-0.5 text-[10px] text-[#A78BFA]">हिन्दी</p>
                    </div>
                    <div className="rounded-xl border border-sky-400/25 bg-[#12121A] px-2 py-2 text-center">
                      <p className="text-xs font-semibold text-white">Kannada</p>
                      <p className="mt-0.5 text-[10px] text-sky-400">ಕನ್ನಡ</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onQuickRole('provider')}
                className="min-h-[44px] rounded-xl border border-white/10 bg-[#22222F] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#2C2C3D] whitespace-nowrap"
              >
                Provider Hub
              </button>
              <button
                type="button"
                onClick={onGetStarted}
                className="btn-violet-primary min-h-[44px] rounded-xl px-3 py-2.5 text-xs font-semibold text-white transition-all whitespace-nowrap"
              >
                Get Started
              </button>
            </div>
          </div>

          {/* Center Panel: Hero Service Hub + 4 Action Tiles + Services List */}
          <div className="surface-card flex flex-col justify-between rounded-3xl p-6 lg:col-span-4" style={{ backgroundImage: 'radial-gradient(ellipse 90% 45% at 50% 0%, rgba(124, 92, 255, 0.28), transparent 68%)' }}>
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">UrbanFix Home Hub</p>
                  <p className="text-sm font-semibold text-white">Verified Doorstep Care</p>
                </div>
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  aria-label="Start diagnosis"
                >
                  <Sparkles className="h-4 w-4 text-[#A78BFA]" />
                </button>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Inspection starting at</span>
                  <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                    INR ₹
                  </span>
                </div>
                <p className="mt-1 font-mono text-4xl font-bold tracking-tight text-white tabular-nums">
                  ₹199.00
                </p>
                <p className="mt-1 font-mono text-xs font-medium text-emerald-400 tabular-nums">
                  +Free AI Pre-Diagnosis &amp; Safety Check
                </p>
              </div>

              {/* 4-Square Quick Action Grid */}
              <div className="mt-5 grid grid-cols-4 gap-2.5">
                {[
                  { label: 'Photo', Icon: Camera },
                  { label: 'Video', Icon: Video },
                  { label: 'Voice', Icon: Mic },
                  { label: 'Map Pin', Icon: MapPin },
                ].map(({ label, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onGetStarted}
                    className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.08] bg-[#1E1E2B] p-2 text-center transition-colors hover:border-[#7C5CFF]/60 hover:bg-[#262637]"
                  >
                    <Icon className="h-4 w-4 text-white" />
                    <span className="text-[11px] font-medium text-slate-200">{label}</span>
                  </button>
                ))}
              </div>

              {/* Location & Coverage Strip */}
              <div className="surface-elevated mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                <div>
                  <p className="text-[11px] text-slate-400">Pin-Drop Radius Matching</p>
                  <p className="font-mono text-sm font-semibold text-white tabular-nums">
                    2 km – 25 km
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onQuickRole('customer')}
                  className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 whitespace-nowrap"
                >
                  Customer Login
                </button>
              </div>

              {/* Service Categories List (matching Cryptocurrencies list) */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-white">
                    Home Services
                  </h2>
                  <button
                    type="button"
                    onClick={onGetStarted}
                    className="inline-flex items-center gap-0.5 text-xs text-slate-400 hover:text-white"
                  >
                    <span>All 6</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2.5 space-y-2">
                  {SERVICES_CATALOG.slice(0, 4).map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={onGetStarted}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-[#191924] px-3.5 py-2.5 text-left transition-colors hover:border-white/15 hover:bg-[#20202E]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#262340] text-[#A78BFA]">
                          <Wrench className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">
                            {svc.shortName}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {svc.commonProblems[0]}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs font-semibold text-white tabular-nums">
                          ₹{svc.baseVisitFeeInr}
                        </p>
                        <p className="font-mono text-[11px] text-emerald-400 tabular-nums">
                          {svc.typicalTime}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Stacked Input -> Diagnose -> Cost Breakdown & CTA */}
          <div className="surface-card flex flex-col justify-between rounded-3xl p-6 lg:col-span-4">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-white">AI Quote Preview</span>
                <span className="text-slate-400">Online · Cash on Site</span>
              </div>

              {/* Stacked Dual Block matching Swap Screen */}
              <div className="relative mt-4 space-y-2">
                <div className="surface-elevated rounded-2xl p-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Uploaded Fault</span>
                    <span>Kannada / Hindi / English</span>
                  </div>
                  <p className="mt-1.5 font-display text-lg font-bold text-white">
                    AC Water Leak + Voice Note
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    “Indoor unit dripping after 20 mins”
                  </p>
                </div>

                <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#14141D] bg-[#262638] text-[#A78BFA]">
                  <ArrowDownUp className="h-4 w-4" />
                </div>

                <div className="surface-elevated rounded-2xl p-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>AI Diagnosis &amp; Fair Range</span>
                    <span className="text-emerald-400">High Confidence</span>
                  </div>
                  <p className="mt-1.5 font-mono text-2xl font-bold text-white tabular-nums">
                    ₹650 – ₹1,150
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Clogged condensate drain &amp; coil flush
                  </p>
                </div>
              </div>

              {/* Cost Breakdown Table matching Screen 3 */}
              <div className="mt-5 space-y-2.5 border-t border-white/[0.08] pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Service Category</span>
                  <span className="font-medium text-white">AC &amp; Appliance Repair</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Estimated Parts</span>
                  <span className="font-mono text-white tabular-nums">Drain flush + foam</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Estimated Time</span>
                  <span className="font-mono text-white tabular-nums">45 – 60 mins</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Safety Risk Flag</span>
                  <span className="font-semibold text-amber-300">Moderate (Switch off MCB)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Preventive Tip</span>
                  <span className="text-emerald-400">Clean mesh filter / 15d</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onGetStarted}
              className="btn-violet-primary mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all"
            >
              <span>Continue to Role Selection</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 4-Column Service Categories & Jobs We Provide */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: 'Paint Jobs',
              jobs: 'Interior wall painting, damp waterproofing, putty & primer touch-ups',
              meta: 'From ₹499 · Same-day visit',
              accentBg: 'bg-fuchsia-500/15 border-fuchsia-400/25',
              accentGlow: 'hover:border-fuchsia-400/50',
              accentText: 'text-fuchsia-300',
              logo: (
                <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" aria-hidden="true">
                  <rect
                    x="5"
                    y="5"
                    width="18"
                    height="8"
                    rx="2.5"
                    stroke="#E879F9"
                    strokeWidth="2"
                    fill="#E879F9"
                    fillOpacity="0.18"
                  />
                  <path
                    d="M23 9H26C27.1 9 28 9.9 28 11V13.5C28 14.6 27.1 15.5 26 15.5H16V19"
                    stroke="#F0ABFC"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <rect
                    x="13.5"
                    y="19"
                    width="5"
                    height="8.5"
                    rx="2"
                    stroke="#E879F9"
                    strokeWidth="2"
                  />
                </svg>
              ),
            },
            {
              title: 'Plumbing',
              jobs: 'Pipe & P-trap leaks, mixer taps, flush valves & drain unclogging',
              meta: 'From ₹249 · Leak & trap experts',
              accentBg: 'bg-sky-500/15 border-sky-400/25',
              accentGlow: 'hover:border-sky-400/50',
              accentText: 'text-sky-300',
              logo: (
                <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" aria-hidden="true">
                  <path
                    d="M16 4.5C16 4.5 9 13 9 18.2C9 22.1 12.1 25.5 16 25.5C19.9 25.5 23 22.1 23 18.2C23 13 16 4.5 16 4.5Z"
                    stroke="#38BDF8"
                    strokeWidth="2"
                    fill="#38BDF8"
                    fillOpacity="0.18"
                  />
                  <path
                    d="M13 18.5C13 20.4 14.4 21.8 16.2 22"
                    stroke="#BAE6FD"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ),
            },
            {
              title: 'Electricity Fixes',
              jobs: 'MCB / RCCB tripping, scorched sockets, wiring, fans & inverter setup',
              meta: 'From ₹199 · Safety certified',
              accentBg: 'bg-amber-500/15 border-amber-400/25',
              accentGlow: 'hover:border-amber-400/50',
              accentText: 'text-amber-300',
              logo: (
                <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" aria-hidden="true">
                  <path
                    d="M17.5 4L8 17.5H15.5L14 28L24 14.5H16.5L17.5 4Z"
                    stroke="#FBBF24"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    fill="#FBBF24"
                    fillOpacity="0.2"
                  />
                </svg>
              ),
            },
            {
              title: 'Home Appliances Fixes',
              jobs: 'AC cooling & water leaks, washing machine, fridge, geyser & microwave',
              meta: 'From ₹299 · Multi-brand care',
              accentBg: 'bg-emerald-500/15 border-emerald-400/25',
              accentGlow: 'hover:border-emerald-400/50',
              accentText: 'text-emerald-300',
              logo: (
                <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" aria-hidden="true">
                  <rect
                    x="4"
                    y="6"
                    width="24"
                    height="12"
                    rx="3"
                    stroke="#34D399"
                    strokeWidth="2"
                    fill="#34D399"
                    fillOpacity="0.16"
                  />
                  <path
                    d="M8 14H24"
                    stroke="#6EE7B7"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10 22C9.5 24 10.5 25.5 10 27M16 22C15.5 24 16.5 25.5 16 27M22 22C21.5 24 22.5 25.5 22 27"
                    stroke="#34D399"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ),
            },
          ].map(({ title, jobs, meta, accentBg, accentGlow, accentText, logo }) => (
            <button
              key={title}
              type="button"
              onClick={onGetStarted}
              className={`group relative flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#1A1A27] to-[#12121B] p-5 text-left shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1E1E2D] ${accentGlow}`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${accentBg}`}
                  >
                    {logo}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-white">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{jobs}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3">
                <span className={`font-mono text-[11px] font-semibold ${accentText} tabular-nums`}>
                  {meta}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
