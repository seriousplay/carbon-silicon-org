type LoopDesignerLogoProps = {
  className?: string;
  title?: string;
};

export function LoopDesignerLogo({
  className = "h-10 w-10",
  title = "碳硅组织设计工作室",
}: LoopDesignerLogoProps) {
  return (
    <svg viewBox="0 0 192 192" className={className} role="img" aria-label={title}>
      <defs>
        <radialGradient id="studio-bg" cx="50%" cy="48%" r="68%">
          <stop offset="0" stopColor="#16352f" />
          <stop offset=".58" stopColor="#091715" />
          <stop offset="1" stopColor="#030807" />
        </radialGradient>
        <linearGradient id="studio-ring-a" x1="22" x2="168" y1="64" y2="128" gradientUnits="userSpaceOnUse">
          <stop stopColor="#62d9cf" />
          <stop offset=".48" stopColor="#74ebe0" />
          <stop offset="1" stopColor="#b7f34a" />
        </linearGradient>
        <linearGradient id="studio-ring-b" x1="34" x2="158" y1="136" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b7f34a" />
          <stop offset=".52" stopColor="#62d9cf" />
          <stop offset="1" stopColor="#f0e8d0" />
        </linearGradient>
        <linearGradient id="studio-blueprint" x1="52" x2="140" y1="62" y2="136" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff7d7" />
          <stop offset=".52" stopColor="#f0e8d0" />
          <stop offset="1" stopColor="#81efe2" />
        </linearGradient>
        <filter id="studio-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.38 0 0 0 0 0.86 0 0 0 0 0.79 0 0 0 .72 0" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="192" height="192" rx="42" fill="url(#studio-bg)" />
      <path d="M33 55H159M33 96H159M33 137H159M55 33V159M96 33V159M137 33V159" stroke="#62d9cf" strokeOpacity=".08" strokeWidth="1" />
      <circle cx="96" cy="96" r="61" fill="none" stroke="#e9f0e8" strokeOpacity=".08" strokeWidth="1" strokeDasharray="5 7" />

      <g filter="url(#studio-soft-glow)">
        <path d="M28 106c10-37 38-60 72-58 40 2 62 30 66 67" fill="none" stroke="url(#studio-ring-a)" strokeWidth="8" strokeLinecap="round" opacity=".96" />
        <path d="M164 86c-10 37-38 60-72 58-40-2-62-30-66-67" fill="none" stroke="url(#studio-ring-b)" strokeWidth="8" strokeLinecap="round" opacity=".82" />
      </g>

      <g filter="url(#studio-soft-glow)">
        <path d="M58 75l38-20 38 20v42l-38 22-38-22V75Z" fill="#08110f" fillOpacity=".66" stroke="url(#studio-blueprint)" strokeWidth="4" strokeLinejoin="round" />
        <path d="M58 75l38 21 38-21M96 96v43M74 84v43M118 84v43" fill="none" stroke="#f0e8d0" strokeOpacity=".76" strokeWidth="2" strokeLinecap="round" />
        <path d="M72 116l24-20 24 20M76 94l18-10 22 15M76 126l18-10 22 9" fill="none" stroke="#62d9cf" strokeOpacity=".52" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M86 96l10-10 10 10-10 10-10-10Z" fill="#f0e8d0" fillOpacity=".2" stroke="#fff7d7" strokeWidth="3" />
      </g>

      <g>
        <Node cx={96} cy={47} color="#f0e8d0" />
        <path d="M96 43v7M86 54v-4h20v4" fill="none" stroke="#08110f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="96" cy="41" r="3.2" fill="#08110f" />
        <circle cx="86" cy="57" r="3.2" fill="#08110f" />
        <circle cx="106" cy="57" r="3.2" fill="#08110f" />

        <Node cx={146} cy={96} color="#b7f34a" />
        <rect x="138" y="88" width="16" height="16" rx="3" fill="none" stroke="#08110f" strokeWidth="2.4" />
        <path d="M133 91h5M133 101h5M154 91h5M154 101h5M141 83v5M151 83v5M141 104v5M151 104v5" stroke="#08110f" strokeWidth="2.1" strokeLinecap="round" />

        <Node cx={96} cy={145} color="#62d9cf" />
        <path d="M86 144a10 10 0 0 1 17-7M103 137h-6M106 146a10 10 0 0 1-17 7M89 153h6" fill="none" stroke="#08110f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

        <Node cx={46} cy={96} color="#62d9cf" />
        <path d="M38 89h16M38 96h16M38 103h16M33 89l2 2 3-5M33 96l2 2 3-5M33 103l2 2 3-5" fill="none" stroke="#08110f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function Node({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g filter="url(#studio-soft-glow)">
      <circle cx={cx} cy={cy} r="18" fill={color} stroke={color} strokeWidth="4" />
      <circle cx={cx} cy={cy} r="22" fill="none" stroke={color} strokeOpacity=".16" strokeWidth="2" />
    </g>
  );
}
