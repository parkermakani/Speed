import React from "react";
import logoUrl from "../assets/Graphics/SpeedDoesAmericaHQ.png";

interface HeaderProps {
  /** Additional elements (e.g. nav buttons) rendered inside the header */
  children?: React.ReactNode;
}

/**
 * Site-wide floating header with blur-fade background.
 * The styling is provided via the existing `.site-header` CSS class.
 */
export const Header: React.FC<HeaderProps> = ({ children }) => {
  return (
    <header className="site-header">
      <h1 className="site-title">
        <img src={logoUrl} alt="Speed Does America" className="site-logo" />
      </h1>
      {children}
    </header>
  );
};
