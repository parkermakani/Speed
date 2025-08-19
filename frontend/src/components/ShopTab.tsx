import React, { useEffect, useState } from "react";
import alertSfx from "../assets/Audio/SpeedSFX.wav";
import { Icon } from "./primitives/Icon";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface ShopTabProps {
  isOpen: boolean;
  toggle: () => void;
}

export const ShopTab: React.FC<ShopTabProps> = ({ isOpen, toggle }) => {
  const tabWidth = 48;
  const tabHeight = 120;
  const [hasAlert, setHasAlert] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1100px)");
  const isMobile = !isDesktop;

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
    transition: "transform var(--transition-slow)",
    transform: isDesktop && isOpen ? "translateX(-700px)" : "translateX(0)",
    zIndex: 1400,
  };

  return (
    <div style={styles} onClick={toggle} role="button" aria-label="Toggle shop">
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
