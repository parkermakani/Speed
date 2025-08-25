import React from "react";

interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "outlined";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  clickable?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({
  children,
  variant = "default",
  padding = "md",
  clickable = false,
  onClick,
  className = "",
  style: userStyle = {},
}: CardProps) {
  const baseStyles: React.CSSProperties = {
    borderRadius: "var(--radius-lg)",
    transition: "var(--transition-fast)",
    position: "relative",
    cursor: clickable ? "pointer" : "default",
    boxSizing: "border-box",
    overflow: "hidden",
  };

  const paddingStyles = {
    none: { padding: "var(--space-0)" },
    sm: { padding: "var(--space-3)" },
    md: { padding: "var(--space-4)" },
    lg: { padding: "var(--space-6)" },
    xl: { padding: "var(--space-8)" },
  };

  const rawVariantStyles = {
    default: {
      backgroundColor: "var(--color-bg-elevated)",
      border: "none",
      boxShadow: "var(--shadow-sm)",
      hover: clickable
        ? { boxShadow: "var(--shadow-md)", transform: "translateY(-1px)" }
        : {},
    },
    elevated: {
      backgroundColor: "var(--color-bg-elevated)",
      border: "none",
      boxShadow: "var(--shadow-lg)",
      hover: clickable
        ? { boxShadow: "var(--shadow-xl)", transform: "translateY(-2px)" }
        : {},
    },
    outlined: {
      backgroundColor: "var(--color-bg)",
      border: "1px solid var(--color-border)",
      boxShadow: "none",
      hover: clickable
        ? {
            borderColor: "var(--color-border-focus)",
            boxShadow: "var(--shadow-sm)",
          }
        : {},
    },
  } as const;

  const { hover: hoverStyles, ...variantBase } = rawVariantStyles[variant];

  const style = {
    ...baseStyles,
    ...paddingStyles[padding],
    ...variantBase,
    ...userStyle,
  };

  const handleMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
    if (clickable) {
      Object.assign(event.currentTarget.style, hoverStyles);
    }
  };

  const handleMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
    if (clickable) {
      event.currentTarget.style.boxShadow = variantBase.boxShadow || "none";
      event.currentTarget.style.transform = "none";
      if (variant === "outlined") {
        event.currentTarget.style.borderColor = "var(--color-border)";
      }
    }
  };

  const handleClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };

  return (
    <div
      className={className}
      style={style}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
