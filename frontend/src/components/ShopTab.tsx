import React, { useEffect, useRef, useState } from "react";
import alertSfx from "../assets/Audio/SpeedSFX.wav";
import { Icon } from "./primitives/Icon";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface ShopTabProps {
  isOpen: boolean;
  toggle: () => void;
  /** Optional explicit setter used by drag gestures */
  setOpen?: (open: boolean) => void;
  /** Communicate partial slide in px to the Drawer during drag */
  setSlidePx?: (px: number | null) => void;
  /** Communicate dragging state to disable transitions */
  setDragging?: (dragging: boolean) => void;
  /** Current slide offset (px) so the tab can move with the drawer */
  slidePx?: number | null;
  /** Whether a drag is in progress to disable transitions on the tab */
  dragging?: boolean;
}

export const ShopTab: React.FC<ShopTabProps> = ({
  isOpen,
  toggle,
  setOpen,
  setSlidePx,
  setDragging,
  slidePx,
  dragging,
}) => {
  const tabWidth = 48;
  const tabHeight = 120;
  const [hasAlert, setHasAlert] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1100px)");
  const isMobile = !isDesktop;

  // Drag state
  const draggingRef = useRef(false);
  const startXRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const baseSlideRef = useRef(0);

  // Helpers to open/close without double-toggling if already in desired state
  const openDrawer = () => {
    if (setOpen) {
      setOpen(true);
    } else if (!isOpen) {
      toggle();
    }
  };
  const closeDrawer = () => {
    if (setOpen) {
      setOpen(false);
    } else if (isOpen) {
      toggle();
    }
  };

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Only left mouse / primary pointer
    if (e.pointerType === "mouse" && e.button !== 0) return;
    draggingRef.current = true;
    movedRef.current = false;
    startXRef.current = e.clientX;
    pointerIdRef.current = e.pointerId;
    setDragging?.(true);
    // Initialize slide based on current open state
    const maxSlide = isDesktop ? 700 : window.innerWidth;
    baseSlideRef.current = isOpen ? maxSlide : 0;
    setSlidePx?.(baseSlideRef.current);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current || startXRef.current == null) return;
    const deltaX = startXRef.current - e.clientX; // >0 dragging left (open), <0 dragging right (close)
    if (Math.abs(deltaX) > 5) {
      movedRef.current = true;
    }
    const maxSlide = isDesktop ? 700 : window.innerWidth;
    const slide = Math.max(
      0,
      Math.min(maxSlide, baseSlideRef.current + deltaX)
    );
    setSlidePx?.(slide);
  };

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const startX = startXRef.current;
    startXRef.current = null;
    pointerIdRef.current = null;
    setDragging?.(false);
    if (startX == null) return;
    const deltaX = startX - e.clientX;
    const maxSlide = isDesktop ? 700 : window.innerWidth;
    const finalSlide = Math.max(
      0,
      Math.min(maxSlide, baseSlideRef.current + deltaX)
    );
    const shouldOpen = finalSlide > maxSlide / 2;
    if (!movedRef.current) {
      // Small movement, treat as a click (toggle)
      toggle();
    } else if (shouldOpen) {
      openDrawer();
    } else {
      closeDrawer();
    }
    // Allow Drawer to animate to final state
    setSlidePx?.(null);
  };

  // Trigger the alert icon swap after a random delay between 10–20 s
  useEffect(() => {
    const randomDelay = Math.floor(Math.random() * 10000) + 10000; // 10–20 s
    const timer = setTimeout(() => setHasAlert(true), randomDelay);
    return () => clearTimeout(timer);
  }, []);

  // Play alert sound once when alert activates
  useEffect(() => {
    if (hasAlert) {
      const audio = new Audio(alertSfx);
      audio.volume = 0.5;
      // Attempt to play; some browsers block without user gesture.
      audio.play().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("Unable to autoplay alert sound:", err);
      });
    }
  }, [hasAlert]);

  // Hide the tab only when we're on mobile AND the drawer is open (mobile drawer covers screen)
  if (isMobile && isOpen) {
    return null;
  }

  const maxSlide = isDesktop ? 700 : window.innerWidth;
  const currentSlide = slidePx != null ? slidePx : isOpen ? maxSlide : 0;

  const styles: React.CSSProperties = {
    position: "fixed",
    top: isMobile ? "70%" : `calc(50% - ${tabHeight / 2}px)`,
    right: 0,
    width: `${tabWidth}px`,
    height: `${tabHeight}px`,
    backgroundColor: "var(--color-land)",
    borderTopLeftRadius: "var(--radius-lg)",
    borderBottomLeftRadius: "var(--radius-lg)",
    borderLeft: "4px solid var(--color-land-dark)",
    borderTop: "4px solid var(--color-land-dark)",
    borderBottom: "4px solid var(--color-land-dark)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: dragging ? "none" : "transform var(--transition-slow)",
    transform: `translateX(-${currentSlide}px)`,
    zIndex: 1400,
  };

  return (
    <div
      data-tip-target="shoptab"
      style={styles}
      onClick={(e) => {
        // If a drag occurred, suppress click toggle to avoid double actions
        if (movedRef.current) {
          e.preventDefault();
          e.stopPropagation();
          movedRef.current = false;
          return;
        }
        toggle();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="button"
      aria-label="Toggle shop"
    >
      {isOpen ? (
        <Icon
          name="right-chevron"
          size={32}
          stroke="var(--color-land-dark)"
          fill="transparent"
        />
      ) : hasAlert ? (
        <Icon name="shop-alert" size={32} preserveColors />
      ) : (
        <Icon
          name="shop"
          size={32}
          stroke="var(--color-land-dark)"
          fill="transparent"
        />
      )}
    </div>
  );
};
