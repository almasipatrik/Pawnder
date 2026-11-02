'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import PawnderSlider from './components/PawnderSlider';
import PawnderSelect from './components/PawnderSelect';
import PawnderTooltip from './components/PawnderTooltip';
import FilterModal from './components/FilterModal';
import {
  SwipeCardSkeleton,
  MatchesGridSkeleton,
  ImageWithSkeleton,
} from './components/PawnderSkeletons';
import {
  Heart,
  X,
  RotateCcw,
  SlidersHorizontal,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
  Phone,
  Mail,
  Globe,
  ExternalLink,
  Info,
  Home,
  User,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Building2,
  ShieldCheck,
  RefreshCw,
  Navigation,
  Target,
  AlertTriangle,
  Award,
  Search,
  Camera,
} from 'lucide-react';
import {
  apiFetch,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_STORAGE_KEY,
  LOCAL_FILTERS_KEY,
  LOCAL_FILTERS_TOUCHED_KEY,
  LOCAL_SWIPES_KEY,
  LOCAL_SAVED_PETS_KEY,
} from '@/lib/api';
import { trackEvent, trackPageView } from '@/lib/analytics';
import {
  type AnimalRecord,
  type FilterState,
  DEFAULT_FILTERS,
  DROPDOWNS,
  enrichAnimalClientSide,
} from '@/lib/matching';
import {
  POPULAR_CITIES,
  resolveHungarianCoords,
  resolveNearestHungarianLocation,
  reverseGeocodeHungarianLocation,
  estimateRoadDistanceKm,
} from '@/lib/hu-locations';

type ActiveTab = 'SWIPE' | 'MATCHES' | 'PROFILE';

function usePullToDismiss(onDismiss: () => void) {
  const [dragY, setDragY] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ y: number; atTop: boolean } | null>(null);
  const isDraggingRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const isAtTop = containerRef.current ? containerRef.current.scrollTop <= 0 : true;
    touchStartRef.current = { y: e.touches[0].clientY, atTop: isAtTop };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !touchStartRef.current.atTop) return;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    if (dy > 0 && (!containerRef.current || containerRef.current.scrollTop <= 0)) {
      if (e.cancelable) e.preventDefault();
      isDraggingRef.current = true;
      setDragY(dy);
    } else {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setDragY(0);
      }
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragY > 100) {
      onDismiss();
    }
    setDragY(0);
    isDraggingRef.current = false;
    touchStartRef.current = null;
  }, [dragY, onDismiss]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    touchStartRef.current = { y: e.clientY, atTop: true };
    isDraggingRef.current = true;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !touchStartRef.current) return;
    const dy = e.clientY - touchStartRef.current.y;
    if (dy > 0) {
      setDragY(dy);
    } else {
      setDragY(0);
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      if (dragY > 100) {
        onDismiss();
      }
      setDragY(0);
      isDraggingRef.current = false;
      touchStartRef.current = null;
    }
  }, [dragY, onDismiss]);

  const reset = useCallback(() => {
    setDragY(0);
    isDraggingRef.current = false;
    touchStartRef.current = null;
  }, []);

  return {
    dragY,
    containerRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    reset,
  };
}

export default function PawnderApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('SWIPE');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [animals, setAnimals] = useState<AnimalRecord[]>([]);
  const [allAnimalsCatalog, setAllAnimalsCatalog] = useState<AnimalRecord[]>([]);
  const [localSavedPets, setLocalSavedPets] = useState<AnimalRecord[]>([]);
  const [adoptedAnimals, setAdoptedAnimals] = useState<AnimalRecord[]>([]);
  const [loadingAnimals, setLoadingAnimals] = useState(true);
  const [swipedMap, setSwipedMap] = useState<Record<string, 'left' | 'right'>>({});
  const [swipeHistory, setSwipeHistory] = useState<string[]>([]);

  // Fetch complete raw animal pool once for instant live filter counting in FilterModal
  useEffect(() => {
    apiFetch<{ items: AnimalRecord[] }>('/animals')
      .then((res) => {
        if (res && Array.isArray(res.items)) {
          setAllAnimalsCatalog(res.items.filter((a) => !a.is_adopted));
        }
      })
      .catch(() => {});
  }, []);

  // Card animation & photo carousel state
  const [swipeAnim, setSwipeAnim] = useState<'left' | 'right' | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Modals
  const [celebrationAnimal, setCelebrationAnimal] = useState<AnimalRecord | null>(null);
  const [detailAnimal, setDetailAnimal] = useState<AnimalRecord | null>(null);
  const [detailPhotoIdx, setDetailPhotoIdx] = useState(0);
  const [detailTab, setDetailTab] = useState<'INFO' | 'STORY' | 'SHELTER'>('INFO');
  const [filterTab, setFilterTab] = useState<'SEARCH' | 'TRAITS' | 'LOCATION'>('SEARCH');

  // Pull-to-dismiss handlers for modals
  const detailPull = usePullToDismiss(() => setDetailAnimal(null));
  const filterPull = usePullToDismiss(() => setShowFilterModal(false));
  const celebrationPull = usePullToDismiss(() => setCelebrationAnimal(null));

  useEffect(() => {
    if (!detailAnimal) detailPull.reset();
  }, [detailAnimal, detailPull]);

  useEffect(() => {
    if (!showFilterModal) filterPull.reset();
  }, [showFilterModal, filterPull]);

  useEffect(() => {
    if (!celebrationAnimal) celebrationPull.reset();
  }, [celebrationAnimal, celebrationPull]);

  // Prevent background body scrolling when any modal is open
  useEffect(() => {
    if (detailAnimal || celebrationAnimal || showFilterModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [detailAnimal, celebrationAnimal, showFilterModal]);

  // Profile & Local Data state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Track whether initial localStorage filters have been restored before triggering loadAnimals
  const [isFiltersRestored, setIsFiltersRestored] = useState(false);
  const latestRequestIdRef = useRef(0);

  // Load saved filters, swipes, local favorite pet records, and user on mount
  useEffect(() => {
    trackPageView('/', 'Kezdőlap | Pawnder');

    let isFiltersTouched = false;
    let savedFiltersObj: FilterState | null = null;

    try {
      isFiltersTouched = localStorage.getItem(LOCAL_FILTERS_TOUCHED_KEY) === 'true';
      const savedFilters = localStorage.getItem(LOCAL_FILTERS_KEY);
      if (savedFilters) {
        savedFiltersObj = JSON.parse(savedFilters);
        if (savedFiltersObj && typeof savedFiltersObj === 'object') {
          // If user never actively customized filters, sanitize legacy 'kutya' default
          if (!isFiltersTouched && savedFiltersObj.species === 'kutya') {
            savedFiltersObj.species = 'mindegy';
            try {
              localStorage.setItem(LOCAL_FILTERS_KEY, JSON.stringify(savedFiltersObj));
            } catch {}
          }
          setFilters((prev) => ({ ...prev, ...savedFiltersObj }));
        }
      }
      const savedSwipes = localStorage.getItem(LOCAL_SWIPES_KEY);
      if (savedSwipes) {
        setSwipedMap(JSON.parse(savedSwipes));
      }
      const savedPets = localStorage.getItem(LOCAL_SAVED_PETS_KEY);
      if (savedPets) {
        const parsedPets = JSON.parse(savedPets);
        if (Array.isArray(parsedPets)) {
          setLocalSavedPets(parsedPets);
        }
      }
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        if (tab === 'matches') setActiveTab('MATCHES');
        else if (tab === 'profile') setActiveTab('PROFILE');
      }
    } catch {
      // Ignore storage errors
    } finally {
      setIsFiltersRestored(true);
    }
  }, []);

  // Fetch animals whenever filters change
  const loadAnimals = useCallback(async (currentFilters: FilterState) => {
    const thisRequestId = ++latestRequestIdRef.current;
    setLoadingAnimals(true);
    try {
      const params = new URLSearchParams();
      Object.entries(currentFilters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          params.set(k, String(v));
        }
      });

      const res = await apiFetch<{
        total: number;
        swiped_map?: Record<string, 'left' | 'right'>;
        items: AnimalRecord[];
        adopted_items?: AnimalRecord[];
      }>(`/animals?${params.toString()}`);

      // If a newer request has started, discard this stale response!
      if (thisRequestId !== latestRequestIdRef.current) {
        return;
      }

      if (res && Array.isArray(res.items)) {
        const activeItems = res.items.filter((a) => !a.is_adopted);
        setAnimals(activeItems);
        if (!currentFilters.species || currentFilters.species === 'mindegy') {
          setAllAnimalsCatalog((prev) => (prev.length === 0 ? activeItems : prev));
        }
        if (Array.isArray(res.adopted_items)) {
          setAdoptedAnimals(res.adopted_items);
        }
        setLoadingAnimals(false);
        return;
      }
    } catch {
      // Backend unavailable or empty
    }

    if (thisRequestId === latestRequestIdRef.current) {
      setAnimals([]);
      setLoadingAnimals(false);
    }
  }, []);

  const fetchFiltersKey = JSON.stringify(filters);

  useEffect(() => {
    if (!isFiltersRestored) return;
    loadAnimals(JSON.parse(fetchFiltersKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFiltersRestored, fetchFiltersKey, loadAnimals]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_FILTERS_KEY, JSON.stringify(filters));
    } catch {}
  }, [filters]);

  // Deck of unswiped animals ranked by match % (never includes adopted animals!).
  // Hard filters (species, breed, age, size, gender, max distance) strictly exclude non-matching animals.
  // min_match_percent cutoff filters out any animal below tolerance threshold.
  // Age & waiting time respects verified species record lifespans (Bluey 29.5y for dogs, Creme Puff 38y for cats).
  const unswipedAnimals = useMemo(
    () =>
      animals
        .filter(
          (a) =>
            !a.is_adopted &&
            !swipedMap[a.external_id] &&
            a.is_matched !== false &&
            (a.age_years === undefined || a.age_years <= 40) &&
            (a.waiting_days === undefined || a.waiting_days <= 40 * 365) &&
            (filters.species === 'mindegy' || !filters.species || a.species === filters.species) &&
            a.match_percent >= (filters.min_match_percent || 0),
        )
        .sort((a, b) =>
          b.match_percent !== a.match_percent
            ? b.match_percent - a.match_percent
            : b.waiting_days - a.waiting_days,
        ),
    [animals, swipedMap, filters.min_match_percent, filters.species],
  );

  const currentCard = unswipedAnimals[0] || null;
  const nextCard = unswipedAnimals[1] || null;

  useEffect(() => {
    setActivePhotoIdx(0);
  }, [currentCard?.external_id]);

  // Matched animals (swiped right) — includes animals that have since found a home ("Gazdira talált")
  // Resiliently sourced from local cache, full raw catalog, current filtered list, and server matches.
  const matchedAnimals = useMemo(() => {
    const allKnown = new Map<string, AnimalRecord>();
    for (const a of allAnimalsCatalog) {
      allKnown.set(a.external_id, a);
    }
    for (const a of localSavedPets) {
      allKnown.set(a.external_id, a);
    }
    for (const a of adoptedAnimals) {
      allKnown.set(a.external_id, a);
    }
    for (const a of animals) {
      allKnown.set(a.external_id, a);
    }

    const list: AnimalRecord[] = [];
    for (const [id, dir] of Object.entries(swipedMap)) {
      if (dir === 'right' && allKnown.has(id)) {
        list.push(allKnown.get(id)!);
      }
    }
    return list;
  }, [allAnimalsCatalog, localSavedPets, adoptedAnimals, animals, swipedMap]);

  // Auto-fetch profile of any liked animal that is missing from local memory / catalog
  useEffect(() => {
    const rightSwipedIds = Object.entries(swipedMap)
      .filter(([, dir]) => dir === 'right')
      .map(([id]) => id);

    if (rightSwipedIds.length === 0) return;

    const knownIds = new Set([
      ...allAnimalsCatalog.map((a) => a.external_id),
      ...localSavedPets.map((a) => a.external_id),
      ...animals.map((a) => a.external_id),
      ...adoptedAnimals.map((a) => a.external_id),
    ]);

    const missingIds = rightSwipedIds.filter((id) => !knownIds.has(id));

    if (missingIds.length > 0) {
      missingIds.forEach((id) => {
        apiFetch<AnimalRecord>(`/animals/${id}`)
          .then((pet) => {
            if (pet && pet.external_id) {
              setLocalSavedPets((prev) => {
                if (prev.some((p) => p.external_id === pet.external_id)) return prev;
                const next = [pet, ...prev];
                try {
                  localStorage.setItem(LOCAL_SAVED_PETS_KEY, JSON.stringify(next));
                } catch {}
                return next;
              });
            }
          })
          .catch(() => {});
      });
    }
  }, [swipedMap, allAnimalsCatalog, localSavedPets, animals, adoptedAnimals]);


  // Handle Swipe Left / Right
  const handleSwipe = useCallback(
    async (direction: 'left' | 'right', targetAnimal?: AnimalRecord) => {
      const pet = targetAnimal || currentCard;
      if (!pet || swipeAnim) return;

      if (!targetAnimal) {
        setSwipeAnim(direction);
      }

      const finishSwipe = () => {
        setSwipedMap((prev) => {
          const next = { ...prev, [pet.external_id]: direction };
          try {
            localStorage.setItem(LOCAL_SWIPES_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
        // Only allow undo if swiped left (X / pass).
        // If swiped right (like), clear swipe history so undo cannot be used!
        if (direction === 'left') {
          setSwipeHistory((prev) => [...prev, pet.external_id]);
        } else {
          setSwipeHistory([]);
        }
        setSwipeAnim(null);
        setDragOffset({ x: 0, y: 0 });

        if (direction === 'right') {
          setLocalSavedPets((prev) => {
            const exists = prev.some((p) => p.external_id === pet.external_id);
            const next = exists
              ? prev.map((p) => (p.external_id === pet.external_id ? pet : p))
              : [pet, ...prev];
            try {
              localStorage.setItem(LOCAL_SAVED_PETS_KEY, JSON.stringify(next));
            } catch {}
            return next;
          });
          setCelebrationAnimal(pet);
        }
      };

      if (!targetAnimal) {
        setTimeout(finishSwipe, 240);
      } else {
        finishSwipe();
      }

      trackEvent(direction === 'right' ? 'animal_swipe_right' : 'animal_swipe_left', {
        animal_id: pet.external_id,
        animal_name: pet.name,
        species: pet.species,
        match_percent: pet.match_percent,
      });
    },
    [currentCard, swipeAnim],
  );

  // Undo last swipe
  const handleUndo = useCallback(() => {
    if (swipeHistory.length === 0) return;
    const lastId = swipeHistory[swipeHistory.length - 1];
    setSwipeHistory((prev) => prev.slice(0, -1));
    setSwipedMap((prev) => {
      const next = { ...prev };
      delete next[lastId];
      try {
        localStorage.setItem(LOCAL_SWIPES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [swipeHistory]);

  // Reset all left (pass) swipes
  const handleResetPasses = async () => {
    setSwipeHistory([]);
    setSwipedMap((prev) => {
      const next: Record<string, 'left' | 'right'> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v === 'right') next[k] = 'right';
      }
      try {
        localStorage.setItem(LOCAL_SWIPES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Remove a saved match
  const handleRemoveMatch = async (animalId: string) => {
    setSwipedMap((prev) => {
      const next = { ...prev };
      delete next[animalId];
      try {
        localStorage.setItem(LOCAL_SWIPES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    setLocalSavedPets((prev) => {
      const next = prev.filter((p) => p.external_id !== animalId);
      try {
        localStorage.setItem(LOCAL_SAVED_PETS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Keyboard navigation on Swipe tab + Escape to close modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (deleteConfirmOpen) return;

      if (e.key === 'Escape') {
        if (celebrationAnimal) {
          setCelebrationAnimal(null);
          return;
        }
        if (detailAnimal) {
          setDetailAnimal(null);
          return;
        }
        if (showFilterModal) {
          setShowFilterModal(false);
          return;
        }
      }

      // In datasheet modal: navigate photos with left/right keyboard arrows
      if (detailAnimal) {
        const photos = (detailAnimal.image_links || []).filter(
          (u): u is string => typeof u === 'string' && u.trim().length > 0,
        );
        if (photos.length > 1) {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setDetailPhotoIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setDetailPhotoIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
          }
        }
        return;
      }

      if (
        activeTab !== 'SWIPE' ||
        celebrationAnimal ||
        showFilterModal
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') handleSwipe('left');
      if (e.key === 'ArrowRight') handleSwipe('right');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, celebrationAnimal, detailAnimal, showFilterModal, handleSwipe]);

  // Browser GPS Geolocation
  const handleUseGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('A böngésződ nem támogatja a helymeghatározást.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const local = resolveNearestHungarianLocation(lat, lng);

        try {
          localStorage.setItem(LOCAL_FILTERS_TOUCHED_KEY, 'true');
        } catch {}

        setFilters((prev) => ({
          ...prev,
          lat,
          lng,
          city: local.city,
          postal_code: local.postalCode,
        }));
        trackEvent('gps_location_used');

        try {
          const refined = await reverseGeocodeHungarianLocation(lat, lng);
          setFilters((prev) => ({
            ...prev,
            city: refined.city || prev.city,
            postal_code: refined.postalCode || prev.postal_code,
          }));
        } catch (err) {
          console.warn('GPS geocoding error:', err);
        }
      },
      () => {
        alert('Nem sikerült lekérni a GPS pozíciót. Kérjük, válassz települést a listából!');
      },
    );
  };

  // Only apply filters & refresh the animal list when user clicks the "Találatok" button
  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    setShowFilterModal(false);
    try {
      localStorage.setItem(LOCAL_FILTERS_KEY, JSON.stringify(newFilters));
      localStorage.setItem(LOCAL_FILTERS_TOUCHED_KEY, 'true');
    } catch {}
    // Instant client-side re-enrichment so the deck updates with 0ms latency
    setAnimals((prev) => {
      const source = allAnimalsCatalog.length > 0 ? allAnimalsCatalog : prev;
      return source.map((a) => enrichAnimalClientSide(a, newFilters));
    });
  };

  // Instant species toggle (Mind / Kutya / Macska)
  const handleSpeciesChange = (newSpecies: 'mindegy' | 'kutya' | 'macska') => {
    try {
      localStorage.setItem(LOCAL_FILTERS_TOUCHED_KEY, 'true');
    } catch {}
    const nextFilters: FilterState = {
      ...filters,
      species: newSpecies,
      breed: 'Any',
    };
    setFilters(nextFilters);
    // Instant client-side re-enrichment so the deck updates with 0ms latency
    setAnimals((prev) => {
      const source = allAnimalsCatalog.length > 0 ? allAnimalsCatalog : prev;
      return source.map((a) => enrichAnimalClientSide(a, nextFilters));
    });
  };

  // Clear Local Data (GDPR Right to Erasure / Local Reset)
  const handleClearLocalData = () => {
    localStorage.removeItem(LOCAL_SWIPES_KEY);
    localStorage.removeItem(LOCAL_FILTERS_KEY);
    localStorage.removeItem(LOCAL_FILTERS_TOUCHED_KEY);
    localStorage.removeItem(LOCAL_SAVED_PETS_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setSwipedMap({});
    setLocalSavedPets([]);
    setFilters(DEFAULT_FILTERS);
    setDeleteConfirmOpen(false);
    alert(
      'Minden helyi mentett adatod (kedvencek, szűrők) sikeresen törlésre került a böngésződből.',
    );
  };

  // Breed options based on selected species
  const activeBreedOptions = useMemo(() => {
    if (filters.species === 'kutya') return DROPDOWNS.dogBreeds;
    if (filters.species === 'macska') return DROPDOWNS.catBreeds;
    // Combine both if 'mindegy'
    const map = new Map<string, { value: string; label: string }>();
    for (const b of [...DROPDOWNS.dogBreeds, ...DROPDOWNS.catBreeds]) {
      if (!map.has(b.value)) map.set(b.value, b);
    }
    return Array.from(map.values());
  }, [filters.species]);

  // Helper to extract phone & email from contact string
  const parseContactInfo = (contactStr: string) => {
    const emailMatch = contactStr.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = contactStr.match(/(?:\+?36|06|\b20|\b30|\b70|\b1)[\d\s/-]{6,14}/);
    return {
      email: emailMatch ? emailMatch[0] : '',
      phone: phoneMatch ? phoneMatch[0].trim() : '',
    };
  };

  return (
    <div
      className={
        activeTab === 'SWIPE'
          ? 'h-[100dvh] overflow-hidden flex flex-col'
          : 'min-h-[100dvh] flex flex-col pb-20'
      }
    >
      {/* =====================================================================
          TOP HEADER BAR (Pawnder Logo + Location Pill)
         ===================================================================== */}
      <header className="sticky top-0 z-30 shrink-0 bg-white/90 backdrop-blur-md border-b border-purple-100/80 px-3 sm:px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('SWIPE')}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
          >
            <img
              src="/logo.png"
              alt="Pawnder"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover border border-purple-200/80 shadow-xs group-hover:scale-105 transition bg-white"
            />
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#231942]">
              Pawnder
            </span>
          </button>

          <PawnderTooltip title="Távolság és saját helyzet beállítása" placement="bottom">
            <button
              type="button"
              onClick={() => {
                setFilterTab('LOCATION');
                setShowFilterModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-bold transition cursor-pointer"
              aria-label="Távolság és saját helyzet"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>{filters.city}</span>
              <span className="text-purple-700">
                {filters.max_distance_km >= 500
                  ? '• Országos'
                  : `• ${filters.max_distance_km} km`}
              </span>
            </button>
          </PawnderTooltip>
        </div>
      </header>

      {/* =====================================================================
          MAIN CONTENT AREA
         ===================================================================== */}
      <main
        className={
          activeTab === 'SWIPE'
            ? 'flex-1 min-h-0 max-w-5xl w-full mx-auto px-3 pt-3.5 sm:pt-6 pb-[64px] flex flex-col overflow-hidden'
            : 'flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 pt-4 pb-24'
        }
      >
        {/* -------------------------------------------------------------------
            TAB 1: KEZDŐLAP — TINDER SWIPE DECK (Fits 100% on 1 mobile screen!)
           ------------------------------------------------------------------- */}
        {activeTab === 'SWIPE' && (
          <div className="max-w-md w-full mx-auto flex-1 min-h-0 flex flex-col items-center justify-between">
            {/* Compact Hero Title + Mind / Kutya / Macska / Szűrők Bar */}
            <div className="text-center pt-1 sm:pt-2 mb-2 shrink-0 w-full space-y-1.5">
              <div>
                <h1 className="text-lg sm:text-2xl font-extrabold text-[#231942] leading-tight">
                  Találd meg a tökéletes társadat!
                </h1>
                <p className="text-[11px] sm:text-xs text-gray-600">
                  Húzz jobbra, ha örökbefogadnád, vagy balra, ha nem az igazi.
                </p>
              </div>

              <div className="flex items-center justify-center gap-1.5">
                <div className="flex items-center bg-purple-100/80 p-0.5 rounded-xl border border-purple-200/70">
                  {[
                    { id: 'mindegy', label: '🐾 Mind' },
                    { id: 'kutya', label: '🐶 Kutya' },
                    { id: 'macska', label: '🐱 Macska' },
                  ].map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => handleSpeciesChange(sp.id as any)}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                        filters.species === sp.id
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'text-[#231942]/80 hover:text-[#231942]'
                      }`}
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFilterTab('SEARCH');
                    setShowFilterModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#231942] hover:bg-purple-900 text-white text-[11px] sm:text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Szűrők</span>
                </button>
              </div>
            </div>

            {loadingAnimals ? (
              <SwipeCardSkeleton />
            ) : !currentCard ? (
              <div className="w-full flex-1 min-h-0 rounded-3xl bg-white border border-purple-100 petpals-card-shadow p-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-2xl">
                  🐶
                </div>
                <h3 className="text-lg font-extrabold text-[#231942]">
                  Végignéztél minden jelenlegi jelöltet!
                </h3>
                <p className="text-xs text-gray-600 max-w-xs mx-auto leading-relaxed">
                  Csökkentsd a minimum egyezést a Szűrőkben (így a kicsit eltérő állatok is megjelennek), vagy nézd meg újra a korábban balra húzott állatokat!
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1 w-full">
                  <button
                    type="button"
                    onClick={handleResetPasses}
                    className="px-4 py-2.5 rounded-2xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold shadow-md shadow-purple-700/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Kihagyott állatok újrakezdése</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFilterModal(true)}
                    className="px-4 py-2.5 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Szűrők módosítása</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* FLEXIBLE CARD STACK CONTAINER (auto-scales to fit mobile screen without scroll) */}
                <div className="relative w-full flex-1 min-h-0 max-h-[520px] select-none">
                  {/* Peeking Next Card in Background */}
                  {nextCard && (
                    <div
                      key={`bg-${nextCard.external_id}`}
                      className="absolute inset-0 bg-white rounded-[26px] border border-purple-100/80 p-3 transform -rotate-2 scale-[0.96] translate-y-1.5 opacity-65 pointer-events-none petpals-soft-shadow flex flex-col"
                    >
                      <div className="w-full flex-1 min-h-0 rounded-2xl overflow-hidden bg-purple-950/10 relative flex items-center justify-center">
                        {(nextCard.image_links[0] || nextCard.thumbnail_url) ? (
                          <>
                            <img
                              src={nextCard.image_links[0] || nextCard.thumbnail_url}
                              alt=""
                              aria-hidden="true"
                              className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-35 pointer-events-none"
                            />
                            <img
                              src={nextCard.image_links[0] || nextCard.thumbnail_url}
                              alt={nextCard.name}
                              className="relative z-10 w-full h-full object-contain"
                            />
                          </>
                        ) : (
                          <span className="text-4xl text-purple-200">🐾</span>
                        )}
                      </div>
                      <div className="h-24 shrink-0" />
                    </div>
                  )}

                  {/* Active Foreground Swipe Card */}
                  <div
                    key={currentCard.external_id}
                    onPointerDown={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      dragStartRef.current = { x: e.clientX, y: e.clientY };
                    }}
                    onPointerMove={(e) => {
                      if (!dragStartRef.current) return;
                      const dx = e.clientX - dragStartRef.current.x;
                      const dy = e.clientY - dragStartRef.current.y;
                      setDragOffset({ x: dx, y: dy * 0.3 });
                    }}
                    onPointerUp={() => {
                      if (!dragStartRef.current) return;
                      dragStartRef.current = null;
                      if (dragOffset.x > 95) {
                        handleSwipe('right');
                      } else if (dragOffset.x < -95) {
                        handleSwipe('left');
                      } else {
                        setDragOffset({ x: 0, y: 0 });
                      }
                    }}
                    onPointerLeave={() => {
                      if (dragStartRef.current) {
                        dragStartRef.current = null;
                        setDragOffset({ x: 0, y: 0 });
                      }
                    }}
                    style={{
                      transform:
                        swipeAnim === 'right'
                          ? 'translateX(380px) rotate(16deg)'
                          : swipeAnim === 'left'
                            ? 'translateX(-380px) rotate(-16deg)'
                            : `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.04}deg)`,
                      opacity: swipeAnim ? 0 : 1,
                      transition: dragStartRef.current
                        ? 'none'
                        : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease',
                    }}
                    className="absolute inset-0 bg-white rounded-[26px] border border-purple-100 p-2.5 sm:p-3.5 flex flex-col justify-between petpals-card-shadow cursor-grab active:cursor-grabbing touch-pan-y"
                  >
                    {/* Swipe visual stamp overlays */}
                    {dragOffset.x > 45 && (
                      <div className="absolute top-6 left-6 z-20 px-3.5 py-1 rounded-xl border-4 border-emerald-500 text-emerald-600 bg-white/95 font-black text-sm sm:text-base uppercase -rotate-12 shadow-lg">
                        ÖRÖKBEFOGADNÁM ❤️
                      </div>
                    )}
                    {dragOffset.x < -45 && (
                      <div className="absolute top-6 right-6 z-20 px-3.5 py-1 rounded-xl border-4 border-rose-500 text-rose-600 bg-white/95 font-black text-sm sm:text-base uppercase rotate-12 shadow-lg">
                        TOVÁBB ✖
                      </div>
                    )}

                    {/* Photo Container (flex-1 min-h-0 so it adapts to mobile viewport height) */}
                    <div
                      onClick={(e) => {
                        // Do NOT open detail modal if user clicked on photo-switch arrows or indicators
                        if ((e.target as HTMLElement).closest('button')) return;
                        if (Math.abs(dragOffset.x) < 8 && Math.abs(dragOffset.y) < 8) {
                          setDetailTab('INFO');
                          setDetailAnimal(currentCard);
                          setDetailPhotoIdx(activePhotoIdx);
                        }
                      }}
                      title="Kattints a képre a részletes adatlap megnyitásához"
                      className="relative w-full flex-1 min-h-0 rounded-[20px] overflow-hidden bg-purple-950/10 cursor-pointer group"
                    >
                      <ImageWithSkeleton
                        key={`${currentCard.external_id}-${activePhotoIdx}`}
                        src={
                          currentCard.image_links[activePhotoIdx] ||
                          currentCard.image_links[0] ||
                          currentCard.thumbnail_url
                        }
                        alt={currentCard.name}
                        className="w-full h-full"
                        imgClassName="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-200"
                        draggable={false}
                      />

                      {/* Story-style photo progress bars if multiple photos exist */}
                      {currentCard.image_links.length > 1 && (
                        <div className="absolute top-2 left-2.5 right-2.5 flex gap-1.5 z-30">
                          {currentCard.image_links.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              aria-label={`${idx + 1}. fotó`}
                              onPointerDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setActivePhotoIdx(idx);
                              }}
                              className={`h-1.5 flex-1 rounded-full transition cursor-pointer ${
                                idx === activePhotoIdx
                                  ? 'bg-white shadow-xs'
                                  : 'bg-white/45 hover:bg-white/70'
                              }`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Left / Right photo arrows (z-30 so they sit strictly on top of image and capture clicks) */}
                      {currentCard.image_links.length > 1 && (
                        <>
                          <button
                            type="button"
                            aria-label="Előző fotó"
                            title="Előző fotó"
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setActivePhotoIdx((prev) =>
                                prev > 0
                                  ? prev - 1
                                  : currentCard.image_links.length - 1,
                              );
                            }}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/45 hover:bg-black/70 active:bg-black/80 text-white flex items-center justify-center transition shadow-md cursor-pointer hover:scale-105 active:scale-95"
                          >
                            <ChevronLeft className="w-5 h-5 pointer-events-none" />
                          </button>
                          <button
                            type="button"
                            aria-label="Következő fotó"
                            title="Következő fotó"
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setActivePhotoIdx((prev) =>
                                prev < currentCard.image_links.length - 1
                                  ? prev + 1
                                  : 0,
                              );
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/45 hover:bg-black/70 active:bg-black/80 text-white flex items-center justify-center transition shadow-md cursor-pointer hover:scale-105 active:scale-95"
                          >
                            <ChevronRight className="w-5 h-5 pointer-events-none" />
                          </button>
                        </>
                      )}

                      {/* TOP-RIGHT: Match Percentage Badge (z-20 so it is strictly above the image) */}
                      <div
                        className={`absolute ${
                          currentCard.image_links.length > 1 ? 'top-5' : 'top-3'
                        } right-2.5 z-20 pointer-events-none bg-white/95 backdrop-blur-md px-3 py-1 rounded-full shadow-md flex items-center gap-1 border border-rose-100`}
                      >
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                        <span className="text-xs font-extrabold text-[#231942]">
                          {currentCard.match_percent}% egyezés
                        </span>
                      </div>

                      {/* BOTTOM-LEFT OVER PHOTO: Distance & City Badge (z-20 so it is strictly above the image) */}
                      <div className="absolute bottom-2.5 left-2.5 z-20 pointer-events-none bg-black/65 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold flex items-center gap-1 shadow-md border border-white/10">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                        <span>
                          {currentCard.shelter_city} • ~{currentCard.distance_km} km légvonal
                        </span>
                      </div>
                    </div>

                    {/* Card Details Body (Compact so card fits on 1 screen) */}
                    <div className="pt-2 shrink-0 space-y-1.5">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h2
                            onClick={() => {
                              setDetailTab('INFO');
                              setDetailAnimal(currentCard);
                              setDetailPhotoIdx(activePhotoIdx);
                            }}
                            className="text-lg sm:text-xl font-extrabold text-[#231942] hover:text-purple-700 truncate flex items-center gap-1 cursor-pointer leading-tight"
                          >
                            <span>{currentCard.name}</span>
                            <span
                              className={
                                currentCard.gender === 'Female'
                                  ? 'text-rose-500 text-lg'
                                  : 'text-blue-600 text-lg'
                              }
                            >
                              {currentCard.gender === 'Female' ? '♀' : '♂'}
                            </span>
                          </h2>

                          <button
                            type="button"
                            onClick={() => {
                              setDetailTab('INFO');
                              setDetailAnimal(currentCard);
                              setDetailPhotoIdx(0);
                            }}
                            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-xl transition shrink-0 cursor-pointer"
                          >
                            Adatlap →
                          </button>
                        </div>

                        <p className="text-[11px] sm:text-xs text-gray-600 font-medium truncate">
                          {currentCard.age_text || 'Felnőtt'} •{' '}
                          {currentCard.size === 'Small'
                            ? 'Kisméretű'
                            : currentCard.size === 'Large'
                              ? 'Nagyméretű'
                              : 'Közepes méretű'}{' '}
                          • {currentCard.breed}
                        </p>
                      </div>

                      {/* VÁRAKOZÁSI IDŐ INFÓ (SKÁLA NÉLKÜL) */}
                      <div className="bg-purple-50/70 border border-purple-100 rounded-xl px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold">
                          <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span
                            className={
                              currentCard.waiting_urgency === 'critical'
                                ? 'text-rose-600 font-extrabold'
                                : currentCard.waiting_urgency === 'long'
                                  ? 'text-amber-700 font-extrabold'
                                  : 'text-purple-700 font-extrabold'
                            }
                          >
                            {currentCard.waiting_label}
                          </span>
                        </div>
                      </div>

                      {/* Trait Chips */}
                      <div className="flex flex-wrap gap-1">
                        {currentCard.trait_badges.slice(0, 3).map((tb, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                              tb.color === 'blue'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200/60'
                                : tb.color === 'emerald'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                                  : tb.color === 'purple'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                    : tb.color === 'rose'
                                      ? 'bg-rose-50 text-rose-800 border border-rose-200/60'
                                      : 'bg-amber-50 text-amber-900 border border-amber-200/60'
                            }`}
                          >
                            <span>{tb.icon}</span>
                            <span>{tb.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* COMPACT CIRCULAR ACTION BUTTONS BELOW CARD */}
                <div className="shrink-0 flex items-center justify-center gap-4 pt-2 pb-1">
                  <PawnderTooltip
                    title={
                      swipeHistory.length === 0
                        ? 'Csak kihagyott (X) állatot lehet visszavonni'
                        : 'Utolsó kihagyott állat visszahozatala'
                    }
                    placement="top"
                  >
                    <span>
                      <button
                        type="button"
                        onClick={handleUndo}
                        disabled={swipeHistory.length === 0}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-sm flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
                        aria-label="Visszavonás"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </span>
                  </PawnderTooltip>

                  <PawnderTooltip title="Balra húzás (Nem az igazi)" placement="top">
                    <button
                      type="button"
                      onClick={() => handleSwipe('left')}
                      className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-purple-100/90 hover:bg-purple-200 text-[#231942] border-2 border-white shadow-md flex items-center justify-center transition hover:scale-105 active:scale-95 cursor-pointer"
                      aria-label="Balra húzás (Nem az igazi)"
                    >
                      <X className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.75]" />
                    </button>
                  </PawnderTooltip>

                  <PawnderTooltip title="Jobbra húzás (Örökbefogadnám!)" placement="top">
                    <button
                      type="button"
                      onClick={() => handleSwipe('right')}
                      className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 hover:from-rose-500 hover:to-rose-700 text-white border-2 border-white shadow-lg shadow-rose-500/30 flex items-center justify-center transition hover:scale-105 active:scale-95 cursor-pointer"
                      aria-label="Jobbra húzás (Örökbefogadnám!)"
                    >
                      <Heart className="w-6 h-6 sm:w-7 sm:h-7 fill-white" />
                    </button>
                  </PawnderTooltip>

                  <PawnderTooltip title="Részletes adatlap és menhely infó" placement="top">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailTab('INFO');
                        setDetailAnimal(currentCard);
                        setDetailPhotoIdx(0);
                      }}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-sm flex items-center justify-center transition cursor-pointer"
                      aria-label="Részletes adatlap"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </PawnderTooltip>
                </div>
              </>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 2: KEDVENCEIM (SAVED MATCHES & SHELTER CONTACT HUB)
           ------------------------------------------------------------------- */}
        {activeTab === 'MATCHES' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-3xl p-5 sm:p-6 border border-purple-100 petpals-soft-shadow">
              <div className="max-w-2xl">
                <h1 className="text-2xl font-extrabold text-[#231942] flex items-center gap-2">
                  <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
                  <span>Kedvenceim ({matchedAnimals.length})</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                  Az itt szereplő állatoknál jelezted, hogy szívesen örökbefogadnád őket! Kedvenceidet a böngésződ biztonságosan elmentette ezen a készüléken (localStorage), így bármikor visszatérhetsz hozzájuk.
                </p>
              </div>
            </div>

            {loadingAnimals && matchedAnimals.length === 0 ? (
              <MatchesGridSkeleton count={4} />
            ) : matchedAnimals.length === 0 ? (
              <div className="bg-white rounded-3xl border border-purple-100 p-10 text-center space-y-4 petpals-soft-shadow">
                <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-3xl">
                  💝
                </div>
                <h3 className="text-lg font-extrabold text-[#231942]">
                  Még nincs elmentett kedvenced
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
                  A Kezdőlapon húzd jobbra (vagy nyomd meg a ❤️ gombot) azoknál a kutyusoknál és cicáknál, akikkel szívesen megismerkednél!
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('SWIPE')}
                  className="px-6 py-3 rounded-2xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Állatok böngészése most →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matchedAnimals.map((pet) => {
                  const contact = parseContactInfo(pet.contact_hu);
                  return (
                    <div
                      key={pet.external_id}
                      className={`bg-white rounded-3xl border p-4 sm:p-5 petpals-soft-shadow flex flex-col justify-between gap-4 min-w-0 max-w-full overflow-hidden ${
                        pet.is_adopted
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : 'border-purple-100'
                      }`}
                    >
                      <div className="flex gap-3 sm:gap-4 min-w-0">
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 aspect-square shrink-0 rounded-2xl overflow-hidden">
                          <ImageWithSkeleton
                            src={pet.image_links[0] || pet.thumbnail_url}
                            alt={pet.name}
                            onClick={() => {
                              setDetailTab('INFO');
                              setDetailAnimal(pet);
                              setDetailPhotoIdx(0);
                            }}
                            className="w-full h-full rounded-2xl"
                            imgClassName="w-full h-full object-contain cursor-pointer hover:opacity-90 transition"
                          />
                          {pet.is_adopted && (
                            <span className="absolute bottom-1.5 left-1.5 right-1.5 z-20 text-center px-2 py-0.5 rounded-lg bg-emerald-600/95 text-white text-[10px] font-extrabold shadow-sm">
                              🏡 Gazdira talált!
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {pet.is_adopted && (
                                <div className="mb-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-extrabold">
                                    🏡 Gazdira talált!
                                  </span>
                                </div>
                              )}
                              <h3 className="text-base sm:text-lg font-extrabold text-[#231942] break-words line-clamp-2 leading-snug" title={pet.name}>
                                <span>{pet.name}</span>{' '}
                                <span
                                  className={
                                    pet.gender === 'Female'
                                      ? 'text-rose-500 inline-block font-bold'
                                      : 'text-blue-600 inline-block font-bold'
                                  }
                                >
                                  {pet.gender === 'Female' ? '♀' : '♂'}
                                </span>
                              </h3>
                            </div>
                            <PawnderTooltip title="Eltávolítás a kedvencekből" placement="left">
                              <button
                                type="button"
                                onClick={() => handleRemoveMatch(pet.external_id)}
                                className="text-gray-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition cursor-pointer shrink-0"
                                aria-label="Eltávolítás a kedvencekből"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </PawnderTooltip>
                          </div>

                          <p className="text-xs text-gray-600 truncate mt-0.5">
                            {pet.age_text} • {pet.size_label} • {pet.breed}
                          </p>
                          <p
                            className={`text-xs font-bold mt-1 flex items-center gap-1 min-w-0 ${
                              pet.is_adopted ? 'text-emerald-700' : 'text-purple-800'
                            }`}
                          >
                            <Clock
                              className={`w-3.5 h-3.5 shrink-0 ${
                                pet.is_adopted ? 'text-emerald-600' : 'text-purple-600'
                              }`}
                            />
                            <span className="truncate">
                              {pet.is_adopted
                                ? '🏡 Gazdira talált! (Már örökbe fogadták)'
                                : pet.waiting_label}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Direct Shelter Contact Box or Adopted Celebration Banner */}
                      {pet.is_adopted ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-2 text-xs min-w-0 max-w-full overflow-hidden">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 min-w-0">
                            <span className="font-extrabold text-emerald-900 flex items-center gap-1.5 min-w-0">
                              <span className="shrink-0">🎉</span>
                              <span className="break-words">Jó hír: {pet.name} már gazdira talált!</span>
                            </span>
                            <span className="text-[11px] font-bold text-emerald-700 shrink-0 self-start sm:self-auto break-words">
                              📍 {pet.shelter_name}
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-800 break-words">
                            Ez a kisállat már lekerült az aktív menhelyi listáról (szerető otthonra lelt), ezért a Tinder-keresőben már nem jelenik meg, de mivel korábban kedvelted, itt láthatod az örömhírt!
                          </p>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setDetailAnimal(pet);
                                setDetailPhotoIdx(0);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs cursor-pointer max-w-full min-w-0"
                            >
                              Mentett adatlap megtekintése →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-purple-50/80 border border-purple-100 rounded-2xl p-3.5 space-y-2 text-xs min-w-0 max-w-full overflow-hidden">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 min-w-0">
                            <div className="font-extrabold text-[#231942] flex items-center gap-1.5 min-w-0">
                              <Building2 className="w-4 h-4 text-purple-700 shrink-0" />
                              <span className="break-words line-clamp-2 sm:truncate" title={pet.shelter_name}>
                                {pet.shelter_name}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-purple-700 shrink-0 self-start sm:self-auto whitespace-nowrap">
                              📍 {pet.shelter_city} {pet.distance_km ? `(~${pet.distance_km} km légvonal)` : ''}
                            </span>
                          </div>

                          <div className="space-y-1 min-w-0 text-[11px]">
                            {pet.shelter_animal_id && (
                              <p className="text-gray-600 break-words">
                                Menhelyi azonosító:{' '}
                                <strong className="text-[#231942]">
                                  #{pet.shelter_animal_id}
                                </strong>
                              </p>
                            )}

                            {pet.shelter_tax_number && (
                              <p className="text-gray-600 break-words">
                                Adószám (1%):{' '}
                                <strong className="text-[#231942] font-mono break-all select-all">
                                  {pet.shelter_tax_number}
                                </strong>
                              </p>
                            )}

                            {pet.shelter_bank_account && (
                              <p className="text-gray-600 break-words">
                                Bankszámla:{' '}
                                <strong className="text-[#231942] font-mono break-all select-all">
                                  {pet.shelter_bank_account}
                                </strong>
                              </p>
                            )}

                            <p className="text-gray-700 break-words">
                              <strong>Elérhetőség:</strong>{' '}
                              <span className="break-all">{pet.contact_hu || 'Lásd a részletes adatlapon'}</span>
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1 min-w-0">
                            {contact.phone && (
                              <a
                                href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs max-w-full min-w-0"
                              >
                                <Phone className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Hívás: {contact.phone}</span>
                              </a>
                            )}
                            {contact.email && (
                              <a
                                href={`mailto:${contact.email}?subject=${encodeURIComponent(
                                  `Örökbefogadási érdeklődés: ${pet.name} (Azonosító: ${pet.shelter_animal_id || pet.external_id})`,
                                )}`}
                                className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs max-w-full min-w-0"
                              >
                                <Mail className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">E-mail a menhelynek</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setDetailAnimal(pet);
                                setDetailPhotoIdx(0);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs cursor-pointer max-w-full min-w-0"
                            >
                              Teljes adatlap & feltételek →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 4: HELYI BEÁLLÍTÁSOK & ADATVÉDELEM (100% REGISZTRÁCIÓMENTES)
           ------------------------------------------------------------------- */}
        {activeTab === 'PROFILE' && (
          <div className="max-w-2xl w-full mx-auto space-y-4 sm:space-y-6">
            {/* Account Card */}
            <div className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-8 petpals-soft-shadow space-y-4 sm:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-purple-100 pb-4 sm:pb-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl font-extrabold shrink-0">
                    🐾
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-base sm:text-xl font-extrabold text-[#231942] leading-tight">
                      Helyi profil & Beállítások
                    </h1>
                    <p className="text-xs text-gray-600 mt-0.5">
                      100%-ban regisztrációmentes! Adataid kizárólag ezen az eszközön tárolódnak.
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0 self-start sm:self-auto">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Névtelen & Biztonságos</span>
                </div>
              </div>

              {/* Search preferences summary */}
              <div className="space-y-3">
                <h2 className="text-sm font-extrabold text-[#231942] flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Keresési beállításaim</span>
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-900 text-[11px] font-bold">
                    🐾 {filters.species === 'mindegy' ? 'Kutya & macska' : filters.species === 'kutya' ? 'Kutya' : 'Macska'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-900 text-[11px] font-bold">
                    📍 {filters.city} • {filters.max_distance_km >= 500 ? 'Országos' : `${filters.max_distance_km} km`}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                    🎯 Min. {filters.min_match_percent}% egyezés
                  </span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTab('SEARCH');
                      setShowFilterModal(true);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Szűrők és helyzet módosítása</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tájékoztató szervezeteknek és menhelyeknek */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-3xl p-4 sm:p-6 petpals-soft-shadow space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-700 shrink-0" />
                <h2 className="text-sm sm:text-base font-extrabold text-[#231942]">
                  Állatvédő szervezeteknek és menhelyeknek
                </h2>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">
                A Pawnder felületén szereplő örökbefogadható kutyák és macskák adatlapjai, fényképei és a szervezeti elérhetőségek az <strong>allatok.info</strong> országos állatvédelmi adatbázisból kerülnek automatikus megjelenítésre.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Amennyiben menhelyként vagy állatvédő egyesületként szeretnéd frissíteni a védenceid adatait, új fotókat feltölteni, vagy jelezni egy állat örökbefogadását, kérjük, végezd el a módosításokat az <strong>allatok.info</strong> rendszerében, és a Pawnder automatikusan szinkronizálja a megjelenítést.
              </p>
              <div className="pt-1">
                <a
                  href="https://www.allatok.info"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  <span>allatok.info weboldal felkeresése</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>
            </div>

            {/* Legal, ÁSZF, GDPR, Impresszum & Self-Service Account Deletion */}
            <div className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-6 petpals-soft-shadow space-y-4">
              <h2 className="text-sm sm:text-base font-extrabold text-[#231942] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0" />
                <span>Impresszum, ÁSZF & Adatvédelem</span>
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed break-words">
                Üzemeltető: <strong>Almási Patrik</strong> (<a href="mailto:almasi.patrik@gmail.com" className="text-purple-700 underline break-all">almasi.patrik@gmail.com</a>). Az oldal 100%-ban non-profit, társadalmi célú kezdeményezés.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Link
                  href="/impresszum"
                  className="px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200 text-center"
                >
                  🏛️ Impresszum
                </Link>
                <Link
                  href="/aszf"
                  className="px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200 text-center"
                >
                  📄 ÁSZF
                </Link>
                <Link
                  href="/adatkezeles"
                  className="px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200 text-center"
                >
                  🛡️ Adatkezelés
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('pawnder_open_cookie_modal'))
                  }
                  className="sm:col-span-3 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer"
                >
                  🍪 Süti beállítások
                </button>
              </div>

              <div className="pt-4 border-t border-rose-100">
                {!deleteConfirmOpen ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Helyi mentett adatok törlése ezen a készüléken</span>
                  </button>
                ) : (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-rose-900 min-w-0">
                        <strong className="block text-sm">
                          Biztosan törölni szeretnéd a mentett adataidat?
                        </strong>
                        A böngésződből azonnal törlődik minden mentett kedvenc állatod és keresési beállításod erről a készülékről.
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={handleClearLocalData}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Igen, törlöm a helyi adatokat
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmOpen(false)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white text-gray-700 border border-gray-200 text-xs font-bold cursor-pointer"
                      >
                        Mégse
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          MATCH CELEBRATION MODAL (1-Screen Mobile Optimized: "95% egyezés!")
         ===================================================================== */}
      {celebrationAnimal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setCelebrationAnimal(null)}
          style={{
            backgroundColor: celebrationPull.dragY > 0
              ? `rgba(0, 0, 0, ${Math.max(0.1, 0.55 - (celebrationPull.dragY / 350) * 0.45)})`
              : undefined,
          }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-hidden animate-in fade-in duration-200"
        >
          <div
            ref={celebrationPull.containerRef}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={celebrationPull.onTouchStart}
            onTouchMove={celebrationPull.onTouchMove}
            onTouchEnd={celebrationPull.onTouchEnd}
            style={{
              transform: celebrationPull.dragY > 0 ? `translateY(${celebrationPull.dragY}px)` : undefined,
              opacity: celebrationPull.dragY > 0 ? Math.max(0.3, 1 - celebrationPull.dragY / 350) : undefined,
              transition: celebrationPull.dragY > 0 ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease',
            }}
            className="bg-[#faf7f5] border-2 border-purple-200 rounded-[28px] max-w-md w-full max-h-[95dvh] p-4 sm:p-6 text-center relative shadow-2xl flex flex-col justify-between gap-2 sm:gap-3.5 overflow-hidden overscroll-contain"
          >
            {/* Pull-to-dismiss handle */}
            <div
              {...celebrationPull.handleProps}
              className="w-full flex justify-center -mt-2 -mb-1 py-1 cursor-grab active:cursor-grabbing touch-none select-none group shrink-0"
              title="Húzd le a bezáráshoz"
            >
              <div className="w-12 h-1.5 bg-purple-200 group-hover:bg-purple-300 group-active:bg-purple-500 rounded-full transition" />
            </div>

            <button
              type="button"
              aria-label="Bezárás"
              onClick={(e) => {
                e.stopPropagation();
                setCelebrationAnimal(null);
              }}
              className="absolute top-3 right-3 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-rose-50 text-gray-600 hover:text-rose-600 border border-purple-200 flex items-center justify-center shadow-sm cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Double Hearts & Confetti Header */}
            <div className="space-y-0.5 shrink-0">
              <div className="text-2xl sm:text-3xl leading-none animate-bounce">💕</div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#231942] leading-tight">
                {celebrationAnimal.match_percent}% egyezés!
              </h2>
              <p className="text-xs sm:text-sm font-bold text-purple-900">
                {celebrationAnimal.name} tökéletes lehet számodra!
              </p>
            </div>

            {/* Framed Photo with Heart Badge in Corner */}
            <div
              onClick={() => {
                const pet = celebrationAnimal;
                setCelebrationAnimal(null);
                setDetailAnimal(pet);
                setDetailPhotoIdx(0);
                setDetailTab('INFO');
              }}
              title="Kattints a részletes adatlap megnyitásához"
              className="relative w-32 h-32 sm:w-40 sm:h-40 aspect-square mx-auto cursor-pointer group shrink-0"
            >
              <div className="w-full h-full rounded-[22px] overflow-hidden border-4 border-white shadow-lg bg-purple-950/10 relative flex items-center justify-center">
                {(celebrationAnimal.image_links[0] || celebrationAnimal.thumbnail_url) ? (
                  <>
                    <img
                      src={
                        celebrationAnimal.image_links[0] ||
                        celebrationAnimal.thumbnail_url
                      }
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-35 pointer-events-none"
                    />
                    <img
                      src={
                        celebrationAnimal.image_links[0] ||
                        celebrationAnimal.thumbnail_url
                      }
                      alt={celebrationAnimal.name}
                      className="relative z-10 w-full h-full object-contain group-hover:scale-105 transition duration-300"
                    />
                  </>
                ) : (
                  <span className="text-4xl text-purple-300">🐾</span>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-md flex items-center justify-center text-rose-500 border border-rose-100">
                <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-rose-500" />
              </div>
            </div>

            {/* "Miért illik hozzád?" Checklist */}
            <div className="text-left bg-white rounded-2xl p-2.5 sm:p-3.5 border border-purple-100 space-y-1 shrink-0">
              <h3 className="text-xs sm:text-sm font-extrabold text-[#231942] text-center mb-1">
                Miért illik hozzád?
              </h3>
              {celebrationAnimal.match_reasons.slice(0, 3).map((reason, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[11px] sm:text-xs text-gray-700 font-medium leading-snug">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5 fill-emerald-50" />
                  <span className="line-clamp-1">{reason}</span>
                </div>
              ))}
            </div>

            {/* Direct Shelter Contact Callout */}
            <div className="text-left bg-purple-100/75 border border-purple-200 rounded-2xl p-2.5 sm:p-3.5 space-y-1 text-[11px] sm:text-xs shrink-0 min-w-0 overflow-hidden">
              <p className="font-extrabold text-purple-950 flex items-center gap-1.5 min-w-0">
                <Building2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                <span className="break-words line-clamp-1">
                  {celebrationAnimal.shelter_name} ({celebrationAnimal.shelter_city})
                </span>
              </p>
              {celebrationAnimal.shelter_animal_id && (
                <p className="text-gray-700 break-words">
                  Hivatkozási azonosító:{' '}
                  <strong className="text-purple-900">
                    #{celebrationAnimal.shelter_animal_id}
                  </strong>
                </p>
              )}
              {celebrationAnimal.shelter_tax_number && (
                <p className="text-gray-700 break-words">
                  Adószám (1%):{' '}
                  <strong className="text-purple-900 font-mono break-all">
                    {celebrationAnimal.shelter_tax_number}
                  </strong>
                </p>
              )}
              <p className="text-gray-700 font-medium break-words break-all">
                📞 {celebrationAnimal.contact_hu || 'Elérhetőség a részletes adatlapon'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-1.5 sm:space-y-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const pet = celebrationAnimal;
                  setCelebrationAnimal(null);
                  setDetailAnimal(pet);
                  setDetailPhotoIdx(0);
                  setDetailTab('INFO');
                }}
                className="w-full py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-700/25 cursor-pointer transition"
              >
                Részletek & Menhely felkeresése →
              </button>

              <button
                type="button"
                onClick={() => setCelebrationAnimal(null)}
                className="w-full py-2 sm:py-2.5 rounded-full bg-white hover:bg-purple-50 text-[#231942] border border-purple-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nézelődök még</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          FULL ANIMAL & SHELTER DATASHEET MODAL (Non-sticky Header + Large Photo + Stacked Sections)
         ===================================================================== */}
      {detailAnimal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailAnimal(null)}
          style={{
            backgroundColor: detailPull.dragY > 0
              ? `rgba(0, 0, 0, ${Math.max(0.1, 0.6 - (detailPull.dragY / 350) * 0.5)})`
              : undefined,
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-hidden"
        >
          <div
            ref={detailPull.containerRef}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={detailPull.onTouchStart}
            onTouchMove={detailPull.onTouchMove}
            onTouchEnd={detailPull.onTouchEnd}
            style={{
              transform: detailPull.dragY > 0 ? `translateY(${detailPull.dragY}px)` : undefined,
              opacity: detailPull.dragY > 0 ? Math.max(0.3, 1 - detailPull.dragY / 350) : undefined,
              transition: detailPull.dragY > 0 ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease',
            }}
            className="bg-white rounded-[32px] max-w-2xl w-full max-h-[92dvh] overflow-y-auto custom-scrollbar p-4 sm:p-6 relative shadow-2xl space-y-4 my-auto overscroll-contain"
          >
            {/* Pull-to-dismiss handle */}
            <div
              {...detailPull.handleProps}
              className="w-full flex justify-center -mt-2 -mb-2 py-2 cursor-grab active:cursor-grabbing touch-none select-none group"
              title="Húzd le a bezáráshoz"
            >
              <div className="w-12 h-1.5 bg-purple-200 group-hover:bg-purple-300 group-active:bg-purple-500 rounded-full transition" />
            </div>

            {/* Header (Non-sticky: scrolls naturally with the datasheet) */}
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-purple-100">
              <div className="min-w-0 pr-2">
                <span className="text-xs font-extrabold text-purple-700 uppercase block">
                  {detailAnimal.species === 'kutya' ? '🐶 Kutya adatlap' : '🐱 Macska adatlap'} • #{detailAnimal.shelter_animal_id || detailAnimal.external_id}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#231942] flex flex-wrap items-center gap-2 mt-0.5">
                  <span>{detailAnimal.name}</span>
                  <span
                    className={
                      detailAnimal.gender === 'Female'
                        ? 'text-rose-500 shrink-0'
                        : 'text-blue-600 shrink-0'
                    }
                  >
                    {detailAnimal.gender === 'Female' ? '♀' : '♂'}
                  </span>
                </h2>
              </div>
              <button
                type="button"
                aria-label="Bezárás"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailAnimal(null);
                }}
                className="w-9 h-9 rounded-full bg-purple-50 hover:bg-rose-50 text-[#231942] hover:text-rose-600 flex items-center justify-center cursor-pointer shrink-0 z-30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Large Photo Gallery */}
            {(() => {
              const validPhotos = (detailAnimal.image_links || []).filter(
                (url): url is string => typeof url === 'string' && url.trim().length > 0,
              );
              if (validPhotos.length === 0 && detailAnimal.thumbnail_url?.trim()) {
                validPhotos.push(detailAnimal.thumbnail_url.trim());
              }
              const currentPhotoUrl = validPhotos[detailPhotoIdx] || validPhotos[0] || null;

              return (
                <div className="space-y-2.5">
                  <div className="relative w-full aspect-square max-h-[380px] sm:max-h-[440px] rounded-3xl overflow-hidden bg-purple-950/10 border border-purple-100 shadow-xs mx-auto group">
                    <ImageWithSkeleton
                      key={`${detailAnimal.external_id}-${detailPhotoIdx}`}
                      src={currentPhotoUrl}
                      alt={detailAnimal.name}
                      className="w-full h-full select-none"
                      imgClassName="w-full h-full object-contain"
                    />

                    {/* Photo index counter badge */}
                    {validPhotos.length > 1 && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white font-bold text-[11px] shadow-sm z-20 flex items-center gap-1.5 select-none">
                        <Camera className="w-3.5 h-3.5" />
                        <span>
                          {detailPhotoIdx + 1} / {validPhotos.length}
                        </span>
                      </div>
                    )}

                    <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-rose-500 text-white font-extrabold text-xs shadow-lg z-20 select-none">
                      ❤️ {detailAnimal.match_percent}% egyezés
                    </div>

                    {/* Prev / Next photo navigation buttons on the large photo */}
                    {validPhotos.length > 1 && (
                      <>
                        <button
                          type="button"
                          aria-label="Előző fotó"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailPhotoIdx((prev) => (prev > 0 ? prev - 1 : validPhotos.length - 1));
                          }}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-xs transition z-20 cursor-pointer shadow-md opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <ChevronLeft className="w-5 h-5 pointer-events-none" />
                        </button>
                        <button
                          type="button"
                          aria-label="Következő fotó"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailPhotoIdx((prev) => (prev < validPhotos.length - 1 ? prev + 1 : 0));
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-xs transition z-20 cursor-pointer shadow-md opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <ChevronRight className="w-5 h-5 pointer-events-none" />
                        </button>
                      </>
                    )}
                  </div>

                  {validPhotos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto custom-scrollbar pt-1 pb-2 px-1 scroll-smooth">
                      {validPhotos.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setDetailPhotoIdx(idx)}
                          className={`w-16 h-16 rounded-2xl overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                            idx === detailPhotoIdx
                              ? 'border-purple-600 scale-105 shadow-md ring-2 ring-purple-300'
                              : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <ImageWithSkeleton
                            src={imgUrl}
                            alt=""
                            containMode={false}
                            className="w-full h-full"
                            imgClassName="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Várakozási idő (Skála nélkül, tiszta adatmegjelenítés: év, hónap, nap) */}
            <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#231942] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-purple-700" />
                  <span>Várakozási idő:</span>
                </span>
                <span className="px-3 py-1 rounded-full bg-white text-purple-900 font-extrabold text-xs shadow-xs border border-purple-200">
                  {detailAnimal.waiting_label}
                </span>
              </div>

              {/* Dátumok: Befogadás és Elvihető */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-purple-100 text-[11px] text-gray-600 font-medium">
                <div>
                  <span className="text-gray-400 block text-[10px]">Befogadás dátuma:</span>
                  <strong className="text-[#231942]">{detailAnimal.admission_date || '-'}</strong>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Elvihető ekkortól:</span>
                  <strong className="text-[#231942]">{detailAnimal.available_from || 'azonnal'}</strong>
                </div>
              </div>
            </div>

            {/* 1. Részletes jellemzők (Stacked Section 1) */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-[#231942] flex items-center gap-1.5">
                <span>📋 Részletes jellemzők</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {[
                  { label: 'Fajta', value: detailAnimal.breed },
                  { label: 'Életkor', value: detailAnimal.age_text },
                  { label: 'Nem', value: detailAnimal.gender_label || detailAnimal.gender },
                  { label: 'Méret', value: detailAnimal.size_label || detailAnimal.size },
                  {
                    label: 'Ivartalanított-e',
                    value:
                      detailAnimal.spayed === 'Yes'
                        ? '✅'
                        : detailAnimal.spayed === 'No'
                          ? '❌'
                          : 'Nincs adat',
                  },
                  { label: 'Szőr hossza / jellege', value: detailAnimal.coat_type || '-' },
                  { label: 'Szőr színe', value: detailAnimal.coat_color || '-' },
                  {
                    label: 'Embereket szereti-e',
                    value: detailAnimal.people_ok === 'Yes' ? '✅' : detailAnimal.people_ok === 'No' ? '❌' : '-',
                  },
                  {
                    label: 'Gyerekeket szereti-e',
                    value: detailAnimal.kids_ok === 'Yes' ? '✅' : detailAnimal.kids_ok === 'No' ? '❌' : '-',
                  },
                  {
                    label: 'Szobatiszta-e',
                    value: detailAnimal.housebroken === 'Yes' ? '✅' : detailAnimal.housebroken === 'No' ? '❌' : '-',
                  },
                  {
                    label: detailAnimal.species === 'macska' ? 'Fiúcicákkal barátságos-e' : 'Fiúkutyákkal barátságos-e',
                    value: detailAnimal.males_ok === 'Yes' ? '✅' : detailAnimal.males_ok === 'No' ? '❌' : '-',
                  },
                  {
                    label: detailAnimal.species === 'macska' ? 'Lánycicákkal barátságos-e' : 'Lánykutyákkal barátságos-e',
                    value: detailAnimal.females_ok === 'Yes' ? '✅' : detailAnimal.females_ok === 'No' ? '❌' : '-',
                  },
                  {
                    label: detailAnimal.species === 'macska' ? 'Kutyákat szereti-e' : 'Macskákat szereti-e',
                    value: detailAnimal.other_species_ok === 'Yes' ? '✅' : detailAnimal.other_species_ok === 'No' ? '❌' : '-',
                  },
                  {
                    label: 'Javasolt tartás',
                    value: detailAnimal.keep_in_label || detailAnimal.keep_in,
                  },
                  {
                    label: 'Kennel száma',
                    value: detailAnimal.kennel_number || '-',
                  },
                  {
                    label: 'Külföldre fogadható-e',
                    value: detailAnimal.foreign_adoption || '-',
                  },
                ].map((attr, i) => (
                  <div
                    key={i}
                    className="bg-purple-50/60 border border-purple-100 rounded-xl p-2.5"
                  >
                    <span className="text-gray-400 block text-[11px]">{attr.label}</span>
                    <strong className="text-[#231942] font-bold break-words">{attr.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Leírás és megjegyzések (Stacked Section 2) */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-[#231942] flex items-center gap-1.5">
                <span>📖 Leírás és megjegyzések</span>
              </h3>
              <div className="space-y-2.5 text-xs text-gray-700 leading-relaxed">
                {detailAnimal.distinguishing_marks && (
                  <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3.5">
                    <strong className="text-[#231942] block mb-0.5">Ismertetőjegy:</strong>
                    <p className="whitespace-pre-line">{detailAnimal.distinguishing_marks}</p>
                  </div>
                )}
                {detailAnimal.admission_circumstances && (
                  <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3.5">
                    <strong className="text-[#231942] block mb-0.5">Befogadás körülményei:</strong>
                    <p className="whitespace-pre-line">{detailAnimal.admission_circumstances}</p>
                  </div>
                )}
                <div className="bg-purple-50/40 border border-purple-100 rounded-2xl p-4">
                  <strong className="text-[#231942] block mb-1">Részletes jellemzés / Megjegyzés:</strong>
                  <p className="whitespace-pre-line">
                    {detailAnimal.description || 'Részletesebb információért keresd közvetlenül a menhelyet a megadott elérhetőségeken!'}
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Szervezet / Menhely adatai (Stacked Section 3) */}
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3 text-xs min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                <h3 className="text-sm font-extrabold text-[#231942] flex items-center gap-1.5 min-w-0">
                  <Building2 className="w-4 h-4 text-purple-700 shrink-0" />
                  <span className="break-words">Szervezet / Menhely adatai</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-white text-purple-800 font-bold text-[11px] border border-purple-200 self-start sm:self-auto shrink-0 break-words">
                  📍 {detailAnimal.shelter_postal_code} {detailAnimal.shelter_city} {detailAnimal.distance_km ? `(~${detailAnimal.distance_km} km légvonal)` : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-gray-700 min-w-0">
                <div className="min-w-0">
                  <span className="text-gray-400 block text-[11px]">Szervezet neve:</span>
                  <strong className="text-[#231942] break-words block">{detailAnimal.shelter_name}</strong>
                </div>
                <div className="min-w-0">
                  <span className="text-gray-400 block text-[11px]">Cím:</span>
                  <strong className="text-[#231942] break-words block">
                    {detailAnimal.shelter_county ? `${detailAnimal.shelter_county} megye, ` : ''}
                    {detailAnimal.shelter_postal_code} {detailAnimal.shelter_city}, {detailAnimal.shelter_address}
                  </strong>
                </div>
                <div className="min-w-0">
                  <span className="text-gray-400 block text-[11px]">Altatnak-e:</span>
                  <strong className="text-[#231942] block">{detailAnimal.shelter_no_kill || 'nem'}</strong>
                </div>
                {detailAnimal.shelter_tax_number && (
                  <div className="min-w-0">
                    <span className="text-gray-400 block text-[11px]">Adószám (1%):</span>
                    <strong className="text-[#231942] font-mono break-all block select-all">{detailAnimal.shelter_tax_number}</strong>
                  </div>
                )}
                {detailAnimal.shelter_bank_account && (
                  <div className="sm:col-span-2 min-w-0">
                    <span className="text-gray-400 block text-[11px]">Bankszámlaszám:</span>
                    <strong className="text-[#231942] font-mono break-all block select-all">{detailAnimal.shelter_bank_account}</strong>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl p-3 border border-purple-100 space-y-1">
                <span className="text-gray-400 block text-[11px]">
                  Érdeklődni az alábbi elérhetőségeken lehet (Hivatkozási azonosító: #{detailAnimal.shelter_animal_id || detailAnimal.external_id}):
                </span>
                {Array.from(
                  new Set(
                    [detailAnimal.contact_hu, detailAnimal.contact_de, detailAnimal.contact_en]
                      .map((c) => c?.trim())
                      .filter((c): c is string => Boolean(c)),
                  ),
                ).map((contactText, idx) => (
                  <p key={idx} className="font-semibold text-[#231942] break-words">
                    {contactText}
                  </p>
                ))}
              </div>

              {detailAnimal.shelter_adoption_conditions && (
                <div className="bg-white/80 rounded-xl p-3 border border-purple-100">
                  <span className="text-gray-400 block text-[11px] mb-0.5">Örökbefogadás feltételei:</span>
                  <p className="text-gray-700 leading-relaxed">{detailAnimal.shelter_adoption_conditions}</p>
                </div>
              )}

              {/* Tájékoztató szervezeteknek és menhelyeknek az adatok forrásáról */}
              <div className="bg-purple-100/70 border border-purple-200 rounded-xl p-3 flex items-start gap-2.5 text-[11.5px] text-purple-950 leading-snug">
                <Info className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1">
                  <strong className="font-extrabold text-xs text-[#231942] block">
                    Információ szervezeteknek és menhelyeknek:
                  </strong>
                  <p>
                    Az örökbefogadható állatok adatlapjai, fotói és a szervezeti elérhetőségek az <strong>allatok.info</strong> országos állatvédelmi adatbázisból kerülnek megjelenítésre.
                  </p>
                  <p className="text-purple-800 text-[11px]">
                    Amennyiben az adatokban, fotókban vagy az örökbefogadási státuszban módosítás szükséges, kérjük, végezzétek el a frissítést közvetlenül az <strong>allatok.info</strong> weboldalán, és a Pawnder automatikusan szinkronizálja a megjelenítést.
                  </p>
                  {detailAnimal.source_url && (
                    <div className="pt-0.5">
                      <a
                        href={detailAnimal.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-purple-700 hover:text-purple-900 underline decoration-purple-300 hover:decoration-purple-800"
                      >
                        <span>Eredeti adatlap az allatok.info weboldalon</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {detailAnimal.is_adopted ? (
                  <span className="py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
                    <span>🏡</span>
                    <span>Gazdira talált!</span>
                  </span>
                ) : null}

                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                    (filters.postal_code ? `${filters.postal_code} ` : '') + (filters.city || '')
                  )}&destination=${encodeURIComponent(
                    `${detailAnimal.shelter_name || ''} ${detailAnimal.shelter_postal_code || ''} ${detailAnimal.shelter_city || ''} ${detailAnimal.shelter_address || ''}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-4 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Útvonaltervezés (Google Térkép)</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                </a>

                {detailAnimal.shelter_website && (
                  <a
                    href={detailAnimal.shelter_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-4 rounded-xl bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs flex items-center gap-1.5"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Menhely weboldala</span>
                  </a>
                )}

                {detailAnimal.source_url && (
                  <a
                    href={detailAnimal.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-4 rounded-xl bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                    <span>allatok.info adatlap</span>
                  </a>
                )}

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${detailAnimal.shelter_name} ${detailAnimal.shelter_postal_code} ${detailAnimal.shelter_city} ${detailAnimal.shelter_address}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-4 rounded-xl bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Útvonaltervezés a menhelyhez</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ALL 13 FILTERS + DISTANCE + LIFESTYLE MODAL (React Hook Form + Zod)
         ===================================================================== */}
      <FilterModal
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        currentFilters={filters}
        onApply={handleApplyFilters}
        filterTab={filterTab}
        setFilterTab={setFilterTab}
        filterPull={filterPull}
        totalEligibleCount={unswipedAnimals.length}
        allAnimals={allAnimalsCatalog.length > 0 ? allAnimalsCatalog : animals}
        swipedMap={swipedMap}
      />

      {/* =====================================================================
          BOTTOM NAVIGATION BAR (3 Equal Columns with Perfectly Centered "Kedvenceim")
         ===================================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-purple-100 px-4 py-1.5 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-3 items-center">
          <button
            type="button"
            onClick={() => setActiveTab('SWIPE')}
            className={`w-full flex flex-col items-center justify-center gap-0.5 py-1 rounded-2xl transition cursor-pointer ${
              activeTab === 'SWIPE'
                ? 'text-purple-700 font-extrabold'
                : 'text-gray-400 hover:text-gray-700 font-medium'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px]">Kezdőlap</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MATCHES')}
            className={`w-full flex flex-col items-center justify-center gap-0.5 py-1 rounded-2xl transition cursor-pointer ${
              activeTab === 'MATCHES'
                ? 'text-purple-700 font-extrabold'
                : 'text-gray-400 hover:text-gray-700 font-medium'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Heart className="w-5 h-5" />
              {matchedAnimals.length > 0 && (
                <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                  {matchedAnimals.length}
                </span>
              )}
            </div>
            <span className="text-[11px]">Kedvenceim</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            className={`w-full flex flex-col items-center justify-center gap-0.5 py-1 rounded-2xl transition cursor-pointer ${
              activeTab === 'PROFILE'
                ? 'text-purple-700 font-extrabold'
                : 'text-gray-400 hover:text-gray-700 font-medium'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[11px]">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

