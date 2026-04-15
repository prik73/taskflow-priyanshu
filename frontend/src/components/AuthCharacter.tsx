// Inline SVG — inspired by undraw.co illustration style (no external dependency)
export default function AuthCharacter() {
  return (
    <svg viewBox="0 0 400 380" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Desk / laptop scene */}
      {/* Monitor */}
      <rect x="110" y="80" width="180" height="120" rx="10" fill="#5B6EF5" />
      <rect x="120" y="90" width="160" height="100" rx="6" fill="#EEF0FF" />
      {/* Screen content — task list */}
      <rect x="132" y="102" width="70" height="8" rx="4" fill="#5B6EF5" opacity="0.5" />
      <rect x="132" y="116" width="50" height="6" rx="3" fill="#5B6EF5" opacity="0.3" />
      <rect x="132" y="128" width="60" height="6" rx="3" fill="#5B6EF5" opacity="0.3" />
      <rect x="132" y="140" width="40" height="6" rx="3" fill="#5B6EF5" opacity="0.2" />
      {/* Check marks */}
      <circle cx="215" cy="106" r="5" fill="#22c55e" opacity="0.7" />
      <circle cx="215" cy="119" r="5" fill="#22c55e" opacity="0.4" />
      <circle cx="215" cy="132" r="5" fill="#f59e0b" opacity="0.4" />
      {/* Monitor stand */}
      <rect x="188" y="200" width="24" height="20" rx="2" fill="#5B6EF5" opacity="0.7" />
      <rect x="168" y="218" width="64" height="6" rx="3" fill="#5B6EF5" opacity="0.5" />
      {/* Desk surface */}
      <rect x="60" y="224" width="280" height="10" rx="5" fill="#C7CAF5" />
      {/* Person sitting */}
      {/* Body */}
      <ellipse cx="310" cy="270" rx="30" ry="22" fill="#5B6EF5" opacity="0.15" />
      <rect x="286" y="230" width="48" height="55" rx="20" fill="#5B6EF5" />
      {/* Head */}
      <circle cx="310" cy="210" r="26" fill="#FDDCB5" />
      {/* Hair */}
      <path d="M284 205 Q286 182 310 180 Q334 182 336 205 Q330 192 310 192 Q290 192 284 205Z" fill="#3D2B1F" />
      {/* Eyes */}
      <ellipse cx="302" cy="210" rx="3" ry="3.5" fill="#3D2B1F" />
      <ellipse cx="318" cy="210" rx="3" ry="3.5" fill="#3D2B1F" />
      <circle cx="303" cy="209" r="1" fill="white" />
      <circle cx="319" cy="209" r="1" fill="white" />
      {/* Smile */}
      <path d="M303 219 Q310 225 317 219" stroke="#C47A5A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Arms — typing */}
      <path d="M286 248 Q270 255 250 248" stroke="#5B6EF5" strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M334 248 Q350 255 365 248" stroke="#5B6EF5" strokeWidth="12" strokeLinecap="round" fill="none" />
      {/* Hands */}
      <ellipse cx="248" cy="248" rx="8" ry="6" fill="#FDDCB5" />
      <ellipse cx="367" cy="248" rx="8" ry="6" fill="#FDDCB5" />
      {/* Keyboard on desk */}
      <rect x="218" y="226" width="80" height="10" rx="4" fill="#D1D5FA" />
      {/* Legs */}
      <path d="M296 285 L288 330" stroke="#3D2B1F" strokeWidth="10" strokeLinecap="round" />
      <path d="M324 285 L332 330" stroke="#3D2B1F" strokeWidth="10" strokeLinecap="round" />
      {/* Shoes */}
      <ellipse cx="285" cy="333" rx="12" ry="6" fill="#3D2B1F" />
      <ellipse cx="335" cy="333" rx="12" ry="6" fill="#3D2B1F" />
      {/* Floating notification */}
      <rect x="60" y="100" width="90" height="36" rx="8" fill="white" stroke="#E5E7EB" strokeWidth="1.5" />
      <circle cx="76" cy="118" r="7" fill="#22c55e" opacity="0.8" />
      <rect x="90" y="111" width="48" height="5" rx="2.5" fill="#6B7280" opacity="0.5" />
      <rect x="90" y="120" width="32" height="4" rx="2" fill="#6B7280" opacity="0.3" />
      {/* Floating badge */}
      <rect x="56" y="155" width="72" height="28" rx="8" fill="#5B6EF5" opacity="0.9" />
      <rect x="66" y="163" width="52" height="4" rx="2" fill="white" opacity="0.8" />
      <rect x="70" y="171" width="38" height="4" rx="2" fill="white" opacity="0.5" />
    </svg>
  );
}
