import React from "react";
import PeopleWatchingLogoSmall from "../assets/Graphics/PeopleWatchingLogoSmall.png";

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__inner">
        <img
          src={PeopleWatchingLogoSmall}
          alt="People Watching"
          className="site-footer__logo"
        />
      </div>
    </footer>
  );
};

export default Footer;
