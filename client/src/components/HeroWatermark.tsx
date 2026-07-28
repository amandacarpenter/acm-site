import { Accessibility } from "lucide-react";

/**
 * Large, faded accessibility icon used as a decorative watermark on dark hero
 * sections. Purely visual — hidden from assistive tech and intentionally
 * cropped off the edge of its container for an editorial feel.
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
    <Accessibility
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none select-none absolute ${sideClass} text-white/[0.06] w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] lg:w-[460px] lg:h-[460px] ${className}`}
      strokeWidth={1.5}
    />
  );
}
