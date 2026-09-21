import React from 'react';

interface OzlindLogoProps {
  className?: string;
  glow?: boolean;
}

export default function OzlindLogo({ className = 'w-8 h-8', glow = true }: OzlindLogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${glow ? 'group' : ''}`}>
      {glow && (
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 rounded-xl opacity-60 blur-md group-hover:opacity-100 transition duration-500" />
      )}
      <svg
        className={`relative z-10 text-white ${className}`}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ozlindGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="ozlindCore" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>

        {/* Outer Hexagonal Shield */}
        <polygon
          points="50,5 88,27 88,73 50,95 12,73 12,27"
          stroke="url(#ozlindGradient)"
          strokeWidth="4"
          strokeLinejoin="round"
          fill="#0c0e18"
          fillOpacity="0.85"
        />

        {/* Angular Z Monogram */}
        <path
          d="M30 35 L70 35 L34 65 L70 65"
          stroke="url(#ozlindGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inner Diamond Core */}
        <polygon
          points="50,28 62,50 50,72 38,50"
          fill="url(#ozlindCore)"
          fillOpacity="0.3"
          stroke="url(#ozlindGradient)"
          strokeWidth="2"
        />

        {/* Core Quantum Node */}
        <circle cx="50" cy="50" r="4.5" fill="#38bdf8" />
      </svg>
    </div>
  );
}
