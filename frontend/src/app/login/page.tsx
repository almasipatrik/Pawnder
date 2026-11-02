'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Pawnder is 100% registration-free, redirect to home
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
      <div className="text-center space-y-3 p-6 bg-white rounded-3xl border border-purple-100 petpals-card-shadow max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl mx-auto">
          🐾
        </div>
        <h1 className="text-base font-extrabold text-[#231942]">
          A Pawnder 100%-ban regisztrációmentes!
        </h1>
        <p className="text-xs text-gray-500">
          Bejelentkezés nélkül, azonnal böngészheted és elmentheted a kedvenceidet. Átirányítás a kezdőlapra...
        </p>
      </div>
    </div>
  );
}
