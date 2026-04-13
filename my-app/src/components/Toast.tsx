'use client';

import { useEffect, useState } from 'react';
import { toast, ToastOptions } from '@/lib/toast';

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastOptions[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((newToasts) => {
      setToasts(newToasts);
    });
    return () => unsubscribe();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-[#5C5C5C] text-white/90 backdrop-blur-md px-5 py-2.5 rounded-full text-[13px] font-medium animate-fade-in flex items-center gap-2.5 shadow-xl border border-white/10 pointer-events-auto transition-all"
        >
          {t.type === 'success' && (
            <svg className="w-4 h-4 opacity-70 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {t.type === 'error' && (
            <svg className="w-4 h-4 opacity-70 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {t.type === 'info' && (
            <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
