import React from "react";
import pwLogo from "../assets/Graphics/PeopleWatchingLogoSmall.png";
import { Icon } from "./primitives/Icon";

/**
 * Floating footer overlay without blur. Displays the logo centered.
 */
export const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <img
          src={pwLogo}
          alt="Speed Does America"
          className="footer-logo"
          style={{
            width: "8%",
            opacity: 0.7,
            marginBottom: "-26px",
            cursor: "pointer",
          }}
          onClick={() => {
            window.open("https://pplwatching.com/", "_blank");
          }}
        />
        <Icon
          name="ego-logo"
          size={48}
          color="var(--color-star-white)"
          style={{
            opacity: 0.7,
            cursor: "pointer",
            marginBottom: "-26px",
          }}
          onClick={() => {
            window.open("https://egox14.com/", "_blank");
          }}
        />
      </div>
    </footer>
  );
};
