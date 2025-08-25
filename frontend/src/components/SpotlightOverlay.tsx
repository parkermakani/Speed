import React, { useEffect, useMemo, useState } from "react";

interface SpotlightOverlayProps {
  /** CSS selector for target OR DOM element */
  target: string | HTMLElement | null;
  /** Optional padding around spotlight hole */
  padding?: number;
  /** Z-index of overlay */
  zIndex?: number;
  /** Click outside to close handler (optional) */
  onBackdropClick?: () => void;
  /** When true, any click anywhere advances (overrides hole pass-through) */
  captureAllClicks?: boolean;
  /** Tip content to render alongside (kept above the dimmer) */
  children?: React.ReactNode;
}

/**
 * Dims the entire screen with 4 rectangles, leaving a clear hole around the target.
 * Allows pointer-events only through the hole and tip content.
 */
export const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  target,
  padding = 8,
  zIndex = 3000,
  onBackdropClick,
  captureAllClicks = false,
  children,
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const element: HTMLElement | null = useMemo(() => {
    if (!target) return null;
    if (typeof target === "string") {
      return document.querySelector(target) as HTMLElement | null;
    }
    return target;
  }, [target]);

  useEffect(() => {
    const update = () => {
      if (!element) {
        setRect(null);
        return;
      }
      const r = element.getBoundingClientRect();
      setRect(
        new DOMRect(
          Math.max(0, r.left - padding),
          Math.max(0, r.top - padding),
          r.width + padding * 2,
          r.height + padding * 2
        )
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const id = window.setInterval(update, 250);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(id);
    };
  }, [element, padding]);

  const backdropClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!rect) {
      onBackdropClick?.();
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    const inside =
      x >= rect.left &&
      x <= rect.left + rect.width &&
      y >= rect.top &&
      y <= rect.top + rect.height;
    if (!inside) onBackdropClick?.();
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        pointerEvents: "auto",
      }}
    >
      {captureAllClicks && (
        <div
          onClick={() => onBackdropClick?.()}
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
            zIndex: 0,
          }}
        />
      )}
      {/* Top */}
      <div
        onClick={backdropClick}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: rect ? `${rect.top}px` : "100%",
          background: "rgba(0,0,0,0.6)",
        }}
      />
      {/* Left */}
      <div
        onClick={backdropClick}
        style={{
          position: "absolute",
          left: 0,
          top: rect ? `${rect.top}px` : 0,
          width: rect ? `${Math.max(0, rect.left)}px` : "100%",
          height: rect ? `${rect?.height}px` : 0,
          background: "rgba(0,0,0,0.6)",
        }}
      />
      {/* Right */}
      <div
        onClick={backdropClick}
        style={{
          position: "absolute",
          left: rect ? `${rect.left + rect.width}px` : 0,
          top: rect ? `${rect.top}px` : 0,
          width: rect ? `${Math.max(0, vw - (rect.left + rect.width))}px` : 0,
          height: rect ? `${rect.height}px` : 0,
          background: "rgba(0,0,0,0.6)",
        }}
      />
      {/* Bottom */}
      <div
        onClick={backdropClick}
        style={{
          position: "absolute",
          left: 0,
          top: rect ? `${rect.top + rect.height}px` : 0,
          width: "100%",
          height: rect ? `${Math.max(0, vh - (rect.top + rect.height))}px` : 0,
          background: "rgba(0,0,0,0.6)",
        }}
      />

      {/* Tip content above dimmer */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: (zIndex as number) + 1,
        }}
      >
        <div style={{ pointerEvents: "auto" }} role="dialog" aria-modal="true">
          {children}
        </div>
      </div>
    </div>
  );
};
