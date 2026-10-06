type TravelMotif = 'flight' | 'stamp' | 'luggage' | 'camera' | 'ticket'

/** Decorative vector keepsakes, deliberately separate from interactive UI icons. */
export function TravelArtwork({ motif, className = '' }: { motif: TravelMotif; className?: string }) {
  return <svg className={`travel-artwork travel-artwork-${motif} ${className}`} viewBox="0 0 240 180" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {motif === 'flight' && <>
      <path d="M12 139c23 20 76 22 81-5 5-25-29-33-36-13-10 28 57 32 83-27" stroke="#839076" strokeWidth="1.8" strokeDasharray="5 7" />
      <circle cx="13" cy="139" r="4" fill="#c98b67" />
      <path d="M27 52c-10-1-14-16-4-21 2-17 30-20 36-3 11-5 24 4 22 15H27" fill="#fbf7e9" stroke="#a7b09b" strokeWidth="1.5" />
      <path d="M179 133c-8-1-10-12-2-16 2-13 22-14 26-2 9-3 18 3 17 11h-41" fill="#fbf7e9" stroke="#a7b09b" strokeWidth="1.5" />
      <g transform="translate(119 5) rotate(32 50 55) scale(.88)">
        <path d="M50 5c-4 0-6 7-6 15v23L10 65v9l34-12v23L32 95v7l18-7 18 7v-7L56 85V62l34 12v-9L56 43V20c0-8-2-15-6-15Z" stroke="#fcf7e9" strokeWidth="9" />
        <path d="M50 5c-4 0-6 7-6 15v23L10 65v9l34-12v23L32 95v7l18-7 18 7v-7L56 85V62l34 12v-9L56 43V20c0-8-2-15-6-15Z" fill="#d99b78" stroke="#6c7761" strokeWidth="1.6" />
        <path d="m47 25 3-3 3 3M50 35v49M19 66l21-11m20 0 21 11" stroke="#885f4a" strokeWidth="1.4" />
      </g>
      <path d="m104 35 2-7 2 7 7 2-7 2-2 7-2-7-7-2 7-2Zm110 50 2-5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#d4b784" />
    </>}
    {motif === 'stamp' && <g transform="rotate(-12 120 90)" stroke="#9a7458">
      <circle cx="120" cy="90" r="76" fill="#ecddbd" stroke="#f9f3e3" strokeWidth="7" />
      <circle cx="120" cy="90" r="71" strokeWidth="1.5" strokeDasharray="2 3" />
      <circle cx="120" cy="90" r="63" strokeWidth="1.2" />
      <path d="M80 106 107 70l20 24 12-17 23 29H80Z" fill="#c3cbaa" stroke="#778467" strokeWidth="1.5" />
      <path d="m97 84 10-14 9 12-9-3-5 6-5-1Z" fill="#faf4df" stroke="none" />
      <circle cx="139" cy="63" r="8" fill="#d4a279" stroke="none" />
      <path d="M84 117h72M91 122h58" strokeWidth="1" />
      <g fill="#88654e" stroke="none" textAnchor="middle" fontFamily="'DM Sans', sans-serif">
        <text x="120" y="49" fontSize="10" letterSpacing="1.4">GO · TOGETHER</text>
        <text x="120" y="135" fontSize="6.7" letterSpacing=".8">TAKE THE SCENIC ROUTE</text>
      </g>
      <path d="m65 89 3-2 3 2-3 2-3-2Zm104 0 3-2 3 2-3 2-3-2Z" fill="#9a7458" />
    </g>}
    {motif === 'luggage' && <>
      <ellipse cx="126" cy="159" rx="78" ry="8" fill="#667852" opacity=".1" />
      <g transform="rotate(-8 105 90)" stroke="#69715a" strokeWidth="1.7">
        <path d="M79 42V28c0-10 40-10 40 0v14" strokeWidth="4" />
        <rect x="48" y="41" width="110" height="110" rx="13" fill="#f9f2df" stroke="#f9f2df" strokeWidth="8" />
        <rect x="48" y="41" width="110" height="110" rx="13" fill="#d4ac77" />
        <path d="M70 44v105m65-105v105" stroke="#a27d50" strokeWidth="6" />
        <path d="M71 44v105m65-105v105" stroke="#edce9a" strokeWidth="2" />
        <path d="M61 152v6m80-6v6" strokeWidth="5" />
        <rect x="83" y="57" width="38" height="25" rx="3" fill="#e9ead3" transform="rotate(10 102 70)" />
        <path d="m92 74 9-10 10 12H92Z" stroke="#829273" />
        <path d="m151 53 16 4-4 27-15-2 3-29Z" fill="#f4e8c7" />
        <circle cx="157" cy="61" r="2" />
      </g>
      <g transform="rotate(15 174 116)" stroke="#506a55" strokeWidth="1.6">
        <rect x="143" y="74" width="58" height="82" rx="5" fill="#f9f2df" stroke="#f9f2df" strokeWidth="7" />
        <rect x="143" y="74" width="58" height="82" rx="5" fill="#829479" />
        <path d="M150 80v69" stroke="#bdc5a5" />
        <circle cx="175" cy="112" r="15" stroke="#e6d8ab" />
        <ellipse cx="175" cy="112" rx="7" ry="15" stroke="#e6d8ab" />
        <path d="M160 112h30m-26-9h22m-22 18h22M165 140h20" stroke="#e6d8ab" />
      </g>
    </>}
    {motif === 'camera' && <g transform="rotate(11 120 90)" stroke="#66745f" strokeWidth="1.7">
      <path d="M63 68C26 27 219 11 184 72" stroke="#8c7756" strokeWidth="4" />
      <path d="M86 60 95 46h42l9 14" fill="#b9c5a4" />
      <rect x="50" y="59" width="146" height="92" rx="13" fill="#faf3df" stroke="#faf3df" strokeWidth="8" />
      <rect x="50" y="59" width="146" height="92" rx="13" fill="#d5bd94" />
      <path d="M51 85h144v42H51Z" fill="#a2b393" stroke="none" />
      <rect x="158" y="68" width="22" height="11" rx="2" fill="#f7f0d9" />
      <circle cx="120" cy="104" r="34" fill="#ede6cd" />
      <circle cx="120" cy="104" r="26" fill="#647d6b" />
      <circle cx="120" cy="104" r="17" fill="#3c5c50" stroke="#a6b9a1" />
      <path d="M109 98a12 12 0 0 1 11-7" stroke="#e5e9d1" strokeWidth="3" />
      <circle cx="69" cy="72" r="4" fill="#b67957" stroke="none" />
      <path d="m186 35 2-7 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#c8a16f" stroke="none" />
    </g>}
    {motif === 'ticket' && <g transform="rotate(-7 120 90)">
      <path d="M18 45h204v29a13 13 0 0 0 0 26v31H18v-31a13 13 0 0 0 0-26V45Z" fill="#fbf4e1" stroke="#b3b498" strokeWidth="1.5" />
      <path d="M174 46v84" stroke="#b8b9a0" strokeDasharray="3 5" />
      <path d="M28 55h137v14H28Z" fill="#d6dfc3" />
      <g fill="#61745b" fontFamily="'DM Sans', sans-serif">
        <text x="35" y="65" fontSize="7" letterSpacing="1.4">THE TOGETHER TICKET</text>
        <text x="34" y="92" fontSize="14" fontWeight="600">SOMEDAY</text>
        <text x="34" y="112" fontSize="8" letterSpacing="2">→ TODAY</text>
        <text x="187" y="72" fontSize="8" letterSpacing="1">GO</text>
        <text x="184" y="120" fontSize="7">01 / ∞</text>
      </g>
      <path d="M187 82v20m4-20v20m3-20v20m5-20v20m2-20v20m5-20v20" stroke="#7e896d" strokeWidth="1.5" />
    </g>}
  </svg>
}

export function TravelCanvas({ variant = 'page' }: { variant?: 'page' | 'auth' }) {
  return <div className={`travel-canvas travel-canvas-${variant}`} aria-hidden="true">
    <TravelArtwork motif="flight" className="canvas-flight" />
    <TravelArtwork motif="stamp" className="canvas-stamp" />
    <TravelArtwork motif="camera" className="canvas-camera" />
    <TravelArtwork motif="luggage" className="canvas-luggage" />
    <TravelArtwork motif="ticket" className="canvas-ticket" />
  </div>
}
