import React from "react";
import type { CSSProperties, HTMLAttributes } from "react";

type LayerKey = "base" | "inset" | "stars" | "outline";

interface ChromaticTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** Text content to apply chromatic layers to */
  text: string;
  /** Optional additional class names */
  className?: string;
  /**
   * Which decorative layers to render. Defaults to all.
   * Example: ["base", "outline"]
   */
  layers?: LayerKey[];
  /** Optional inline style applied to wrapper span */
  style?: CSSProperties;
}

/**
 * Renders multi-layer “chromatic” heading text using existing CSS classes.
 *
 * Usage:
 *   <ChromaticText text="Speed Does America" />
 */
export const ChromaticText: React.FC<ChromaticTextProps> = ({
  text,
  className,
  layers = ["base", "inset", "stars", "outline"],
  style,
  ...rest
}) => {
  const cn = className ? `chromatic-text ${className}` : "chromatic-text";

  const layerClassMap: Record<LayerKey, string> = {
    base: "chromatic-base",
    inset: "chromatic-inset",
    stars: "chromatic-stars-bottom",
    outline: "chromatic-outline",
  };

  return (
    <span className={cn} aria-label={text} role="text" style={style} {...rest}>
      {layers.map((layer) => (
        <span key={layer} className={`chromatic-layer ${layerClassMap[layer]}`}>
          {text}
        </span>
      ))}
    </span>
  );
};
