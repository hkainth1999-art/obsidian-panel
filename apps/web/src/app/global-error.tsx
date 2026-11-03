'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-[#121216] border border-[#26262e] rounded-xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Application Exception</h2>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {error?.message || 'A critical rendering error occurred while loading Obsidian.'}
            </p>
            {error?.digest && (
              <p className="text-[10px] font-mono text-neutral-500 mt-1">
                Digest: {error.digest}
              </p>
            )}
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Reload Panel
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

