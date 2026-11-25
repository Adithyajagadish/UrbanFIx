/// <reference types="google.maps" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  Circle,
  ColorScheme,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiIsLoaded,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Crosshair, MapPin, Search } from 'lucide-react';
import type { LocationPin } from '../types.ts';

export interface MapSecondaryPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  meta?: string;
}

interface LocationPinMapProps {
  value: LocationPin;
  onChange: (next: LocationPin) => void;
  authToken?: string;
  secondaryPins?: MapSecondaryPin[];
  heightClass?: string;
  radiusLabel?: string;
  showRadiusSlider?: boolean;
  minRadiusKm?: number;
  maxRadiusKm?: number;
}

function SecondaryMarker({ item }: { item: MapSecondaryPin }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: item.lat, lng: item.lng }}
        onClick={() => setOpen(true)}
        title={item.title}
      >
        <Pin background="#7C5CFF" borderColor="#4C1D95" glyphColor="#FFFFFF" scale={0.95} />
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="max-w-[220px] p-1 text-neutral-900">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-0.5 text-xs text-neutral-600">{item.subtitle}</p>
            {item.meta && (
              <p className="mt-1 font-mono text-[11px] font-medium text-indigo-700">{item.meta}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function MapViewportSync({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  const prevRef = useRef(center);

  useEffect(() => {
    if (!map) return;
    if (
      Math.abs(prevRef.current.lat - center.lat) > 0.0002 ||
      Math.abs(prevRef.current.lng - center.lng) > 0.0002
    ) {
      map.panTo(center);
      prevRef.current = center;
    }
  }, [map, center]);

  return null;
}

export const LocationPinMap: React.FC<LocationPinMapProps> = ({
  value,
  onChange,
  authToken,
  secondaryPins = [],
  heightClass = 'h-72',
  radiusLabel = 'Service radius',
  showRadiusSlider = true,
  minRadiusKm = 2,
  maxRadiusKm = 25,
}) => {
  const placesLib = useMapsLibrary('places');
  const isLoaded = useApiIsLoaded();
  const status = useApiLoadingStatus();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const reverseGeocodeAndUpdate = useCallback(
    async (lat: number, lng: number, radiusKm: number) => {
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        });
        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        const data = (await res.json()) as { address?: string };
        onChange({
          lat,
          lng,
          address: data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          radiusKm,
        });
      } catch {
        onChange({
          lat,
          lng,
          address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          radiusKm,
        });
      }
    },
    [onChange, authToken]
  );

  useEffect(() => {
    if (!placesLib || !searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: searchQuery.trim(),
        sessionToken: sessionTokenRef.current ?? undefined,
      })
        .then((res) => {
          if (!cancelled) {
            setSuggestions(res.suggestions || []);
          }
        })
        .catch((err) => {
          if (String(err).includes('OVER_QUERY_LIMIT') || String(err).includes('429')) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          if (!cancelled) setSuggestions([]);
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, searchQuery]);

  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });
      const loc = place.location;
      if (loc) {
        onChange({
          lat: loc.lat(),
          lng: loc.lng(),
          address: place.formattedAddress || place.displayName || suggestion.placePrediction.text.text,
          radiusKm: value.radiusKm,
        });
      }
      setSearchQuery('');
      setSuggestions([]);
      sessionTokenRef.current = null;
    } catch {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      setGeoError('Browser geolocation is unavailable.');
      return;
    }
    setIsLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        void reverseGeocodeAndUpdate(pos.coords.latitude, pos.coords.longitude, value.radiusKm);
      },
      () => {
        setIsLocating(false);
        setGeoError('Location permission denied. Click anywhere on the map or drag the pin.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search street, area, or landmark..."
            className="w-full rounded-xl border border-white/10 bg-[#1C1C27] py-2.5 pr-3 pl-9 text-sm text-white placeholder:text-slate-400 focus:border-[#7C5CFF] focus:outline-none"
          />
          {suggestions.length > 0 && (
            <ul className="absolute right-0 left-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-[#181822] py-1 shadow-2xl">
              {suggestions.map((s, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => void handleSelectSuggestion(s)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9B7BFF]" />
                    <span className="line-clamp-2">{s.placePrediction?.text.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={handleUseCurrentGps}
          disabled={isLocating}
          className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#22222F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2B2B3B] disabled:opacity-50 whitespace-nowrap"
        >
          <Crosshair className="h-4 w-4 text-[#9B7BFF]" />
          <span>{isLocating ? 'Locating...' : 'Use GPS'}</span>
        </button>
      </div>

      {geoError && <p className="text-xs text-amber-300">{geoError}</p>}

      <div className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#101018] ${heightClass}`}>
        {status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <MapPin className="h-7 w-7 text-[#9B7BFF]" />
            <p className="mt-2 text-sm font-medium text-white">
              Interactive map preview unavailable
            </p>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              Adjust your radius slider below to match coordinates ({value.lat.toFixed(4)},{' '}
              {value.lng.toFixed(4)}).
            </p>
          </div>
        ) : !isLoaded ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Loading Google Map...
          </div>
        ) : (
          <GoogleMap
            mapId="DEMO_MAP_ID"
            colorScheme={ColorScheme.DARK}
            defaultCenter={{ lat: value.lat, lng: value.lng }}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI={false}
            streetViewControl={false}
            mapTypeControl={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            onClick={(ev) => {
              const latLng = ev.detail.latLng;
              if (latLng) {
                void reverseGeocodeAndUpdate(latLng.lat, latLng.lng, value.radiusKm);
              }
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <MapViewportSync center={{ lat: value.lat, lng: value.lng }} />

            <Circle
              center={{ lat: value.lat, lng: value.lng }}
              radius={value.radiusKm * 1000}
              strokeColor="#9B7BFF"
              strokeOpacity={0.85}
              strokeWeight={1.5}
              fillColor="#7C5CFF"
              fillOpacity={0.16}
              clickable={false}
            />

            <AdvancedMarker
              position={{ lat: value.lat, lng: value.lng }}
              draggable
              onDragEnd={(e) => {
                if (e.latLng) {
                  void reverseGeocodeAndUpdate(e.latLng.lat(), e.latLng.lng(), value.radiusKm);
                }
              }}
              title="Pinned Service Location"
            >
              <Pin background="#34D399" borderColor="#065F46" glyphColor="#06281E" />
            </AdvancedMarker>

            {secondaryPins.map((item) => (
              <SecondaryMarker key={item.id} item={item} />
            ))}
          </GoogleMap>
        )}
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-[#1C1C27] px-3.5 py-2.5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-400">Pinned Address</p>
          <p className="truncate text-sm font-medium text-white">{value.address}</p>
        </div>
        {showRadiusSlider && (
          <div className="flex shrink-0 items-center gap-3">
            <label htmlFor="radius-slider" className="text-xs font-medium text-slate-300 whitespace-nowrap">
              {radiusLabel}:{' '}
              <span className="font-mono font-semibold text-[#A78BFA] tabular-nums">
                {value.radiusKm} km
              </span>
            </label>
            <input
              id="radius-slider"
              type="range"
              min={minRadiusKm}
              max={maxRadiusKm}
              step={1}
              value={value.radiusKm}
              onChange={(e) =>
                onChange({
                  ...value,
                  radiusKm: Number(e.target.value),
                })
              }
              className="h-1.5 w-28 cursor-pointer accent-[#7C5CFF]"
            />
          </div>
        )}
      </div>
    </div>
  );
};
