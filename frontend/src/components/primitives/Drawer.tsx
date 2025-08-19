import React, { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { useMediaQuery } from "../../hooks/useMediaQuery";

interface DrawerProps {
  /** Controls visibility */
  isOpen: boolean;
  /** Callback when user requests to close (backdrop click or Esc) */
  onClose: () => void;
  /** Drawer content */
  children: React.ReactNode;
  /** Optional id/class for testing */
  className?: string;
  /** Optional z-index override (defaults to overlay) */
  zIndex?: number;
}

/**
 * Mobile-first slide-in Drawer anchored to the right.
 * – On viewports < `--bp-md` (768px) it covers the entire screen.
 * – On ≥ md it takes 30% of the viewport width.
 *
 * Uses CSS `transform` for performant animations.
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  zIndex,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Prevent background scroll when open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  const drawerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 1299px)");

  // Focus trap while open
  useEffect(() => {
    if (!isOpen) return;

    const root = drawerRef.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusableSelectors = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ];
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(focusableSelectors.join(","))
    );
    const first = focusables[0] || root;
    first.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const currentIndex = focusables.indexOf(
        document.activeElement as HTMLElement
      );
      let nextIndex: number;
      if (e.shiftKey) {
        // Shift + Tab => backward
        nextIndex =
          currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
      } else {
        // Tab forward
        nextIndex =
          currentIndex === focusables.length - 1 ? 0 : currentIndex + 1;
      }
      focusables[nextIndex].focus();
      e.preventDefault();
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  const overlayStyles: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: isOpen ? "rgba(0,0,0,0.4)" : "transparent",
    transition: "background-color var(--transition-base)",
    pointerEvents: isOpen ? "auto" : "none",
    zIndex: zIndex ?? 1300, // match --z-overlay default
  };

  const drawerStyles: React.CSSProperties = {
    position: "absolute",
    top: 0,
    right: 0,
    height: "100%",
    backgroundColor: "var(--color-land)",
    borderLeft: "4px solid var(--color-land-dark)",
    backdropFilter: "blur(6px)",
    boxShadow: "-4px 0 16px rgba(0,0,0,0.3)",
    transform: isOpen ? "translateX(0)" : "translateX(100%)",
    transition: "transform var(--transition-slow)",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties;

  // Override width for larger screens via inline media queries (CSS-in-JS style)
  const desktopWidth = "700px";
  const styleTagId = "_drawer-styles";
  if (!document.getElementById(styleTagId)) {
    const styleEl = document.createElement("style");
    styleEl.id = styleTagId;
    styleEl.innerHTML = `
      .drawer-content { width: 100%; max-width: 100%; }
      @media (min-width: 1100px) {
        .drawer-content {
          width: ${desktopWidth};
          max-width: ${desktopWidth};
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  return (
    <div style={overlayStyles} onClick={onClose} aria-hidden={!isOpen}>
      <div
        className={`drawer-content ${className}`}
        style={drawerStyles}
        ref={drawerRef}
        onClick={
          (e) => e.stopPropagation() /* prevent closing when clicking inside */
        }
        role="dialog"
        aria-modal="true"
      >
        {isMobile && (
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "var(--space-4)",
              left: "var(--space-4)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Close"
          >
            <Icon
              name="right-chevron"
              size={28}
              stroke="var(--color-land-dark)"
              fill="transparent"
            />
          </button>
        )}
        {children}
      </div>
    </div>
  );
};
