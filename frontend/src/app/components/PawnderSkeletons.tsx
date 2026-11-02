'use client';

import React, { useState, useEffect } from 'react';
import Skeleton from '@mui/material/Skeleton';

const SKELETON_SX = {
   bgcolor: 'rgba(139, 92, 246, 0.11)',
  '&::after': {
    background:
      'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.65), transparent)',
  },
};

/**
 * Image component that displays a smooth wave skeleton while the external image URL is loading.
 */
export function ImageWithSkeleton({
  src,
  alt,
  className = '',
  imgClassName = '',
  containMode = true,
  draggable = false,
  onClick,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  containMode?: boolean;
  draggable?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement | HTMLImageElement>) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const cleanSrc = typeof src === 'string' && src.trim().length > 0 ? src.trim() : null;

  if (!cleanSrc || hasError) {
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden bg-purple-50 flex items-center justify-center text-purple-300 ${className}`}
      >
        <span className="text-3xl select-none" aria-label={alt || 'Nincs fotó'}>
          🐾
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden flex items-center justify-center bg-purple-950/10 ${className}`}
    >
      {!loaded && (
        <Skeleton
          variant="rectangular"
          animation="wave"
          width="100%"
          height="100%"
          sx={{
            ...SKELETON_SX,
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Ambient blurred backdrop: fills any non-square space with the photo's natural colors so nothing is cropped */}
      {containMode && (
        <img
          src={cleanSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-35 pointer-events-none select-none"
        />
      )}

      {/* Main crisp uncropped photo (object-contain so 100% of the animal is visible without cropping) */}
      <img
        ref={(el) => {
          if (el && el.complete && el.naturalWidth > 0 && !loaded) {
            setLoaded(true);
          }
        }}
        src={cleanSrc}
        alt={alt}
        draggable={draggable}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setHasError(true);
          setLoaded(true);
        }}
        className={`relative z-10 w-full h-full object-contain transition-opacity duration-200 select-none ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
      />
    </div>
  );
}

/**
 * 1-Screen Tinder Swipe Card + Action Buttons Skeleton for the Kezdőlap (SWIPE) tab.
 */
export function SwipeCardSkeleton() {
  return (
    <>
      <div className="relative w-full flex-1 min-h-0 max-h-[520px] select-none">
        {/* Background peeking card skeleton */}
        <div className="absolute inset-0 bg-white rounded-[26px] border border-purple-100/80 p-3 transform -rotate-2 scale-[0.96] translate-y-1.5 opacity-55 pointer-events-none petpals-soft-shadow" />

        {/* Foreground active card skeleton */}
        <div className="absolute inset-0 bg-white rounded-[26px] border border-purple-100 p-2.5 sm:p-3.5 flex flex-col justify-between petpals-card-shadow">
          {/* Photo area skeleton */}
          <div className="relative w-full flex-1 min-h-0 rounded-[20px] overflow-hidden bg-purple-50/50">
            <Skeleton
              variant="rectangular"
              animation="wave"
              width="100%"
              height="100%"
              sx={SKELETON_SX}
            />
            {/* Top-right match badge placeholder */}
            <div className="absolute top-3 right-3 bg-white/90 px-3 py-1 rounded-full shadow-xs">
              <Skeleton
                variant="rounded"
                animation="wave"
                width={84}
                height={16}
                sx={SKELETON_SX}
              />
            </div>
            {/* Bottom-left city & distance placeholder */}
            <div className="absolute bottom-2.5 left-2.5 bg-white/80 px-2.5 py-1 rounded-full">
              <Skeleton
                variant="rounded"
                animation="wave"
                width={110}
                height={14}
                sx={SKELETON_SX}
              />
            </div>
          </div>

          {/* Card details body skeleton */}
          <div className="pt-2.5 shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton
                variant="rounded"
                animation="wave"
                width="48%"
                height={24}
                sx={{ ...SKELETON_SX, borderRadius: '10px' }}
              />
              <Skeleton
                variant="rounded"
                animation="wave"
                width={72}
                height={24}
                sx={{ ...SKELETON_SX, borderRadius: '12px' }}
              />
            </div>

            <Skeleton
              variant="rounded"
              animation="wave"
              width="70%"
              height={15}
              sx={{ ...SKELETON_SX, borderRadius: '8px' }}
            />

            {/* Waiting time box skeleton */}
            <div className="bg-purple-50/60 border border-purple-100 rounded-xl px-2.5 py-2 space-y-1.5">
              <div className="flex justify-between">
                <Skeleton
                  variant="rounded"
                  animation="wave"
                  width={80}
                  height={12}
                  sx={SKELETON_SX}
                />
                <Skeleton
                  variant="rounded"
                  animation="wave"
                  width={95}
                  height={12}
                  sx={SKELETON_SX}
                />
              </div>
              <Skeleton
                variant="rounded"
                animation="wave"
                width="100%"
                height={6}
                sx={{ ...SKELETON_SX, borderRadius: '999px' }}
              />
            </div>

            {/* Trait chips skeleton */}
            <div className="flex gap-1.5">
              <Skeleton
                variant="rounded"
                animation="wave"
                width={88}
                height={22}
                sx={{ ...SKELETON_SX, borderRadius: '999px' }}
              />
              <Skeleton
                variant="rounded"
                animation="wave"
                width={96}
                height={22}
                sx={{ ...SKELETON_SX, borderRadius: '999px' }}
              />
              <Skeleton
                variant="rounded"
                animation="wave"
                width={78}
                height={22}
                sx={{ ...SKELETON_SX, borderRadius: '999px' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom circular action buttons skeleton */}
      <div className="shrink-0 flex items-center justify-center gap-4 pt-2 pb-1">
        <Skeleton
          variant="circular"
          animation="wave"
          width={42}
          height={42}
          sx={SKELETON_SX}
        />
        <Skeleton
          variant="circular"
          animation="wave"
          width={56}
          height={56}
          sx={SKELETON_SX}
        />
        <Skeleton
          variant="circular"
          animation="wave"
          width={56}
          height={56}
          sx={SKELETON_SX}
        />
        <Skeleton
          variant="circular"
          animation="wave"
          width={42}
          height={42}
          sx={SKELETON_SX}
        />
      </div>
    </>
  );
}

/**
 * Grid Skeleton for Kedvenceim & Matcheim (MATCHES) tab.
 */
export function MatchesGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-5 petpals-soft-shadow flex flex-col justify-between gap-4"
        >
          <div className="flex gap-4">
            <Skeleton
              variant="rounded"
              animation="wave"
              width={104}
              height={104}
              sx={{ ...SKELETON_SX, borderRadius: '16px', flexShrink: 0 }}
            />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton
                variant="rounded"
                animation="wave"
                width={95}
                height={20}
                sx={{ ...SKELETON_SX, borderRadius: '999px' }}
              />
              <Skeleton
                variant="rounded"
                animation="wave"
                width="65%"
                height={24}
                sx={{ ...SKELETON_SX, borderRadius: '8px' }}
              />
              <Skeleton
                variant="rounded"
                animation="wave"
                width="85%"
                height={14}
                sx={{ ...SKELETON_SX, borderRadius: '6px' }}
              />
              <Skeleton
                variant="rounded"
                animation="wave"
                width="55%"
                height={14}
                sx={{ ...SKELETON_SX, borderRadius: '6px' }}
              />
            </div>
          </div>

          <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-3.5 space-y-2">
            <div className="flex justify-between">
              <Skeleton
                variant="rounded"
                animation="wave"
                width="50%"
                height={16}
                sx={SKELETON_SX}
              />
              <Skeleton
                variant="rounded"
                animation="wave"
                width={80}
                height={16}
                sx={SKELETON_SX}
              />
            </div>
            <Skeleton
              variant="rounded"
              animation="wave"
              width="75%"
              height={14}
              sx={SKELETON_SX}
            />
            <div className="flex gap-2 pt-1">
              <Skeleton
                variant="rounded"
                animation="wave"
                width={110}
                height={30}
                sx={{ ...SKELETON_SX, borderRadius: '12px' }}
              />
              <Skeleton
                variant="rounded"
                animation="wave"
                width={130}
                height={30}
                sx={{ ...SKELETON_SX, borderRadius: '12px' }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * List Skeleton for Személyre szabott ajánlások (RECOMMENDATIONS) tab.
 */
export function RecommendationsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-5 petpals-soft-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Skeleton
              variant="rounded"
              animation="wave"
              width={96}
              height={96}
              sx={{ ...SKELETON_SX, borderRadius: '16px', flexShrink: 0 }}
            />
            <div className="flex-1 space-y-2">
              <Skeleton
                variant="rounded"
                animation="wave"
                width={140}
                height={22}
                sx={{ ...SKELETON_SX, borderRadius: '8px' }}
              />
              <Skeleton
                variant="rounded"
                animation="wave"
                width={210}
                height={14}
                sx={{ ...SKELETON_SX, borderRadius: '6px' }}
              />
              <Skeleton
                variant="rounded"
                animation="wave"
                width={130}
                height={14}
                sx={{ ...SKELETON_SX, borderRadius: '6px' }}
              />
              <div className="flex gap-1.5 pt-0.5">
                <Skeleton
                  variant="rounded"
                  animation="wave"
                  width={80}
                  height={20}
                  sx={{ ...SKELETON_SX, borderRadius: '999px' }}
                />
                <Skeleton
                  variant="rounded"
                  animation="wave"
                  width={90}
                  height={20}
                  sx={{ ...SKELETON_SX, borderRadius: '999px' }}
                />
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2 sm:pt-0">
            <Skeleton
              variant="rounded"
              animation="wave"
              width={136}
              height={36}
              sx={{ ...SKELETON_SX, borderRadius: '16px' }}
            />
            <Skeleton
              variant="rounded"
              animation="wave"
              width={96}
              height={30}
              sx={{ ...SKELETON_SX, borderRadius: '12px' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

