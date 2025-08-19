import React from "react";
import pwLogo from "../assets/Graphics/PeopleWatchingLogoSmall.png";

/**
 * Floating footer overlay without blur. Displays the logo centered.
 */
export const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <img
        src={pwLogo}
        alt="Speed Does America"
        className="footer-logo"
        style={{
          width: "8%",
          opacity: 0.7,
          marginBottom: "-26px",
        }}
        onClick={() => {
          window.open("https://pplwatching.com/", "_blank");
        }}
      />
    </footer>
  );
};
