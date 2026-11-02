'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCookieConsent, setCookieConsent, ConsentStatus } from '@/lib/analytics';
import { ShieldCheck, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

export function CookieConsentBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const existing = getCookieConsent();
    const isCookieParam =
      typeof window !== 'undefined' && window.location.search.includes('cookie');
    if (!existing || isCookieParam) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    }

    const handleOpenModal = () => {
      setIsOpen(true);
      setShowDetails(true);
    };

    window.addEventListener('pawnder_open_cookie_modal', handleOpenModal);
    return () => {
      window.removeEventListener('pawnder_open_cookie_modal', handleOpenModal);
    };
  }, []);

  if (!mounted || !isOpen) {
    return null;
  }

  const handleConsent = (status: ConsentStatus) => {
    setCookieConsent(status);
    setIsOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Sütikezelési és adatvédelmi beállítások"
      className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-white/95 backdrop-blur-md border border-purple-200 rounded-3xl p-5 shadow-2xl shadow-purple-950/15 space-y-3.5 text-[#231942]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Pawnder"
              className="w-10 h-10 rounded-2xl object-cover border border-purple-200 shrink-0 bg-white"
            />
            <div>
              <h3 className="text-sm font-extrabold text-[#231942]">
                Sütikezelés & GDPR Analitika
              </h3>
              <p className="text-[11px] text-purple-700 font-medium">
                Pawnder & Google Analytics 4
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleConsent('denied')}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-xl transition cursor-pointer"
            title="Bezárás elutasítással"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          Az oldal biztonságos működéséhez szükséges munkamenet-adatokat, valamint – hozzájárulásod esetén – névtelen látogatottsági statisztikát (Google Analytics 4) használunk. Részletek az{' '}
          <Link href="/adatkezeles" className="text-purple-700 underline font-semibold">
            Adatkezelési Tájékoztatóban
          </Link>{' '}
          és az{' '}
          <Link href="/aszf" className="text-purple-700 underline font-semibold">
            ÁSZF-ben
          </Link>
          .
        </p>

        {showDetails && (
          <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-3 text-[11px] space-y-2.5 text-gray-700">
            <div className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#231942] block">
                  Szükséges működési sütik (Mindig aktív)
                </strong>
                <span className="text-gray-600">
                  A bejelentkezéshez, a kedvenc állatok és a keresési szűrők megjegyzéséhez szükségesek.
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2 pt-2 border-t border-purple-200/60">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#231942] block">
                  Statisztikai & Mérési sütik (Google Analytics 4 – Választható)
                </strong>
                <span className="text-gray-600">
                  Segítenek megérteni, hányan keresnek menhelyi kutyát és macskát az oldalon (Google Consent Mode v2).
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-purple-100">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-[11px] text-purple-700 hover:text-purple-900 font-semibold flex items-center justify-center gap-1 transition py-1 cursor-pointer"
          >
            <span>{showDetails ? 'Kevesebb részlet' : 'Részletes beállítások'}</span>
            {showDetails ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleConsent('denied')}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition cursor-pointer"
            >
              Csak szükségesek
            </button>
            <button
              type="button"
              onClick={() => handleConsent('granted')}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold shadow-md shadow-purple-700/25 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Elfogadom</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

