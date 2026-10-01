/** The brand is the vehicle marker: the same arrow inside a ring, so the logo is what the operator watches on the map. */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className="brand-mark">
      <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 6.5 L16.6 18.6 L12 15.8 L7.4 18.6 Z" fill="currentColor" />
    </svg>
  )
}
