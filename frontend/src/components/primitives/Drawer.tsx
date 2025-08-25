import React, { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { ChromaticText } from "../ChromaticText";
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
  /** Optional partial slide offset in px (0 = closed, width = fully open) */
  slideOffsetPx?: number | null;
  /** If true, disables transition so drag follows the pointer exactly */
  isDragging?: boolean;
  /** Optional header title shown centered at the top */
  title?: string;
  /** If provided and on mobile, shows a back button on the left that calls onBack (defaults to onClose) */
  fancy?: boolean;

  showBackButton?: boolean;

  /** Optional back callback; defaults to onClose */
  onBack?: () => void;
  /** Optional right-side header action (e.g., cart button) */
  rightAction?: React.ReactNode;
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
  slideOffsetPx = null,
  isDragging = false,
  title,
  fancy = false,
  showBackButton = true,
  onBack,
  rightAction,
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
  const isMobile = useMediaQuery("(max-width: 767px)");

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
    pointerEvents: isOpen || (slideOffsetPx ?? 0) > 0 ? "auto" : "none",
    // Ensure above ShopTab (z 1400) on mobile
    zIndex: zIndex ?? (isMobile ? 1500 : 1300),
  };

  // Compute transform: prefer explicit slide offset when provided (dragging),
  // otherwise fall back to open/closed transform.
  const translateX =
    slideOffsetPx != null
      ? `calc(100% - ${Math.max(0, slideOffsetPx)}px)`
      : isOpen
      ? "0"
      : "100%";

  const drawerStyles: React.CSSProperties = {
    position: "absolute",
    top: 0,
    right: 0,
    height: "100%",
    backgroundColor: "var(--color-land)",
    borderLeft: "4px solid var(--color-land-dark)",
    backdropFilter: "blur(6px)",
    boxShadow: "-4px 0 16px rgba(0,0,0,0.3)",
    transform: `translateX(${translateX})`,
    transition: isDragging ? "none" : "transform var(--transition-slow)",
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
        {(title || rightAction || showBackButton || fancy) && (
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 100,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              padding: "0 var(--space-3)",
              background: "var(--color-land)",
              borderBottom: "1px solid var(--color-land-dark)",
              minHeight: 56,
              columnGap: "var(--space-2)",
            }}
          >
            {/* Left: Back button on mobile only */}
            <div style={{ justifySelf: "start" }}>
              {showBackButton && (
                <button
                  onClick={onBack ?? onClose}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label="Back"
                >
                  <Icon
                    name="left-chevron"
                    size={24}
                    stroke="var(--color-land-dark)"
                    fill="transparent"
                  />
                </button>
              )}
            </div>
            {/* Center: Title */}
            <div style={{ textAlign: "center", overflow: "hidden" }}>
              {title && (
                <ChromaticText
                  text={title}
                  layers={fancy ? undefined : ["base", "outline"]}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2 as any,
                    WebkitBoxOrient: "vertical" as any,
                    overflow: "hidden",
                    whiteSpace: "normal",
                    textOverflow: "ellipsis",
                    wordBreak: "break-word",
                    fontSize: isMobile
                      ? "clamp(1.2rem, 6vw, 1.75rem)"
                      : "clamp(1.6rem, 2.4vw, 3rem)",
                  }}
                />
              )}
            </div>
            {/* Right: Custom action */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                justifySelf: "end",
              }}
            >
              {rightAction}
            </div>
          </div>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </div>
  );
};
