import React from "react";
import { ChromaticText } from "./ChromaticText";

interface QuoteProps {
  quote: string;
  /** When true, wraps the quote in quotation marks. Defaults to true. */
  quoted?: boolean;
  /** Adds a subtle text shadow for readability over busy backgrounds */
  withShadow?: boolean;
}

/**
 * Fixed-position quote overlay displayed on top of the map.
 */
export const Quote: React.FC<QuoteProps> = ({
  quote,
  quoted = true,
  withShadow = false,
}) => {
  return (
    <div
      data-tip-target="quote"
      style={{
        maxWidth: "80%",
        textAlign: "center",
        pointerEvents: "auto",
      }}
    >
      {!quoted && quote.startsWith("#") ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            whiteSpace: "nowrap",
          }}
        >
          <ChromaticText
            text="#"
            layers={["base"]}
            className={withShadow ? "quote-shadow" : undefined}
            style={{ fontSize: "1.5rem" }}
          />
          <ChromaticText
            text={quote.slice(1)}
            layers={["base", "outline"]}
            className={withShadow ? "quote-shadow" : undefined}
            style={{ fontSize: "1.5rem" }}
          />
        </span>
      ) : (
        <ChromaticText
          text={quoted ? `"${quote}"` : quote}
          layers={["base", "outline"]}
          className={withShadow ? "quote-shadow" : undefined}
          style={{
            fontSize: "1.5rem",
          }}
        />
      )}
    </div>
  );
};
