/** Logo mark: a pixel-art stadium from above — clay oval track wrapping a
 * green infield, with a cream start line. Reads as track & field. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 8"
      className={className ?? "h-4 w-6 md:h-5 md:w-7"}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {/* clay oval track */}
      <g fill="#c8503c">
        <rect x="3" y="0" width="6" height="1" />
        <rect x="2" y="1" width="8" height="1" />
        <rect x="1" y="2" width="10" height="4" />
        <rect x="2" y="6" width="8" height="1" />
        <rect x="3" y="7" width="6" height="1" />
      </g>
      {/* green infield */}
      <rect x="3" y="2" width="6" height="4" fill="#3f8f2b" />
      {/* cream start line across the track straight */}
      <rect x="6" y="0" width="1" height="2" fill="#ece1c8" />
      <rect x="6" y="6" width="1" height="2" fill="#ece1c8" />
    </svg>
  );
}
