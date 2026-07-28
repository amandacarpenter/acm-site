import watermarkIcon from "@/assets/accessibility-watermark.png";

/**
 * Faded universal-accessibility icon (the user's own asset — circle ring +
 * person, arms/legs spread) used as a decorative watermark on dark hero
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
    <img
      src={watermarkIcon}
      alt=""
      aria-hidden="true"
      className={`pointer-events-none select-none absolute ${sideClass} opacity-[0.07] w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] lg:w-[460px] lg:h-[460px] ${className}`}
    />
  );
}
