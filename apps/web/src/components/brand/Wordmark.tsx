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
      ? "text-[3rem] md:text-[4.5rem]"
      : size === "lg"
        ? "text-3xl md:text-[2.75rem]"
        : size === "sm"
          ? "text-xl md:text-2xl"
          : "text-2xl md:text-3xl";

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
