import React from "react";
import americaLogoUrl from "../assets/Graphics/SpeedDoesAmericaHQ.png";
import americaMobileLogoUrl from "../assets/Graphics/SpeedDoesAmericaMobile.png";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useTour } from "../contexts/TourContext";

interface HeaderProps {
  /** Additional elements (e.g. nav buttons) rendered inside the header */
  children?: React.ReactNode;
}

/**
 * Chevron Left Icon
 */
const ChevronLeft: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className = "",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

/**
 * Chevron Right Icon
 */
const ChevronRight: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className = "",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/**
 * Placeholder logo for tours without custom graphics
 */
const PlaceholderLogo: React.FC<{ name: string; isMobile: boolean }> = ({
  name,
  isMobile,
}) => (
  <div
    className="flex items-center justify-center px-4 py-2"
    style={{
      fontFamily: "var(--font-display)",
      fontSize: isMobile ? "var(--title-font-size-mobile)" : "var(--title-font-size)",
      color: "var(--color-text)",
      textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
      fontWeight: 700,
      letterSpacing: "0.02em",
    }}
  >
    {name}
  </div>
);

/**
 * Site-wide floating header with tour navigation.
 * Displays logo with chevron buttons on either side to switch tours.
 */
export const Header: React.FC<HeaderProps> = ({ children }) => {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { activeTour, nextTour, prevTour, isTransitioning } = useTour();

  // Determine logo source based on tour and device
  const getLogoSrc = () => {
    if (activeTour.id === "america") {
      return isMobile ? americaMobileLogoUrl : americaLogoUrl;
    }
    // For tours without custom logos, return empty string (will use placeholder)
    return isMobile ? activeTour.logoMobileUrl : activeTour.logoUrl;
  };

  const logoSrc = getLogoSrc();
  const hasLogo = logoSrc && logoSrc.length > 0;

  return (
    <header className="site-header">
      <div
        className="flex items-center justify-center gap-2 md:gap-4"
        style={{ width: "100%" }}
      >
        {/* Left chevron - previous tour */}
        <button
          onClick={prevTour}
          className="tour-nav-btn p-1 md:p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text)",
            opacity: isTransitioning ? 0.5 : 1,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
          }}
          aria-label="Previous tour"
          disabled={isTransitioning}
        >
          <ChevronLeft size={isMobile ? 28 : 36} />
        </button>

        {/* Logo/Title */}
        <h1
          className="site-title"
          style={{
            opacity: isTransitioning ? 0.7 : 1,
            transition: "opacity 0.3s ease",
          }}
        >
          {hasLogo ? (
            <img
              src={logoSrc}
              alt={activeTour.name}
              className="site-logo"
              style={{
                maxHeight: isMobile ? "50px" : "clamp(50px, 14vw, 110px)",
                width: "auto",
              }}
            />
          ) : (
            <PlaceholderLogo name={activeTour.name} isMobile={isMobile} />
          )}
        </h1>

        {/* Right chevron - next tour */}
        <button
          onClick={nextTour}
          className="tour-nav-btn p-1 md:p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text)",
            opacity: isTransitioning ? 0.5 : 1,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
          }}
          aria-label="Next tour"
          disabled={isTransitioning}
        >
          <ChevronRight size={isMobile ? 28 : 36} />
        </button>
      </div>
      {children}
    </header>
  );
};
