import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__inner">
        <span className="site-footer__brand">Speed Does America</span>
        <span className="site-footer__sep" aria-hidden>
          •
        </span>
        <span className="site-footer__text">
          © {new Date().getFullYear()} All rights reserved
        </span>
      </div>
    </footer>
  );
};

export default Footer;
