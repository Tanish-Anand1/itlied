"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  className?: string;
  encryptedClassName?: string;
  animateOn?: "view" | "hover";
  characters?: string;
}

export default function DecryptedText({
  text,
  speed = 28,
  maxIterations = 12,
  sequential = true,
  className = "",
  encryptedClassName = "text-muted",
  animateOn = "view",
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%*",
}: DecryptedTextProps) {
  const [display, setDisplay] = useState(text);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(false);
  const [animating, setAnimating] = useState(false);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);
  const chars = useMemo(() => characters.split(""), [characters]);

  const scramble = (revealedSet: Set<number>) =>
    text
      .split("")
      .map((ch, i) => {
        if (ch === " ") return " ";
        if (revealedSet.has(i)) return text[i];
        return chars[Math.floor(Math.random() * chars.length)];
      })
      .join("");

  const start = () => {
    if (animating || done) return;
    setRevealed(new Set());
    setAnimating(true);
  };

  useEffect(() => {
    if (animateOn !== "view") return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          start();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateOn]);

  useEffect(() => {
    if (!animating) return;
    let iteration = 0;
    const id = window.setInterval(() => {
      setRevealed((prev) => {
        if (sequential) {
          if (prev.size >= text.length) {
            window.clearInterval(id);
            setAnimating(false);
            setDone(true);
            setDisplay(text);
            return prev;
          }
          const next = new Set(prev);
          // reveal next non-space
          let idx = prev.size;
          while (idx < text.length && text[idx] === " ") {
            next.add(idx);
            idx++;
          }
          if (idx < text.length) next.add(idx);
          setDisplay(scramble(next));
          return next;
        }
        iteration++;
        setDisplay(scramble(prev));
        if (iteration >= maxIterations) {
          window.clearInterval(id);
          setAnimating(false);
          setDone(true);
          setDisplay(text);
        }
        return prev;
      });
    }, speed);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animating, text, speed, sequential, maxIterations]);

  return (
    <span
      ref={ref}
      className={`inline-block whitespace-pre-wrap ${className}`}
      onMouseEnter={animateOn === "hover" ? start : undefined}
      aria-label={text}
    >
      {display.split("").map((ch, i) => {
        const clear = revealed.has(i) || done;
        return (
          <span key={`${i}-${ch}`} className={clear ? undefined : encryptedClassName}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}
