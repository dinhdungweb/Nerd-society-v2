export function NerdNightMascot() {
  return (
    <svg className="nn-mascot" viewBox="0 0 335 160" xmlns="http://www.w3.org/2000/svg" aria-label="Minh hoạ cộng đồng Nerd Night">
      <g fill="none" stroke="#2b2925" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <g strokeWidth="2.5">
          <path d="M158 6 L158 16 M153 11 L163 11" />
          <path d="M272 14 L272 22 M268 18 L276 18" />
          <path d="M146 46 L150 50 M150 46 L146 50" />
        </g>
        <g transform="rotate(-3 231 34)">
          <rect x="196" y="12" width="70" height="46" rx="3" />
          <path d="M206 27 Q218 21 230 27 T256 25" />
          <path d="M206 40 L242 40" />
          <path d="M229 58 L227 94 M227 94 L212 106 M227 94 L242 108" />
        </g>
        <g><circle cx="256" cy="8" r="8" /><path d="M256 8 L256 3 M256 8 L260 10" /></g>
        <path d="M170 23 Q173 20 176 23 M176 23 Q179 20 182 23" />
        <circle cx="173" cy="28" r="1.4" fill="#2b2925" />
        <circle cx="179" cy="28" r="1.4" fill="#2b2925" />
        <path d="M172 33 Q176 36.5 180 33 M176 37 L176 64 M176 44 L198 30 L208 25 M176 48 L163 58 M176 64 L164 94 M176 64 L187 94" />
        <g>
          <path d="M14 87 Q17 84 20 87 M20 87 Q23 84 26 87" />
          <circle cx="17" cy="91" r="1.3" fill="#2b2925" /><circle cx="23" cy="91" r="1.3" fill="#2b2925" />
          <path d="M16 95 Q20 98.5 24 95 M10 124 Q20 106 30 124 M10 100 L2 86 M30 100 L38 86" />
        </g>
        <g>
          <path d="M52 97 Q55 94 58 97 M58 97 Q61 94 64 97" />
          <circle cx="55" cy="101" r="1.3" fill="#2b2925" /><circle cx="61" cy="101" r="1.3" fill="#2b2925" />
          <path d="M54 105 Q58 108 62 105 M46 132 Q58 116 70 132 M50 111 L58 103 L66 111" />
        </g>
        <g>
          <path d="M90 97 Q93 94 96 97 M96 97 Q99 94 102 97" />
          <circle cx="93" cy="101" r="1.3" fill="#2b2925" /><circle cx="99" cy="101" r="1.3" fill="#2b2925" />
          <path d="M91 105 Q94.5 107.5 98 105 M84 132 Q96 116 108 132 M103 108 Q110 103 104 95" />
        </g>
        <g>
          <path d="M128 87 Q131 84 134 87 M134 87 Q137 84 140 87" />
          <circle cx="131" cy="91" r="1.3" fill="#2b2925" /><circle cx="137" cy="91" r="1.3" fill="#2b2925" />
          <path d="M130 95 Q134 98.5 138 95 M124 124 Q134 106 144 124 M124 100 L116 86 M144 100 L152 86" />
        </g>
        <g>
          <path d="M270 90 L282 104 L294 90 L304 106 Q308 116 304 126 L304 130 L264 130 L264 126 Q260 116 264 106 Z" />
          <path d="M252 110 L264 111 M252 116 L264 116 M304 111 L316 110 M304 116 L316 116" />
          <circle cx="276" cy="112" r="1.6" fill="#2b2925" /><circle cx="292" cy="112" r="1.6" fill="#2b2925" />
          <path d="M282 118 Q284 120 286 118 M264 130 L304 130 M274 130 L274 138 M284 130 L284 138 M294 130 L294 138 M264 138 L304 138 M304 128 Q320 124 318 110 Q316 100 324 102" />
        </g>
      </g>
    </svg>
  )
}

export function NerdNightMedal({ prof = false, size = 92 }: { prof?: boolean; size?: number }) {
  const color = prof ? '#7a2e2e' : '#2b2925'
  return (
    <svg className="nn-medal" style={{ width: size, height: size }} viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="2.5">
        <circle cx="50" cy="42" r="30" strokeDasharray="4 3" />
        <circle cx="50" cy="42" r="22" />
        {prof ? (
          <path d="M38 30 L50 22 L62 30 L62 40 L50 48 L38 40 Z" fill={color} stroke="none" />
        ) : (
          <path d="M50 20 L54 34 L50 30 L46 34 Z" fill={color} stroke="none" />
        )}
        <path d="M38 68 L30 92 L50 82 L70 92 L62 68" />
      </g>
    </svg>
  )
}

export function NerdNightSquiggle() {
  return (
    <svg className="nn-squiggle" viewBox="0 0 140 14" aria-hidden="true">
      <path d="M2 8 Q 20 2, 38 8 T 74 8 T 110 8 T 138 6" />
    </svg>
  )
}

export function NerdNightDrinkIcon() {
  return (
    <svg className="nn-line-icon" viewBox="0 0 60 60" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 16 21 48q9 6 18 0l5-32Z" />
        <path d="M16 16h28M37 16l5-10" />
        <circle cx="27" cy="32" r="2.5" />
        <circle cx="36" cy="40" r="2" />
      </g>
    </svg>
  )
}

export function NerdNightEnvelopeIcon() {
  return (
    <svg className="nn-line-icon" viewBox="0 0 60 60" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="18" width="44" height="30" rx="1.5" />
        <path d="m8 20 22 17 22-17M30 13v5M25 9q5-3 10 0" />
      </g>
    </svg>
  )
}

export function NerdNightPeopleIcon() {
  return (
    <svg className="nn-line-icon" viewBox="0 0 60 60" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="21" cy="21" r="8" />
        <circle cx="39" cy="21" r="8" />
        <path d="M5 54q0-14 16-14 7 0 9 6M55 54q0-14-16-14-7 0-9 6" />
      </g>
    </svg>
  )
}
