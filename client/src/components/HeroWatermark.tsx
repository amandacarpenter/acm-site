/**
 * Large, faded universal-accessibility icon (circle + person, arms and legs
 * spread) used as a decorative watermark on dark hero sections. Purely
 * visual — hidden from assistive tech and intentionally cropped off the
 * edge of its container for an editorial feel.
 *
 * Usage: place inside a `relative` (or already-positioned) container with
 * `overflow-hidden` set no higher than the hero section itself, so the icon
 * can bleed off the corner without breaking page layout.
 */
export default function HeroWatermark({
  corner = "right",
  className = "",
}: {
  /** Which side of the hero the icon anchors to and bleeds off of. */
  corner?: "right" | "left";
  className?: string;
}) {
  const sideClass = corner === "right" ? "-right-16 sm:-right-10" : "-left-16 sm:-left-10";
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      className={`pointer-events-none select-none absolute ${sideClass} text-white/[0.08] w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] lg:w-[460px] lg:h-[460px] ${className}`}
    >
      {/* outer ring */}
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="7" />
      {/* head */}
      <circle cx="50" cy="26" r="9" fill="currentColor" />
      {/* arms — full-width bar with rounded ends, slightly below shoulders */}
      <rect x="20" y="38" width="60" height="9" rx="4.5" fill="currentColor" />
      {/* torso */}
      <rect x="43" y="38" width="14" height="24" rx="6" fill="currentColor" />
      {/* legs — spread in an A-shape from the base of the torso */}
      <path
        d="M46 58 L33 82 a5 5 0 0 0 9 4.5 L50 66 L58 86.5 a5 5 0 0 0 9-4.5 L54 58 Z"
        fill="currentColor"
      />
    </svg>
  );
}
