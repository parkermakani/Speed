import React from "react";
import { ChromaticText } from "./ChromaticText";

interface QuoteProps {
  quote: string;
}

/**
 * Fixed-position quote overlay displayed on top of the map.
 */
export const Quote: React.FC<QuoteProps> = ({ quote }) => {
  return (
    <div
      style={{
        maxWidth: "80%",
        textAlign: "center",
        pointerEvents: "auto",
      }}
    >
      <ChromaticText
        text={quote}
        layers={["base", "outline"]}
        style={{
          fontSize: "1.5rem",
        }}
      />
    </div>
  );
};
