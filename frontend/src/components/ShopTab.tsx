import React from "react";
import { Icon } from "./primitives/Icon";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface ShopTabProps {
  isOpen: boolean;
  toggle: () => void;
}

export const ShopTab: React.FC<ShopTabProps> = ({ isOpen, toggle }) => {
  const tabWidth = 48;
  const tabHeight = 120;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (!isDesktop) {
    return null; // hide on mobile, drawer full-screen has its own back button
  }

  const styles: React.CSSProperties = {
    position: "fixed",
    top: `calc(50% - ${tabHeight / 2}px)`,
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
    transform: isOpen ? "translateX(calc(-40vw))" : "translateX(0)",
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
