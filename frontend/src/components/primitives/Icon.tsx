import React from "react";

// Import SVGs as raw strings so we can manipulate them at runtime
import editSvg from "../../assets/Icons/edit.svg?raw";
import leftChevronSvg from "../../assets/Icons/left-chevron.svg?raw";
import rightChevronSvg from "../../assets/Icons/right-chevron.svg?raw";
import settingsSvg from "../../assets/Icons/settings.svg?raw";
import shopSvg from "../../assets/Icons/shop.svg?raw";
import shopAlertSvg from "../../assets/Icons/shop-alert.svg?raw";
import egoLogoSvg from "../../assets/Graphics/EgoX14Logo.svg?raw";
import animCircleSvg from "../../assets/Icons/anim-circle.svg?raw";
import animTriangleSvg from "../../assets/Icons/anim-triangle.svg?raw";
import animSquareSvg from "../../assets/Icons/anim-square.svg?raw";
import animPentagonSvg from "../../assets/Icons/anim-pentagon.svg?raw";
import animHexagonSvg from "../../assets/Icons/anim-hexagon.svg?raw";
import animStarSvg from "../../assets/Icons/anim-star.svg?raw";
import animDiamondSvg from "../../assets/Icons/anim-diamond.svg?raw";
import expandSvg from "../../assets/Icons/expand.svg?raw";
import collapseSvg from "../../assets/Icons/collapse.svg?raw";
import questionMarkSvg from "../../assets/Icons/question-mark.svg?raw";

const ICONS: Record<string, string> = {
  edit: editSvg,
  "left-chevron": leftChevronSvg,
  "right-chevron": rightChevronSvg,
  settings: settingsSvg,
  shop: shopSvg,
  "shop-alert": shopAlertSvg,
  "ego-logo": egoLogoSvg,
  "anim-circle": animCircleSvg,
  "anim-triangle": animTriangleSvg,
  "anim-square": animSquareSvg,
  "anim-pentagon": animPentagonSvg,
  "anim-hexagon": animHexagonSvg,
  "anim-star": animStarSvg,
  "anim-diamond": animDiamondSvg,
  expand: expandSvg,
  collapse: collapseSvg,
  "question-mark": questionMarkSvg,
};

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Name of the icon. Must match a key in the ICONS map above.
   */
  name: keyof typeof ICONS;
  /**
   * Size of the icon in pixels or any valid CSS size value. Default is 24.
   */
  size?: number | string;
  /**
   * Stroke color. Overrides `color` for stroke.
   */
  stroke?: string;
  /**
   * Fill color. Overrides `color` for fill.
   */
  fill?: string;
  /**
   * Fallback color applied to BOTH stroke and fill when `stroke` / `fill` are not provided.
   * Defaults to `currentColor` so the icon inherits from surrounding text.
   */
  color?: string;
  /**
   * When true, keeps original fill/stroke colors from the SVG instead of
   * overriding them. Useful for multi-color icons.
   */
  preserveColors?: boolean;
}

/**
 * Generic SVG Icon component that inlines svg markup so that `color` and
 * `size` can be controlled via props.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  stroke,
  fill,
  color = "currentColor",
  style,
  preserveColors = false,
  ...rest
}) => {
  const rawSvg = ICONS[name];

  if (!rawSvg) {
    console.warn(`Icon '${name}' not found`);
    return null;
  }

  const effectiveStroke = stroke ?? color;
  const effectiveFill = fill ?? color;

  let processedSvg = rawSvg;

  // Remove any hard-coded width/height so the svg scales with the container
  processedSvg = processedSvg.replace(/\s(width|height)="[^"]+"/g, "");

  // Inject width/height=100% so it fills the wrapper and stays centered
  processedSvg = processedSvg.replace(
    /<svg(\s|>)/,
    `<svg width="100%" height="100%" $1`
  );

  if (!preserveColors) {
    if (effectiveStroke) {
      processedSvg = processedSvg.replace(
        /stroke="[^"]+"/g,
        `stroke="${effectiveStroke}"`
      );
    }
    if (effectiveFill) {
      processedSvg = processedSvg.replace(
        /fill="[^"]+"/g,
        `fill="${effectiveFill}"`
      );
    }
  }

  const dimension = typeof size === "number" ? `${size}px` : size;

  return (
    <span
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dimension,
        height: dimension,
        color: effectiveFill ?? style?.color ?? undefined,
        lineHeight: 0,
        ...style,
      }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: processedSvg }}
    />
  );
};
