/** ItLied wordmark — Instrument Serif; italic "Lied" is the brand hinge. */
export function Wordmark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "hero";
}) {
  const sizeClass =
    size === "hero"
      ? "text-[clamp(2.25rem,10vw,4.25rem)]"
      : size === "lg"
        ? "text-[clamp(1.75rem,5vw,2.75rem)]"
        : size === "sm"
          ? "text-[1.25rem] md:text-[1.5rem]"
          : "text-[1.5rem] md:text-[1.875rem]";

  return (
    <span className={`wordmark inline-flex items-baseline gap-[0.06em] ${sizeClass} ${className}`}>
      <span className="mr-[0.08em] font-mono text-[0.42em] font-medium tracking-[0.08em] text-breaker">
        &gt;_
      </span>
      <span className="text-ink">It</span>
      <span className="wordmark-lied text-breaker">Lied</span>
    </span>
  );
}
