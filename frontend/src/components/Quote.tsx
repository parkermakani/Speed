import React, { useEffect, useState } from "react";
import { ChromaticText } from "./ChromaticText";

interface QuoteProps {
  quote: string;
  /** When true, wraps the quote in quotation marks. Defaults to true. */
  quoted?: boolean;
  /** Adds a subtle text shadow for readability over busy backgrounds */
  withShadow?: boolean;
}

/**
 * Fixed-position quote overlay displayed on top of the map.
 */
export const Quote: React.FC<QuoteProps> = ({
  quote,
  quoted = true,
  withShadow = false,
}) => {
  // Inject a stronger wave animation using CSS variable for shadow color
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "_quote_anim_styles";
    if (!document.getElementById(id)) {
      const styleEl = document.createElement("style");
      styleEl.id = id;
      styleEl.innerHTML = `
        @keyframes quote-wave-strong {
          0% { transform: translateY(0) rotate(0deg) skewX(0deg) scale(1); filter: drop-shadow(0 0 0 var(--quote-shadow-color, rgba(179,25,66,0))); }
          20% { transform: translateY(-6px) rotate(2deg) skewX(3deg) scale(1.15); filter: drop-shadow(0 8px 18px var(--quote-shadow-color-active, rgba(179,25,66,0.6))); }
          40% { transform: translateY(3px) rotate(-2deg) skewX(-2deg) scale(1.22); }
          60% { transform: translateY(-4px) rotate(1.4deg) skewX(2deg) scale(1.14); }
          80% { transform: translateY(2px) rotate(-1.2deg) skewX(-1.5deg) scale(1.08); }
          100% { transform: translateY(0) rotate(0deg) skewX(0deg) scale(1); filter: drop-shadow(0 0 0 var(--quote-shadow-color, rgba(179,25,66,0))); }
        }
        .quote-anim-strong { transform-origin: 50% 80%; animation: quote-wave-strong var(--quote-anim-dur, 1800ms) ease-in-out 1 both; will-change: transform, filter; }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Periodically trigger animation with random delay and duration
  const [isAnimating, setIsAnimating] = useState(false);
  const [animDuration, setAnimDuration] = useState<number>(1800);
  useEffect(() => {
    let mounted = true;
    let delayTimer: number | null = null;
    let endTimer: number | null = null;
    const schedule = () => {
      const delay = 5000 + Math.floor(Math.random() * 10000); // 5-15s
      const dur = 1400 + Math.floor(Math.random() * 1800); // 1.4-3.2s
      if (!mounted) return;
      delayTimer = window.setTimeout(() => {
        if (!mounted) return;
        setAnimDuration(dur);
        setIsAnimating(true);
        endTimer = window.setTimeout(() => {
          if (!mounted) return;
          setIsAnimating(false);
          schedule();
        }, dur) as unknown as number;
      }, delay) as unknown as number;
    };
    schedule();
    return () => {
      mounted = false;
      if (delayTimer != null) window.clearTimeout(delayTimer);
      if (endTimer != null) window.clearTimeout(endTimer);
    };
  }, []);

  const animClass = isAnimating ? "quote-anim-strong" : undefined;
  const animStyle = isAnimating
    ? ({
        // @ts-ignore custom prop
        "--quote-anim-dur": `${animDuration}ms`,
        display: "inline-block",
      } as React.CSSProperties)
    : undefined;
  return (
    <div
      data-tip-target="quote"
      style={{
        maxWidth: "80%",
        textAlign: "center",
        pointerEvents: "auto",
      }}
    >
      {!quoted && quote.startsWith("#") ? (
        <span
          className={animClass}
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            whiteSpace: "nowrap",
            ...(animStyle || {}),
          }}
        >
          <ChromaticText
            text="#"
            layers={["base"]}
            className={withShadow ? "quote-shadow" : undefined}
            style={{ fontSize: "1.5rem" }}
          />
          <ChromaticText
            text={quote.slice(1)}
            layers={["base", "outline"]}
            className={withShadow ? "quote-shadow" : undefined}
            style={{ fontSize: "1.5rem" }}
          />
        </span>
      ) : (
        <ChromaticText
          text={quoted ? `"${quote}"` : quote}
          layers={["base", "outline"]}
          className={`${withShadow ? "quote-shadow" : ""} ${animClass || ""}`}
          // eslint-disable-next-line react/style-prop-object
          style={{ fontSize: "1.5rem", ...(animStyle || ({} as any)) }}
        />
      )}
    </div>
  );
};
