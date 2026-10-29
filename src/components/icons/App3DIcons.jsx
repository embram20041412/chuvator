import React from 'react';

/**
 * 3D Claymorphic App Icons derived directly from the reference image.
 * Each icon is vector-rendered with rich radial/linear gradients, 
 * lighting highlights, and depth shadows for pixel-perfect display 
 * across desktop, tablet, and mobile screen resolutions.
 */

// 1. DASHBOARD 3D ICON
export function Dashboard3DIcon({ className = 'w-6 h-6', ...props }) {
  const id = React.useId();
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        {/* Window Shadow */}
        <filter id={`${id}-win-shadow`} x="2" y="6" width="96" height="92" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#1e2238" floodOpacity="0.3" />
        </filter>
        {/* Window Body Gradient */}
        <linearGradient id={`${id}-win-bg`} x1="10" y1="12" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f5978" />
          <stop offset="25%" stopColor="#3c445c" />
          <stop offset="100%" stopColor="#252a3a" />
        </linearGradient>
        {/* Header Bar */}
        <linearGradient id={`${id}-header-bg`} x1="12" y1="12" x2="88" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5d678a" />
          <stop offset="100%" stopColor="#3c435c" />
        </linearGradient>
        {/* Tile Gradients */}
        <linearGradient id={`${id}-tile-red`} x1="20" y1="36" x2="44" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff7b72" />
          <stop offset="100%" stopColor="#ea3943" />
        </linearGradient>
        <linearGradient id={`${id}-tile-blue`} x1="48" y1="36" x2="72" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={`${id}-tile-yellow`} x1="20" y1="56" x2="44" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id={`${id}-tile-orange`} x1="48" y1="56" x2="72" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        {/* Right side bars */}
        <linearGradient id={`${id}-bar-white`} x1="76" y1="36" x2="88" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>

      {/* Main 3D Window Frame */}
      <g filter={`url(#${id}-win-shadow)`}>
        {/* Deep 3D bottom bevel */}
        <rect x="10" y="16" width="80" height="72" rx="16" fill="#1b1e2a" />
        {/* Front surface */}
        <rect x="10" y="12" width="80" height="72" rx="16" fill={`url(#${id}-win-bg)`} />
        {/* Inner Border highlight */}
        <rect x="10.5" y="12.5" width="79" height="71" rx="15.5" stroke="#717c9e" strokeWidth="1" strokeOpacity="0.4" />
      </g>

      {/* Window Header */}
      <path d="M10 26C10 18.268 16.268 12 24 12H76C83.732 12 90 18.268 90 26V28H10V26Z" fill={`url(#${id}-header-bg)`} />
      {/* 3 Header Dots (Red, Yellow, Green) */}
      <circle cx="20" cy="20" r="3" fill="#f87171" />
      <circle cx="28" cy="20" r="3" fill="#fbbf24" />
      <circle cx="36" cy="20" r="3" fill="#34d399" />

      {/* 4 Dashboard Tiles (Left Side) */}
      {/* Red Tile */}
      <rect x="18" y="34" width="18" height="18" rx="5" fill="#b91c1c" />
      <rect x="18" y="32" width="18" height="18" rx="5" fill={`url(#${id}-tile-red)`} />
      {/* Sky Blue Tile */}
      <rect x="40" y="34" width="18" height="18" rx="5" fill="#1d4ed8" />
      <rect x="40" y="32" width="18" height="18" rx="5" fill={`url(#${id}-tile-blue)`} />
      {/* Yellow Tile */}
      <rect x="18" y="56" width="18" height="18" rx="5" fill="#b45309" />
      <rect x="18" y="54" width="18" height="18" rx="5" fill={`url(#${id}-tile-yellow)`} />
      {/* Orange Tile */}
      <rect x="40" y="56" width="18" height="18" rx="5" fill="#c2410c" />
      <rect x="40" y="54" width="18" height="18" rx="5" fill={`url(#${id}-tile-orange)`} />

      {/* Right Side Widgets */}
      {/* Horizontal Bar 1 */}
      <rect x="64" y="33" width="20" height="5" rx="2.5" fill={`url(#${id}-bar-white)`} />
      {/* Horizontal Bar 2 */}
      <rect x="64" y="42" width="14" height="4" rx="2" fill="#94a3b8" />

      {/* Pie Chart Widget */}
      <circle cx="70" cy="58" r="7" fill="#8b5cf6" />
      <path d="M70 58 L70 51 A7 7 0 0 1 77 58 Z" fill="#38bdf8" />
      <path d="M70 58 L77 58 A7 7 0 0 1 70 65 Z" fill="#fbbf24" />

      {/* Mini Bar Chart Widget */}
      <rect x="64" y="70" width="3.5" height="10" rx="1.5" fill="#f97316" />
      <rect x="70" y="66" width="3.5" height="14" rx="1.5" fill="#38bdf8" />
      <rect x="76" y="63" width="3.5" height="17" rx="1.5" fill="#a855f7" />
    </svg>
  );
}

// 2. BOOKING 3D ICON (Desk Calendar with Clock Check)
export function Booking3DIcon({ className = 'w-6 h-6', ...props }) {
  const id = React.useId();
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        {/* Shadow */}
        <filter id={`${id}-cal-shadow`} x="4" y="10" width="92" height="88" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#854d0e" floodOpacity="0.25" />
        </filter>
        {/* Calendar Stand Base */}
        <linearGradient id={`${id}-stand-base`} x1="16" y1="36" x2="84" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e8c9ad" />
          <stop offset="100%" stopColor="#b88d6c" />
        </linearGradient>
        {/* Calendar Page */}
        <linearGradient id={`${id}-page-bg`} x1="20" y1="24" x2="80" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef2f6" />
        </linearGradient>
        {/* Orange Banner Header */}
        <linearGradient id={`${id}-orange-hdr`} x1="22" y1="24" x2="78" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff7043" />
          <stop offset="100%" stopColor="#e64a19" />
        </linearGradient>
        {/* Clock Bezel */}
        <linearGradient id={`${id}-clock-rim`} x1="68" y1="8" x2="94" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffa726" />
          <stop offset="100%" stopColor="#ef6c00" />
        </linearGradient>
      </defs>

      <g filter={`url(#${id}-cal-shadow)`}>
        {/* 3D Triangular Stand Leg (Side & Back) */}
        <path d="M14 74 L28 26 L36 26 L22 78 Z" fill="#9c7353" />
        <path d="M18 78 L26 26 H78 L86 78 Z" fill={`url(#${id}-stand-base)`} />
        
        {/* Calendar Main Sheet Block (White pad with 3D bottom) */}
        <rect x="22" y="27" width="60" height="54" rx="8" fill="#cbd5e1" />
        <rect x="22" y="24" width="60" height="54" rx="8" fill={`url(#${id}-page-bg)`} />

        {/* Calendar Top Orange Banner */}
        <path d="M22 32C22 27.5817 25.5817 24 30 24H74C78.4183 24 82 27.5817 82 32V38H22V32Z" fill={`url(#${id}-orange-hdr)`} />
      </g>

      {/* Spiral Binder Rings (White / Silver cylinders) */}
      <rect x="30" y="18" width="4.5" height="12" rx="2.25" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="42" y="18" width="4.5" height="12" rx="2.25" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="54" y="18" width="4.5" height="12" rx="2.25" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="66" y="18" width="4.5" height="12" rx="2.25" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />

      {/* Calendar Grid Tiles (Dark slate & Orange) */}
      {/* Row 1 */}
      <rect x="29" y="44" width="5.5" height="5.5" rx="1.5" fill="#475569" />
      <rect x="39" y="44" width="5.5" height="5.5" rx="1.5" fill="#475569" />
      <rect x="49" y="44" width="5.5" height="5.5" rx="1.5" fill="#475569" />
      <rect x="59" y="44" width="5.5" height="5.5" rx="1.5" fill="#ff7043" />
      <rect x="69" y="44" width="5.5" height="5.5" rx="1.5" fill="#475569" />

      {/* Row 2 */}
      <rect x="29" y="53" width="5.5" height="5.5" rx="1.5" fill="#475569" />
      <rect x="39" y="53" width="5.5" height="5.5" rx="1.5" fill="#ff7043" />
      <rect x="49" y="53" width="5.5" height="5.5" rx="1.5" fill="#475569" />
      <rect x="59" y="53" width="5.5" height="5.5" rx="1.5" fill="#475569" />
      <rect x="69" y="53" width="5.5" height="5.5" rx="1.5" fill="#ff7043" />

      {/* Row 3 */}
      <rect x="29" y="62" width="5.5" height="5.5" rx="1.5" fill="#475569" />
      <rect x="39" y="62" width="5.5" height="5.5" rx="1.5" fill="#475569" />
      <rect x="49" y="62" width="5.5" height="5.5" rx="1.5" fill="#ff7043" />
      <rect x="59" y="62" width="5.5" height="5.5" rx="1.5" fill="#475569" />
      <rect x="69" y="62" width="5.5" height="5.5" rx="1.5" fill="#475569" />

      {/* Floating 3D Round Clock at Top Right */}
      <g>
        <circle cx="80" cy="22" r="13" fill="#c2410c" />
        <circle cx="80" cy="20" r="13" fill={`url(#${id}-clock-rim)`} />
        <circle cx="80" cy="20" r="9.5" fill="#ffffff" />
        {/* Clock Hands / Checkmark */}
        <path d="M76 20.5 L79 23.5 L84.5 17" stroke="#ea580c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// 3. KASIR 3D ICON (POS Terminal with Flowing Receipt & Gold Coins)
export function Kasir3DIcon({ className = 'w-6 h-6', ...props }) {
  const id = React.useId();
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <filter id={`${id}-pos-shadow`} x="6" y="8" width="88" height="88" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#1e1b4b" floodOpacity="0.25" />
        </filter>
        {/* POS Body Gradient */}
        <linearGradient id={`${id}-pos-base`} x1="32" y1="36" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4338ca" />
          <stop offset="50%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        {/* Flowing Receipt Gradient */}
        <linearGradient id={`${id}-receipt-paper`} x1="16" y1="12" x2="56" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        {/* Coin Gradients */}
        <linearGradient id={`${id}-coin-gold`} x1="60" y1="64" x2="80" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id={`${id}-coin-front`} x1="48" y1="70" x2="68" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>

      <g filter={`url(#${id}-pos-shadow)`}>
        {/* Angled POS Calculator Terminal in background */}
        <path d="M48 30 L80 34 L72 84 L40 78 Z" fill="#1e1b4b" />
        <path d="M46 26 L80 30 L72 82 L38 76 Z" fill={`url(#${id}-pos-base)`} />
        {/* Screen on POS */}
        <polygon points="52,32 76,35 73,45 49,42" fill="#0f172a" />
        <polygon points="53,33 75,36 73,44 51,41" fill="#0284c7" fillOpacity="0.8" />
        {/* POS Keypad Dots */}
        <circle cx="53" cy="52" r="2.5" fill="#a5b4fc" />
        <circle cx="61" cy="53" r="2.5" fill="#a5b4fc" />
        <circle cx="69" cy="54" r="2.5" fill="#a5b4fc" />
        <circle cx="51" cy="60" r="2.5" fill="#a5b4fc" />
        <circle cx="59" cy="61" r="2.5" fill="#a5b4fc" />
        <circle cx="67" cy="62" r="2.5" fill="#a5b4fc" />
        <circle cx="49" cy="68" r="2.5" fill="#f43f5e" />
        <circle cx="57" cy="69" r="2.5" fill="#10b981" />
        <circle cx="65" cy="70" r="2.5" fill="#fbbf24" />

        {/* Flowing 3D Curved Thermal Paper Receipt */}
        {/* Backside shading of curve */}
        <path d="M12 78 C12 70 20 68 26 68 L48 68 C40 68 34 76 34 82 C34 86 28 88 20 88 C14 88 12 84 12 78 Z" fill="#cbd5e1" />
        {/* Main curved receipt body */}
        <path d="M22 14 C22 14 36 12 50 14 C54 14 56 18 56 22 L50 68 C50 74 44 78 38 78 L18 78 C12 78 12 72 16 68 L24 22 C24 18 22 14 22 14 Z" fill={`url(#${id}-receipt-paper)`} />
        {/* Paper top rim */}
        <path d="M22 14 Q36 10 50 14 Q54 15 56 18 L54 22 Q40 18 24 22 Z" fill="#f1f5f9" />
      </g>

      {/* Printed Lines on Paper */}
      <line x1="28" y1="26" x2="48" y2="26" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="32" x2="46" y2="32" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="38" x2="44" y2="38" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="44" x2="48" y2="44" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />

      {/* Dotted Perforation Line */}
      <line x1="25" y1="52" x2="46" y2="52" stroke="#94a3b8" strokeWidth="1.8" strokeDasharray="2.5 2" />

      {/* Large Gold Currency Sign on Receipt */}
      <text x="32" y="66" fill="#f59e0b" fontSize="13" fontWeight="900" fontFamily="sans-serif">$</text>

      {/* 3D Gold Coin 1 (Side) */}
      <circle cx="72" cy="74" r="8" fill="#b45309" />
      <circle cx="72" cy="72" r="8" fill={`url(#${id}-coin-gold)`} />
      <circle cx="72" cy="72" r="6" fill="#f59e0b" stroke="#fef08a" strokeWidth="0.8" />
      <text x="69.5" y="75" fill="#ffffff" fontSize="9" fontWeight="900">$</text>

      {/* 3D Gold Coin 2 (Front) */}
      <circle cx="56" cy="82" r="9" fill="#92400e" />
      <circle cx="56" cy="80" r="9" fill={`url(#${id}-coin-front)`} />
      <circle cx="56" cy="80" r="7" fill="#fbbf24" stroke="#fef9c3" strokeWidth="0.8" />
      <text x="53" y="83.5" fill="#78350f" fontSize="10" fontWeight="900">$</text>
    </svg>
  );
}

// 4. AKADEMI 3D ICON (Graduation Cap on Blue Book)
export function Akademi3DIcon({ className = 'w-6 h-6', ...props }) {
  const id = React.useId();
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <filter id={`${id}-acad-shadow`} x="6" y="14" width="88" height="82" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.3" />
        </filter>
        {/* Book Covers */}
        <linearGradient id={`${id}-book-cover`} x1="18" y1="56" x2="82" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#312e81" />
          <stop offset="60%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        {/* Book Pages */}
        <linearGradient id={`${id}-book-pages`} x1="22" y1="62" x2="80" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        {/* Mortarboard Diamond Top */}
        <linearGradient id={`${id}-cap-top`} x1="50" y1="18" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="35%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        {/* Golden Tassel */}
        <linearGradient id={`${id}-tassel-gold`} x1="72" y1="36" x2="84" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="60%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
      </defs>

      <g filter={`url(#${id}-acad-shadow)`}>
        {/* 3D HARDCOVER BOOK (Bottom) */}
        {/* Book Bottom Cover */}
        <path d="M18 76 L78 86 L86 78 L26 68 Z" fill="#090d16" />
        <path d="M18 74 L78 84 L86 76 L26 66 Z" fill={`url(#${id}-book-cover)`} />
        
        {/* Book White Pages Block */}
        <path d="M22 66 L78 75 L84 70 L28 61 Z" fill="#94a3b8" />
        <path d="M20 68 C20 68 22 74 28 74 L80 82 C82 82 85 80 85 75 L83 68 Z" fill={`url(#${id}-book-pages)`} />
        
        {/* Book Top Cover */}
        <path d="M16 64 C16 64 22 69 28 69 L86 76 L86 72 L26 62 Z" fill="#1e1b4b" />
        <path d="M16 62 C16 62 22 67 28 67 L86 74 L84 70 L26 60 Z" fill={`url(#${id}-book-cover)`} />

        {/* 3D GRADUATION CAP (MORTARBOARD) */}
        {/* Skull Cap Base (Under the diamond top) */}
        <path d="M36 42 C36 42 36 54 50 56 C64 54 64 42 64 42 Z" fill="#0f172a" />
        <path d="M38 43 C38 43 38 52 50 54 C62 52 62 43 62 43 Z" fill="#1f2937" />

        {/* Diamond Top Cap 3D Thickness Edge */}
        <polygon points="50,22 84,36 50,50 16,36" fill="#0b0f19" />
        <polygon points="50,20 84,34 50,48 16,34" fill={`url(#${id}-cap-top)`} />
        {/* Highlight sheen along top edge */}
        <polyline points="16,34 50,20 84,34" stroke="#4b5563" strokeWidth="0.8" />
      </g>

      {/* Golden Button in Center */}
      <ellipse cx="50" cy="34" rx="3" ry="2" fill="#fde047" stroke="#ca8a04" strokeWidth="0.8" />

      {/* Golden Tassel hanging down the right side */}
      <path d="M50 34 Q66 38 74 44" stroke="#ca8a04" strokeWidth="1.8" fill="none" />
      <circle cx="74" cy="44" r="2" fill="#eab308" />
      <path d="M73 45 L71 62 C71 63 76 63 76 62 L74 45 Z" fill={`url(#${id}-tassel-gold)`} />
      {/* Tassel threads highlight */}
      <line x1="73.5" y1="46" x2="73.5" y2="61" stroke="#fef08a" strokeWidth="0.8" />
    </svg>
  );
}

// 5. EVENT & TURNAMEN 3D ICON (Golden Championship Trophy Cup)
export function Event3DIcon({ className = 'w-6 h-6', ...props }) {
  const id = React.useId();
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <filter id={`${id}-trophy-shadow`} x="8" y="10" width="84" height="86" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#78350f" floodOpacity="0.3" />
        </filter>
        {/* Gold Cup Gradient */}
        <linearGradient id={`${id}-gold-body`} x1="26" y1="18" x2="74" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="25%" stopColor="#facc15" />
          <stop offset="60%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
        {/* Handles Gradient */}
        <linearGradient id={`${id}-gold-handle`} x1="14" y1="24" x2="32" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
        {/* Pedestal Base Gradient */}
        <linearGradient id={`${id}-base-wood`} x1="28" y1="74" x2="72" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="50%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
      </defs>

      <g filter={`url(#${id}-trophy-shadow)`}>
        {/* Left Trophy Handle */}
        <path d="M30 24 C14 24 14 48 32 48" stroke={`url(#${id}-gold-handle)`} strokeWidth="5" strokeLinecap="round" fill="none" />
        {/* Right Trophy Handle */}
        <path d="M70 24 C86 24 86 48 68 48" stroke={`url(#${id}-gold-handle)`} strokeWidth="5" strokeLinecap="round" fill="none" />

        {/* Trophy Pedestal Base */}
        {/* Bottom Tier */}
        <rect x="28" y="82" width="44" height="8" rx="3" fill="#361502" />
        <rect x="28" y="80" width="44" height="8" rx="3" fill={`url(#${id}-base-wood)`} />
        {/* Gold Plaque on base */}
        <rect x="36" y="82" width="28" height="4" rx="1" fill="#fde047" stroke="#ca8a04" strokeWidth="0.5" />
        {/* Upper Tier */}
        <rect x="34" y="74" width="32" height="7" rx="2" fill="#582104" />
        <rect x="34" y="72" width="32" height="7" rx="2" fill={`url(#${id}-base-wood)`} />

        {/* Stem connector */}
        <path d="M44 64 L56 64 L53 72 L47 72 Z" fill="#a16207" />
        <rect x="42" y="60" width="16" height="5" rx="2.5" fill="#fde047" />

        {/* Main Trophy Cup Bowl */}
        <path d="M28 18 H72 V36 C72 50 62 60 50 60 C38 60 28 50 28 36 Z" fill="#a16207" />
        <path d="M28 16 H72 V34 C72 48 62 58 50 58 C38 58 28 48 28 34 Z" fill={`url(#${id}-gold-body)`} />
        
        {/* Rim top ellipse */}
        <ellipse cx="50" cy="16" rx="22" ry="4" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
        <ellipse cx="50" cy="16" rx="19" ry="2.5" fill="#eab308" />
      </g>

      {/* 3 Embossed Stars on Trophy Front */}
      {/* Central Big Star */}
      <polygon points="50,28 52,33 57,33.5 53,37 54.5,42 50,39 45.5,42 47,37 43,33.5 48,33" fill="#fef9c3" stroke="#b45309" strokeWidth="0.5" />
      {/* Left Small Star */}
      <polygon points="41,33 42,36 45,36.5 43,39 44,42 41,40 38,42 39,39 37,36.5 40,36" fill="#fde047" stroke="#b45309" strokeWidth="0.4" transform="scale(0.85) translate(6, 4)" />
      {/* Right Small Star */}
      <polygon points="59,33 60,36 63,36.5 61,39 62,42 59,40 56,42 57,39 55,36.5 58,36" fill="#fde047" stroke="#b45309" strokeWidth="0.4" transform="scale(0.85) translate(11, 4)" />
    </svg>
  );
}

// 6. KEUANGAN 3D ICON (Financial Growth Bar Chart with Rocketing Arrow)
export function Keuangan3DIcon({ className = 'w-6 h-6', ...props }) {
  const id = React.useId();
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <filter id={`${id}-fin-shadow`} x="4" y="6" width="92" height="90" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0f766e" floodOpacity="0.25" />
        </filter>
        {/* Bar 1 (Purple/Pink) */}
        <linearGradient id={`${id}-bar-purple`} x1="16" y1="58" x2="32" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        {/* Bar 2 (Orange/Amber) */}
        <linearGradient id={`${id}-bar-amber`} x1="36" y1="44" x2="52" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="50%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        {/* Bar 3 (Cyan/Blue) */}
        <linearGradient id={`${id}-bar-blue`} x1="56" y1="30" x2="72" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        {/* Bar 4 (Deep Indigo) */}
        <linearGradient id={`${id}-bar-indigo`} x1="76" y1="46" x2="90" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        {/* Ascending Green 3D Arrow */}
        <linearGradient id={`${id}-arrow-green`} x1="16" y1="56" x2="88" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      <g filter={`url(#${id}-fin-shadow)`}>
        {/* Column 1 (Left - Shortest) */}
        <rect x="16" y="60" width="14" height="24" rx="4" fill="#6b21a8" />
        <rect x="16" y="58" width="14" height="24" rx="4" fill={`url(#${id}-bar-purple)`} />
        {/* Column 1 Bevel Top */}
        <rect x="17" y="58.5" width="12" height="3" rx="1.5" fill="#fdf2f8" fillOpacity="0.8" />

        {/* Column 2 (Middle-Left) */}
        <rect x="36" y="46" width="14" height="38" rx="4" fill="#9a3412" />
        <rect x="36" y="44" width="14" height="38" rx="4" fill={`url(#${id}-bar-amber)`} />
        {/* Column 2 Bevel Top */}
        <rect x="37" y="44.5" width="12" height="3" rx="1.5" fill="#fffbeb" fillOpacity="0.8" />

        {/* Column 3 (Middle-Right - Tallest) */}
        <rect x="56" y="32" width="14" height="52" rx="4" fill="#1e3a8a" />
        <rect x="56" y="30" width="14" height="52" rx="4" fill={`url(#${id}-bar-blue)`} />
        {/* Column 3 Bevel Top */}
        <rect x="57" y="30.5" width="12" height="3" rx="1.5" fill="#f0f9ff" fillOpacity="0.8" />

        {/* Column 4 (Right side - Blue/Indigo) */}
        <rect x="76" y="48" width="13" height="36" rx="4" fill="#312e81" />
        <rect x="76" y="46" width="13" height="36" rx="4" fill={`url(#${id}-bar-indigo)`} />
        <rect x="77" y="46.5" width="11" height="3" rx="1.5" fill="#e0e7ff" fillOpacity="0.8" />

        {/* Ascending 3D Trendline Arrow */}
        {/* Arrow shadow */}
        <path d="M16 62 Q36 48 52 46 T80 18" stroke="#047857" strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.3" transform="translate(0, 3)" />
        {/* Main Curved Arrow Stem */}
        <path d="M16 60 Q34 44 52 42 T78 16" stroke={`url(#${id}-arrow-green)`} strokeWidth="8" strokeLinecap="round" fill="none" />
        {/* 3D Arrowhead */}
        <polygon points="88,8 72,12 80,24" fill="#047857" transform="translate(0, 2)" />
        <polygon points="88,8 72,12 80,24" fill="#34d399" />
        <polygon points="88,8 80,24 78,16" fill="#059669" />
      </g>
    </svg>
  );
}

// 7. AI INSIGHT 3D ICON (Vibrant Sparkling Stars Cluster)
export function AIInsight3DIcon({ className = 'w-6 h-6', ...props }) {
  const id = React.useId();
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <filter id={`${id}-ai-shadow`} x="4" y="4" width="92" height="92" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#6d28d9" floodOpacity="0.3" />
        </filter>
        {/* Purple Master Star */}
        <linearGradient id={`${id}-star-purple`} x1="28" y1="20" x2="68" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="40%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        {/* Yellow Star */}
        <linearGradient id={`${id}-star-yellow`} x1="48" y1="56" x2="84" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        {/* Blue Star */}
        <linearGradient id={`${id}-star-blue`} x1="16" y1="60" x2="44" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      <g filter={`url(#${id}-ai-shadow)`}>
        {/* Floating AI Spheres / Orbs */}
        <circle cx="24" cy="30" r="3.5" fill="#c084fc" />
        <circle cx="34" cy="18" r="4" fill="#a855f7" />
        <circle cx="70" cy="24" r="5" fill="#818cf8" />
        <circle cx="82" cy="36" r="3" fill="#38bdf8" />
        <circle cx="20" cy="74" r="2.5" fill="#facc15" />
        <circle cx="54" cy="78" r="3" fill="#a855f7" />
        <circle cx="82" cy="74" r="4" fill="#fb923c" />

        {/* 1. Main 3D 4-Point Star (Purple - Top Center) */}
        {/* Shadow layer */}
        <path d="M48 14 C48 26 36 38 24 38 C36 38 48 50 48 62 C48 50 60 38 72 38 C60 38 48 26 48 14 Z" fill="#581c87" transform="translate(0, 3)" />
        {/* Main star body */}
        <path d="M48 14 C48 26 36 38 24 38 C36 38 48 50 48 62 C48 50 60 38 72 38 C60 38 48 26 48 14 Z" fill={`url(#${id}-star-purple)`} />
        {/* 3D Highlight center ridge */}
        <path d="M48 18 C48 28 40 38 30 38 C40 38 48 48 48 58 C48 48 56 38 66 38 C56 38 48 28 48 18 Z" fill="#e9d5ff" opacity="0.6" />

        {/* 2. Secondary 3D Star (Yellow/Gold - Bottom Right) */}
        <path d="M68 52 C68 60 60 68 52 68 C60 68 68 76 68 84 C68 76 76 68 84 68 C76 68 68 60 68 52 Z" fill="#92400e" transform="translate(0, 2)" />
        <path d="M68 52 C68 60 60 68 52 68 C60 68 68 76 68 84 C68 76 76 68 84 68 C76 68 68 60 68 52 Z" fill={`url(#${id}-star-yellow)`} />
        <circle cx="68" cy="68" r="3" fill="#fef9c3" />

        {/* 3. Third 3D Star (Cyan/Blue - Bottom Left) */}
        <path d="M28 60 C28 66 22 72 16 72 C22 72 28 78 28 84 C28 78 34 72 40 72 C34 72 28 66 28 60 Z" fill="#0369a1" transform="translate(0, 2)" />
        <path d="M28 60 C28 66 22 72 16 72 C22 72 28 78 28 84 C28 78 34 72 40 72 C34 72 28 66 28 60 Z" fill={`url(#${id}-star-blue)`} />
        <circle cx="28" cy="72" r="2.5" fill="#f0f9ff" />
      </g>
    </svg>
  );
}

// 8. PENGATURAN 3D ICON (Dual Interlocking Metallic Gears)
export function Pengaturan3DIcon({ className = 'w-6 h-6', ...props }) {
  const id = React.useId();
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <filter id={`${id}-gear-shadow`} x="8" y="10" width="84" height="84" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#1e3a8a" floodOpacity="0.3" />
        </filter>
        {/* Primary Gear Gradient (Slate-Blue Metallic) */}
        <linearGradient id={`${id}-gear-main`} x1="20" y1="36" x2="74" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="35%" stopColor="#60a5fa" />
          <stop offset="70%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        {/* Secondary Small Gear Gradient */}
        <linearGradient id={`${id}-gear-small`} x1="58" y1="14" x2="88" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>

      <g filter={`url(#${id}-gear-shadow)`}>
        {/* SECONDARY GEAR (Top Right Background) */}
        {/* 6 Teeth Small Gear */}
        <g transform="translate(18, -4)">
          <path 
            d="M58 24 L60 20 L64 20 L65 24 L69 26 L72 23 L75 25 L74 29 L77 32 L81 32 L81 36 L77 38 L75 42 L77 45 L74 48 L70 46 L67 49 L67 53 L63 53 L62 49 L58 47 L55 50 L52 47 L54 44 L52 40 L48 40 L48 36 L52 34 L53 30 L50 27 L53 24 L57 26 Z" 
            fill="#1e3a8a" 
            transform="translate(0, 2)"
          />
          <path 
            d="M58 24 L60 20 L64 20 L65 24 L69 26 L72 23 L75 25 L74 29 L77 32 L81 32 L81 36 L77 38 L75 42 L77 45 L74 48 L70 46 L67 49 L67 53 L63 53 L62 49 L58 47 L55 50 L52 47 L54 44 L52 40 L48 40 L48 36 L52 34 L53 30 L50 27 L53 24 L57 26 Z" 
            fill={`url(#${id}-gear-small)`} 
          />
          {/* Inner Axle Hole */}
          <circle cx="64" cy="36" r="6" fill="#172554" />
          <circle cx="64" cy="36" r="5" fill="#1e3a8a" />
        </g>

        {/* PRIMARY GEAR (Center Foreground - 8 Heavy 3D Teeth) */}
        {/* Bottom depth bevel */}
        <path 
          d="M44 38 L48 38 L50 42 L56 44 L59 40 L63 43 L62 48 L67 52 L72 50 L74 54 L71 58 L73 64 L78 66 L77 71 L72 73 L71 78 L66 81 L63 77 L57 79 L55 84 L50 84 L48 79 L42 77 L39 81 L35 78 L37 73 L32 69 L28 71 L26 66 L29 63 L27 57 L22 55 L23 50 L28 48 L30 43 L26 40 L29 37 L34 39 L39 36 Z" 
          fill="#172554" 
          transform="translate(0, 4)"
        />
        {/* Front gear surface */}
        <path 
          d="M44 38 L48 38 L50 42 L56 44 L59 40 L63 43 L62 48 L67 52 L72 50 L74 54 L71 58 L73 64 L78 66 L77 71 L72 73 L71 78 L66 81 L63 77 L57 79 L55 84 L50 84 L48 79 L42 77 L39 81 L35 78 L37 73 L32 69 L28 71 L26 66 L29 63 L27 57 L22 55 L23 50 L28 48 L30 43 L26 40 L29 37 L34 39 L39 36 Z" 
          fill={`url(#${id}-gear-main)`} 
        />
        {/* Outer gear rim specular highlight */}
        <circle cx="50" cy="61" r="19" stroke="#bfdbfe" strokeWidth="1" strokeOpacity="0.4" fill="none" />

        {/* Center circular axle hole with deep 3D bevel */}
        <circle cx="50" cy="63" r="11" fill="#0f172a" />
        <circle cx="50" cy="61" r="11" fill="#172554" />
        <circle cx="50" cy="61" r="8" fill="#1e40af" stroke="#93c5fd" strokeWidth="1" />
      </g>
    </svg>
  );
}

// 9. TOTAL EVENT 3D ICON (Trophy & Calendars)
export function TotalEvent3DIcon({ className = 'w-6 h-6', ...props }) {
  const id = React.useId();
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <defs>
        <linearGradient id={`${id}-gold`} x1="30" y1="20" x2="70" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <rect x="12" y="32" width="30" height="36" rx="4" fill="#cbd5e1" />
      <rect x="58" y="32" width="30" height="36" rx="4" fill="#cbd5e1" />
      <path d="M35 24 H65 L60 56 C60 64 54 68 50 68 C46 68 40 64 40 56 Z" fill={`url(#${id}-gold)`} />
      <path d="M32 28 C26 28 24 36 30 40 C34 43 38 40 38 34 Z" stroke="#d97706" strokeWidth="4" fill="none" />
      <path d="M68 28 C74 28 76 36 70 40 C66 43 62 40 62 34 Z" stroke="#d97706" strokeWidth="4" fill="none" />
      <rect x="44" y="68" width="12" height="14" fill="#b45309" />
      <rect x="36" y="82" width="28" height="8" rx="3" fill="#78350f" />
    </svg>
  );
}

// 10. EVENT BERLANGSUNG 3D ICON (Stopwatch & Live)
export function EventBerlangsung3DIcon({ className = 'w-6 h-6', ...props }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <circle cx="50" cy="54" r="32" fill="#3b82f6" />
      <circle cx="50" cy="54" r="28" fill="#93c5fd" />
      <circle cx="50" cy="54" r="24" fill="#ffffff" />
      <rect x="46" y="16" width="8" height="8" rx="2" fill="#1e3a8a" />
      <path d="M50 38 V54 H62" stroke="#1e3a8a" strokeWidth="4" strokeLinecap="round" />
      <circle cx="78" cy="30" r="10" fill="#ef4444" />
      <text x="78" y="33" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">LIVE</text>
    </svg>
  );
}

// 11. PENDAFTARAN BUKA 3D ICON (Person & Ticket/Form)
export function PendaftaranBuka3DIcon({ className = 'w-6 h-6', ...props }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <rect x="48" y="18" width="38" height="66" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="3" />
      <circle cx="67" cy="40" r="10" fill="#10b981" />
      <path d="M62 40 L65 43 L72 36" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="38" r="10" fill="#38bdf8" />
      <path d="M14 74 C14 60 22 56 28 56 C34 56 42 60 42 74 Z" fill="#10b981" />
    </svg>
  );
}

// 12. DANA SPONSOR 3D ICON (Handshake & Rp / Coins)
export function DanaSponsor3DIcon({ className = 'w-6 h-6', ...props }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <circle cx="36" cy="36" r="18" fill="#a855f7" />
      <text x="36" y="42" fill="#ffffff" fontSize="16" fontWeight="bold" textAnchor="middle">Rp</text>
      <path d="M24 70 L42 56 L58 70 L72 58" stroke="#7c3aed" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="74" cy="68" r="8" fill="#f59e0b" />
      <circle cx="74" cy="74" r="8" fill="#d97706" />
    </svg>
  );
}

// 13. REGULASI DOKUMEN 3D ICON (Document & Gavel)
export function RegulasiDokumen3DIcon({ className = 'w-6 h-6', ...props }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <rect x="42" y="16" width="44" height="70" rx="6" fill="#ffffff" stroke="#94a3b8" strokeWidth="3" />
      <line x1="52" y1="30" x2="76" y2="30" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      <line x1="52" y1="42" x2="76" y2="42" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      <line x1="52" y1="54" x2="68" y2="54" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      <circle cx="70" cy="70" r="10" fill="#10b981" />
      <path d="M65 70 L68 73 L75 66" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="18" y="56" width="24" height="12" rx="3" fill="#b45309" transform="rotate(-35 18 56)" />
      <rect x="14" y="68" width="16" height="6" rx="2" fill="#78350f" transform="rotate(-35 14 68)" />
    </svg>
  );
}
