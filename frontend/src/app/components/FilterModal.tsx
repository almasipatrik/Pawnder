'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Target, Navigation, AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import PawnderSlider from './PawnderSlider';
import PawnderSelect from './PawnderSelect';
import PawnderAutocomplete from './PawnderAutocomplete';
import {
  type FilterState,
  DEFAULT_FILTERS,
  DROPDOWNS,
  enrichAnimalClientSide,
} from '@/lib/matching';
import {
  getPostalCodeOptionsForCity,
  POPULAR_CITIES,
  resolveCityFromPostalCode,
  resolveDefaultPostalCodeFromCity,
  resolveHungarianCoords,
  resolveNearestHungarianLocation,
  reverseGeocodeHungarianLocation,
  SETTLEMENT_AUTOCOMPLETE_OPTIONS,
} from '@/lib/hu-locations';

export const filterFormSchema = z
  .object({
    species: z.string(),
    breed: z.string(),
    fromyear: z.number().min(0).max(40),
    toyear: z.number().min(0).max(40),
    gender: z.string(),
    peopleok: z.string(),
    size: z.string(),
    kidsok: z.string(),
    housebroken: z.string(),
    malesok: z.string(),
    keepin: z.string(),
    femalesok: z.string(),
    spayed: z.string(),
    shelter_id: z.string(),
    city: z.string().trim(),
    postal_code: z.string().trim(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    max_distance_km: z.number().min(10).max(500),
    min_match_percent: z.number().min(30).max(100),
  })
  .refine((data) => data.fromyear <= data.toyear, {
    message: 'A minimum életkor nem lehet nagyobb a maximum életkornál!',
    path: ['fromyear'],
  });

export type FilterFormValues = z.infer<typeof filterFormSchema>;

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  currentFilters: FilterState;
  onApply: (newFilters: FilterState) => void;
  filterTab: 'SEARCH' | 'LOCATION' | 'TRAITS' | string;
  setFilterTab: (tab: any) => void;
  filterPull: {
    containerRef: React.RefObject<any>;
    handleProps: React.HTMLAttributes<HTMLDivElement>;
    dragY: number;
    onTouchStart: React.TouchEventHandler;
    onTouchMove: React.TouchEventHandler;
    onTouchEnd: React.TouchEventHandler;
  };
  totalEligibleCount?: number;
  allAnimals?: any[];
  swipedMap?: Record<string, 'left' | 'right'>;
}

export default function FilterModal({
  open,
  onClose,
  currentFilters,
  onApply,
  filterTab,
  setFilterTab,
  filterPull,
  totalEligibleCount,
  allAnimals,
  swipedMap,
}: FilterModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<FilterFormValues>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: currentFilters,
    mode: 'onChange',
  });

  // Whenever the modal opens, reset form values back to currently active filters
  useEffect(() => {
    if (open) {
      reset(currentFilters);
    }
  }, [open, currentFilters, reset]);

  const watchedValuesRaw = useWatch({ control });
  const watchedValues: FilterFormValues = useMemo(() => {
    return {
      ...currentFilters,
      ...(watchedValuesRaw || {}),
    } as FilterFormValues;
  }, [currentFilters, watchedValuesRaw]);

  const watchedValuesKey = useMemo(() => JSON.stringify(watchedValues), [watchedValues]);

  const liveMatchingCount = useMemo(() => {
    if (!allAnimals || allAnimals.length === 0) {
      return totalEligibleCount ?? 0;
    }
    const currentDraft = watchedValues as FilterState;
    return allAnimals.filter((raw) => {
      if (raw.is_adopted) return false;
      if (swipedMap && swipedMap[raw.external_id]) return false;
      const scored = enrichAnimalClientSide(raw, currentDraft);
      return scored.is_matched !== false;
    }).length;
  }, [allAnimals, watchedValuesKey, totalEligibleCount, swipedMap, watchedValues]);

  const activeBreedOptions = useMemo(() => {
    const sp = watchedValues.species;
    if (sp === 'kutya') return DROPDOWNS.dogBreeds;
    if (sp === 'macska') return DROPDOWNS.catBreeds;
    const merged: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const b of [...DROPDOWNS.dogBreeds, ...DROPDOWNS.catBreeds]) {
      if (!seen.has(b.value)) {
        seen.add(b.value);
        merged.push(b);
      }
    }
    return merged;
  }, [watchedValues.species]);

  const settlementOptions = useMemo(() => {
    const list = [...SETTLEMENT_AUTOCOMPLETE_OPTIONS];
    const currentCity = watchedValues.city;
    if (
      currentCity &&
      !currentCity.toLowerCase().includes('gps') &&
      !list.some((o) => o.value.toLowerCase() === currentCity.toLowerCase())
    ) {
      list.unshift({
        value: currentCity,
        label: currentCity,
      });
    }
    return list;
  }, [watchedValues.city]);

  const postalCodeOptions = useMemo(() => {
    const list = getPostalCodeOptionsForCity(watchedValues.city);
    const currentZip = (watchedValues.postal_code || '').trim();
    if (currentZip && !list.some((o) => o.value === currentZip)) {
      return [{ value: currentZip, label: currentZip }, ...list];
    }
    return list;
  }, [watchedValues.city, watchedValues.postal_code]);

  const [isGpsLoading, setIsGpsLoading] = useState(false);

  const handleUseGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('A böngésződ nem támogatja a helymeghatározást.');
      return;
    }
    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setValue('lat', lat);
          setValue('lng', lng);

          // 1. Immediate local fallback resolution (instant UI update)
          const local = resolveNearestHungarianLocation(lat, lng);
          setValue('city', local.city, { shouldValidate: true });
          setValue('postal_code', local.postalCode, { shouldValidate: true });

          // 2. High precision geocoding via OpenStreetMap Nominatim with local fallback
          const refined = await reverseGeocodeHungarianLocation(lat, lng);
          if (refined.city) {
            setValue('city', refined.city, { shouldValidate: true });
          }
          if (refined.postalCode) {
            setValue('postal_code', refined.postalCode, { shouldValidate: true });
          }
        } catch (err) {
          console.warn('GPS geocoding error:', err);
        } finally {
          setIsGpsLoading(false);
        }
      },
      (err) => {
        setIsGpsLoading(false);
        console.warn('GPS location error:', err);
        alert(
          'Nem sikerült lekérni a GPS pozíciót. Kérjük, engedélyezd a helymeghatározást a böngésződben, vagy válassz települést!',
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  const onSubmit = (data: FilterFormValues) => {
    onApply(data as FilterState);
  };

  const onInvalid = (formErrors: any) => {
    console.warn('Filter form validation warnings:', formErrors);
    const fallback = {
      ...(watchedValues as FilterState),
      postal_code: (watchedValues.postal_code || '').replace(/\D/g, '').slice(0, 4) || '2330',
    };
    onApply(fallback);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        backgroundColor:
          filterPull.dragY > 0
            ? `rgba(0, 0, 0, ${Math.max(0.1, 0.55 - (filterPull.dragY / 350) * 0.45)})`
            : undefined,
      }}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden"
    >
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        ref={filterPull.containerRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={filterPull.onTouchStart}
        onTouchMove={filterPull.onTouchMove}
        onTouchEnd={filterPull.onTouchEnd}
        style={{
          transform:
            filterPull.dragY > 0 ? `translateY(${filterPull.dragY}px)` : undefined,
          opacity:
            filterPull.dragY > 0
              ? Math.max(0.3, 1 - filterPull.dragY / 350)
              : undefined,
          transition:
            filterPull.dragY > 0
              ? 'none'
              : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease',
        }}
        className="bg-white rounded-[28px] max-w-2xl w-full max-h-[95dvh] p-3.5 sm:p-6 shadow-2xl flex flex-col justify-between gap-2.5 sm:gap-3.5 overflow-hidden overscroll-contain"
      >
        {/* Pull-to-dismiss handle */}
        <div
          {...filterPull.handleProps}
          className="w-full flex justify-center -mt-2 -mb-1 py-1 cursor-grab active:cursor-grabbing touch-none select-none group shrink-0"
          title="Húzd le a bezáráshoz"
        >
          <div className="w-12 h-1.5 bg-purple-200 group-hover:bg-purple-300 group-active:bg-purple-500 rounded-full transition" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-purple-100 shrink-0">
          <div>
            <h2 className="text-base sm:text-xl font-extrabold text-[#231942]">
              Keresési Szűrők & Távolság
            </h2>
            <p className="text-[11px] text-gray-500">
              A módosítások csak a Találatok gombra kattintva lépnek érvénybe
            </p>
          </div>
          <button
            type="button"
            aria-label="Bezárás"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-purple-50 hover:bg-rose-50 text-[#231942] hover:text-rose-600 flex items-center justify-center cursor-pointer shrink-0 z-30 transition"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Match tolerance slider */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl px-3 py-2.5 shrink-0 overflow-visible">
          <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs font-bold text-[#231942] mb-0.5 sm:mb-1">
            <span className="flex items-center gap-1 min-w-0">
              <Target className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="truncate">Minimum egyezés</span>
            </span>
            <span className="text-amber-800 font-extrabold shrink-0">
              {watchedValues.min_match_percent}%
              {watchedValues.min_match_percent >= 95
                ? ' (szigorú)'
                : watchedValues.min_match_percent >= 75
                  ? ' (kis eltérés ok)'
                  : ' (rugalmas)'}
            </span>
          </div>
          <Controller
            name="min_match_percent"
            control={control}
            render={({ field }) => (
              <PawnderSlider
                min={30}
                max={100}
                step={5}
                value={field.value}
                valueLabelFormat={(v) => `${v}%`}
                ariaLabel="Minimum egyezés"
                onChange={(val) => field.onChange(Number(val))}
              />
            )}
          />
          <p className="text-[10px] text-amber-900/80 leading-tight">
            Nem kell 100%-nak lennie — az eltérő tulajdonságú állatok is megjelennek, csak alacsonyabb %-kal.
          </p>
        </div>

        {/* Segmented Pill Tabs */}
        <div className="grid grid-cols-2 gap-1.5 bg-purple-100/70 p-1 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setFilterTab('SEARCH')}
            className={`py-1.5 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              filterTab === 'SEARCH'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-[#231942] hover:bg-white/60'
            }`}
          >
            🔍 Keresési feltételek
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('LOCATION')}
            className={`py-1.5 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              filterTab === 'LOCATION'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-[#231942] hover:bg-white/60'
            }`}
          >
            📍 Távolság & Helyzet
          </button>
        </div>

        {/* Tab Content Area (Scrollable with custom scrollbar, strictly avoiding horizontal scroll) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 py-1 flex flex-col justify-start">
          {filterTab === 'SEARCH' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
              {/* Faj */}
              <Controller
                name="species"
                control={control}
                render={({ field }) => (
                  <PawnderSelect
                    label="Faj:"
                    value={field.value}
                    options={[
                      { value: 'mindegy', label: 'mindegy (kutya+cica)' },
                      { value: 'kutya', label: 'kutya' },
                      { value: 'macska', label: 'macska' },
                    ]}
                    onChange={(val) => {
                      field.onChange(val);
                      setValue('breed', 'Any');
                    }}
                  />
                )}
              />

              {/* Fajta (Autocomplete) */}
              <Controller
                name="breed"
                control={control}
                render={({ field }) => (
                  <PawnderAutocomplete
                    label="Fajta:"
                    value={field.value}
                    options={activeBreedOptions}
                    placeholder="Keresés fajtára..."
                    onChange={(val) => field.onChange(val)}
                  />
                )}
              />

              {/* Nem */}
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <PawnderSelect
                    label="Nem:"
                    value={field.value}
                    options={DROPDOWNS.genders}
                    onChange={(val) => field.onChange(val as any)}
                  />
                )}
              />

              {/* Méret */}
              <Controller
                name="size"
                control={control}
                render={({ field }) => (
                  <PawnderSelect
                    label="Méret:"
                    value={field.value}
                    options={DROPDOWNS.sizes}
                    onChange={(val) => field.onChange(val as any)}
                  />
                )}
              />

              {/* Javasolt tartás */}
              <Controller
                name="keepin"
                control={control}
                render={({ field }) => (
                  <PawnderSelect
                    label="Tartás:"
                    value={field.value}
                    options={DROPDOWNS.keepIn}
                    onChange={(val) => field.onChange(val as any)}
                  />
                )}
              />

              {/* Embereket szereti */}
              <Controller
                name="peopleok"
                control={control}
                render={({ field }) => (
                  <PawnderSelect
                    label="Emberbarát:"
                    value={field.value}
                    options={DROPDOWNS.peopleOk}
                    onChange={(val) => field.onChange(val as any)}
                  />
                )}
              />

              {/* Gyerekeket szereti */}
              <Controller
                name="kidsok"
                control={control}
                render={({ field }) => (
                  <PawnderSelect
                    label="Gyerekbarát:"
                    value={field.value}
                    options={DROPDOWNS.kidsOk}
                    onChange={(val) => field.onChange(val as any)}
                  />
                )}
              />

              {/* Szobatiszta */}
              <Controller
                name="housebroken"
                control={control}
                render={({ field }) => (
                  <PawnderSelect
                    label="Szobatiszta:"
                    value={field.value}
                    options={DROPDOWNS.housebroken}
                    onChange={(val) => field.onChange(val as any)}
                  />
                )}
              />

              {/* Fiúkkal barátságos */}
              <Controller
                name="malesok"
                control={control}
                render={({ field }) => (
                  <PawnderSelect
                    label={
                      watchedValues.species === 'macska'
                        ? 'Fiúcicákkal barátságos:'
                        : 'Fiúkutyákkal barátságos:'
                    }
                    value={field.value}
                    options={DROPDOWNS.malesOk}
                    onChange={(val) => field.onChange(val as any)}
                  />
                )}
              />

              {/* Lányokkal barátságos */}
              <Controller
                name="femalesok"
                control={control}
                render={({ field }) => (
                  <PawnderSelect
                    label={
                      watchedValues.species === 'macska'
                        ? 'Lánycicákkal barátságos:'
                        : 'Lánykutyákkal barátságos:'
                    }
                    value={field.value}
                    options={DROPDOWNS.femalesOk}
                    onChange={(val) => field.onChange(val as any)}
                  />
                )}
              />

              {/* Ivartalanítva */}
              <Controller
                name="spayed"
                control={control}
                render={({ field }) => (
                  <PawnderSelect
                    label="Ivartalanítva:"
                    value={field.value}
                    options={DROPDOWNS.spayed}
                    onChange={(val) => field.onChange(val as any)}
                  />
                )}
              />

              {/* Szervezet / Menhely (Autocomplete) */}
              <Controller
                name="shelter_id"
                control={control}
                render={({ field }) => (
                  <PawnderAutocomplete
                    label="Menhely:"
                    value={field.value}
                    options={DROPDOWNS.shelters}
                    placeholder="Keresés menhelyre..."
                    onChange={(val) => field.onChange(val)}
                  />
                )}
              />

              {/* Életkor (0 - 40 év) */}
              <div className="col-span-2 sm:col-span-3 bg-purple-50/50 border border-purple-100 rounded-xl px-3 py-2 overflow-visible">
                <div className="flex items-center justify-between font-bold text-gray-700 text-xs mb-1">
                  <span>Életkor tartomány:</span>
                  <span className="text-purple-800 font-extrabold">
                    {watchedValues.fromyear} – {watchedValues.toyear} év
                  </span>
                </div>
                <PawnderSlider
                  min={0}
                  max={40}
                  step={1}
                  value={[watchedValues.fromyear, watchedValues.toyear]}
                  valueLabelFormat={(v) => `${v} év`}
                  ariaLabel="Életkor tartomány"
                  onChange={(val) => {
                    if (Array.isArray(val)) {
                      setValue('fromyear', val[0], { shouldValidate: true });
                      setValue('toyear', val[1], { shouldValidate: true });
                    }
                  }}
                />
                {errors.fromyear && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.fromyear.message}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {filterTab === 'LOCATION' && (
            <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-start">
                {/* Településed (Autocomplete) */}
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => (
                    <PawnderAutocomplete
                      label="Településed:"
                      value={field.value}
                      options={settlementOptions}
                      placeholder="Település..."
                      disableClearable={true}
                      emptyValue="Budapest"
                      onChange={(val) => {
                        field.onChange(val);
                        setValue('lat', undefined);
                        setValue('lng', undefined);
                        const defaultZip = resolveDefaultPostalCodeFromCity(val);
                        if (defaultZip) {
                          setValue('postal_code', defaultZip, { shouldValidate: true });
                          const [lat, lng] = resolveHungarianCoords(val, defaultZip);
                          setValue('lat', lat);
                          setValue('lng', lng);
                        }
                      }}
                    />
                  )}
                />

                {/* Irányítószám (Autocomplete dropdown!) */}
                <Controller
                  name="postal_code"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col min-w-0">
                      <PawnderAutocomplete
                        label="Irányítószám:"
                        value={field.value}
                        options={postalCodeOptions}
                        placeholder="Irányítószám..."
                        disableClearable={true}
                        freeSolo={true}
                        emptyValue="1011"
                        onChange={(val) => {
                          const rawVal = (val || '').replace(/\D/g, '').slice(0, 4);
                          field.onChange(rawVal);
                          if (rawVal.length === 4) {
                            const matchedCity = resolveCityFromPostalCode(rawVal);
                            if (matchedCity) {
                              setValue('city', matchedCity, { shouldValidate: true });
                              const [lat, lng] = resolveHungarianCoords(matchedCity, rawVal);
                              setValue('lat', lat);
                              setValue('lng', lng);
                            }
                          }
                        }}
                      />
                      {errors.postal_code && (
                        <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1 leading-tight">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{errors.postal_code.message}</span>
                        </p>
                      )}
                    </div>
                  )}
                />

                <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
                  <span className="hidden sm:block text-[11px] font-bold text-transparent select-none mb-0.5">
                    GPS:
                  </span>
                  <button
                    type="button"
                    onClick={handleUseGps}
                    disabled={isGpsLoading}
                    className="w-full h-[38px] px-3 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    {isGpsLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>GPS Pozíció...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3.5 h-3.5" />
                        <span>GPS Pozícióm</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Maximális távolság slider */}
              <div className="bg-white rounded-xl p-3 border border-purple-100 overflow-visible">
                <div className="flex justify-between text-xs font-bold mb-0.5">
                  <span>Maximális távolság a menhelytől:</span>
                  <span className="text-purple-800 font-extrabold">
                    {watchedValues.max_distance_km >= 500
                      ? 'Országos (mindegy)'
                      : `Max. ${watchedValues.max_distance_km} km`}
                  </span>
                </div>
                <Controller
                  name="max_distance_km"
                  control={control}
                  render={({ field }) => (
                    <PawnderSlider
                      min={10}
                      max={500}
                      step={10}
                      value={field.value}
                      valueLabelFormat={(v) => (v >= 500 ? 'Országos' : `${v} km`)}
                      ariaLabel="Maximális távolság a menhelytől"
                      onChange={(val) => field.onChange(Number(val))}
                    />
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Row */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-purple-100 shrink-0">
          <button
            type="button"
            onClick={() => reset(DEFAULT_FILTERS)}
            className="text-xs font-bold text-gray-500 hover:text-purple-700 flex items-center gap-1 cursor-pointer transition px-2 py-1 rounded-lg hover:bg-purple-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Alaphelyzet</span>
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-700/20 cursor-pointer transition hover:scale-[1.01] active:scale-[0.99]"
          >
            {liveMatchingCount !== undefined
              ? `Találatok (${liveMatchingCount} állat) →`
              : 'Találatok megtekintése →'}
          </button>
        </div>
      </form>
    </div>
  );
}
