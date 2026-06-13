export default function PencilTip({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect x="13" y="3" width="18" height="9" rx="4.5" fill="rgba(255,255,255,0.62)" />
      <rect x="13" y="11" width="18" height="3.5" fill="rgba(0,0,0,0.11)" />
      <rect x="16" y="16" width="6" height="12" rx="3" fill="rgba(255,255,255,0.28)" />
      <polygon points="13,30 22,42 31,30" fill="#EFC88A" />
      <polygon points="17,35 22,42 27,35" fill="#8C7B75" />
    </svg>
  )
}
