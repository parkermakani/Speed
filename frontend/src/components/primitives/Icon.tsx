import React from "react";

// Import SVGs as raw strings so we can manipulate them at runtime
import editSvg from "../../assets/Icons/edit.svg?raw";
import leftChevronSvg from "../../assets/Icons/left-chevron.svg?raw";
import rightChevronSvg from "../../assets/Icons/right-chevron.svg?raw";
import settingsSvg from "../../assets/Icons/settings.svg?raw";
import shopSvg from "../../assets/Icons/shop.svg?raw";
import shopAlertSvg from "../../assets/Icons/shop-alert.svg?raw";

const ICONS: Record<string, string> = {
  edit: editSvg,
  "left-chevron": leftChevronSvg,
  "right-chevron": rightChevronSvg,
  settings: settingsSvg,
  shop: shopSvg,
  "shop-alert": shopAlertSvg,
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
