import React from "react";
import logoUrl from "../assets/Graphics/SpeedDoesAmericaHQ.png";
import mobileLogoUrl from "../assets/Graphics/SpeedDoesAmericaMobile.png";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface HeaderProps {
  /** Additional elements (e.g. nav buttons) rendered inside the header */
  children?: React.ReactNode;
}

/**
 * Site-wide floating header with blur-fade background.
 * The styling is provided via the existing `.site-header` CSS class.
 */
export const Header: React.FC<HeaderProps> = ({ children }) => {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const src = isMobile ? mobileLogoUrl : logoUrl;
  return (
    <header className="site-header">
      <h1 className="site-title">
        <img src={src} alt="Speed Does America" className="site-logo" />
      </h1>
      {children}
    </header>
  );
};
