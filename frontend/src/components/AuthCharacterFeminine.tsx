// Inline SVG — inspired by undraw.co illustration style (no external dependency)
export default function AuthCharacterFeminine() {
  return (
    <svg viewBox="0 0 400 380" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Clipboard / task board */}
      <rect x="130" y="60" width="150" height="200" rx="10" fill="white" stroke="#E5E7EB" strokeWidth="2" />
      <rect x="168" y="48" width="74" height="22" rx="8" fill="#5B6EF5" />
      {/* Task rows */}
      <rect x="148" y="90" width="14" height="14" rx="3" fill="#5B6EF5" opacity="0.2" stroke="#5B6EF5" strokeWidth="1.5" />
      <rect x="170" y="93" width="80" height="7" rx="3.5" fill="#6B7280" opacity="0.4" />
      {/* Checked row */}
      <rect x="148" y="118" width="14" height="14" rx="3" fill="#22c55e" opacity="0.8" />
      <path d="M151 125 L154 129 L160 122" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="170" y="121" width="64" height="7" rx="3.5" fill="#6B7280" opacity="0.25" />
      {/* Checked row 2 */}
      <rect x="148" y="146" width="14" height="14" rx="3" fill="#22c55e" opacity="0.8" />
      <path d="M151 153 L154 157 L160 150" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="170" y="149" width="72" height="7" rx="3.5" fill="#6B7280" opacity="0.25" />
      {/* In progress row */}
      <rect x="148" y="174" width="14" height="14" rx="3" fill="#f59e0b" opacity="0.8" />
      <rect x="170" y="177" width="56" height="7" rx="3.5" fill="#6B7280" opacity="0.4" />
      {/* Todo row */}
      <rect x="148" y="202" width="14" height="14" rx="3" fill="#5B6EF5" opacity="0.2" stroke="#5B6EF5" strokeWidth="1.5" />
      <rect x="170" y="205" width="88" height="7" rx="3.5" fill="#6B7280" opacity="0.4" />
      {/* Divider */}
      <line x1="148" y1="230" x2="262" y2="230" stroke="#E5E7EB" strokeWidth="1.5" />
      <rect x="148" y="238" width="40" height="8" rx="4" fill="#5B6EF5" opacity="0.6" />
      {/* Person */}
      {/* Body */}
      <rect x="50" y="232" width="52" height="62" rx="22" fill="#E63B7A" />
      {/* Head */}
      <circle cx="76" cy="210" r="27" fill="#FDDCB5" />
      {/* Long hair */}
      <path d="M49 210 Q50 175 76 172 Q102 175 103 210 Q98 188 76 187 Q54 188 49 210Z" fill="#1A0A00" />
      <path d="M49 210 Q44 238 50 258" stroke="#1A0A00" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M103 210 Q108 238 102 258" stroke="#1A0A00" strokeWidth="10" strokeLinecap="round" fill="none" />
      {/* Eyes */}
      <ellipse cx="68" cy="211" rx="3" ry="3.5" fill="#3D2B1F" />
      <ellipse cx="84" cy="211" rx="3" ry="3.5" fill="#3D2B1F" />
      <circle cx="69" cy="210" r="1" fill="white" />
      <circle cx="85" cy="210" r="1" fill="white" />
      {/* Lashes */}
      <path d="M65 208 L63 205" stroke="#3D2B1F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M68 207 L68 204" stroke="#3D2B1F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M81 207 L80 204" stroke="#3D2B1F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M84 208 L86 205" stroke="#3D2B1F" strokeWidth="1.2" strokeLinecap="round" />
      {/* Smile */}
      <path d="M69 221 Q76 227 83 221" stroke="#C47A5A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Arm reaching toward clipboard */}
      <path d="M102 252 Q118 248 130 200" stroke="#E63B7A" strokeWidth="12" strokeLinecap="round" fill="none" />
      <ellipse cx="133" cy="196" rx="9" ry="7" fill="#FDDCB5" />
      {/* Other arm */}
      <path d="M50 252 Q36 265 28 280" stroke="#E63B7A" strokeWidth="12" strokeLinecap="round" fill="none" />
      <ellipse cx="25" cy="283" rx="9" ry="7" fill="#FDDCB5" />
      {/* Legs */}
      <path d="M65 294 L58 338" stroke="#3D2B1F" strokeWidth="10" strokeLinecap="round" />
      <path d="M87 294 L94 338" stroke="#3D2B1F" strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="55" cy="341" rx="12" ry="6" fill="#3D2B1F" />
      <ellipse cx="97" cy="341" rx="12" ry="6" fill="#3D2B1F" />
      {/* Stars / sparkles */}
      <path d="M310 90 L312 82 L314 90 L322 92 L314 94 L312 102 L310 94 L302 92Z" fill="#5B6EF5" opacity="0.5" />
      <path d="M344 130 L345 125 L346 130 L351 131 L346 132 L345 137 L344 132 L339 131Z" fill="#f59e0b" opacity="0.6" />
      <path d="M326 64 L327 60 L328 64 L332 65 L328 66 L327 70 L326 66 L322 65Z" fill="#22c55e" opacity="0.5" />
    </svg>
  );
}
