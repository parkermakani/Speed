import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  type = "button",
  onClick,
  className = "",
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-sans)",
    fontWeight: "var(--font-weight-medium)",
    borderRadius: "var(--radius-md)",
    border: "1px solid transparent",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    transition: "var(--transition-fast)",
    textDecoration: "none",
    outline: "none",
    position: "relative",
    width: fullWidth ? "100%" : "auto",
    opacity: disabled ? 0.6 : 1,
  };

  const sizeStyles = {
    sm: {
      padding: "var(--space-2) var(--space-3)",
      fontSize: "var(--text-sm)",
      minHeight: "2rem",
    },
    md: {
      padding: "var(--space-3) var(--space-4)",
      fontSize: "var(--text-base)",
      minHeight: "2.5rem",
    },
    lg: {
      padding: "var(--space-4) var(--space-6)",
      fontSize: "var(--text-lg)",
      minHeight: "3rem",
    },
  };

  const rawVariantStyles = {
    primary: {
      base: {
        backgroundColor: "var(--color-primary)",
        color: "var(--color-text-inverse)",
        borderColor: "var(--color-primary)",
      },
      hover: { backgroundColor: "var(--color-primary-hover)" },
      focus: { boxShadow: "0 0 0 2px var(--color-primary-light)" },
    },
    secondary: {
      base: {
        backgroundColor: "var(--color-surface)",
        color: "var(--color-text)",
        borderColor: "var(--color-border)",
      },
      hover: { backgroundColor: "var(--color-surface-hover)" },
      focus: { boxShadow: "0 0 0 2px var(--color-border-focus)" },
    },
    ghost: {
      base: {
        backgroundColor: "transparent",
        color: "var(--color-text)",
        borderColor: "transparent",
      },
      hover: { backgroundColor: "var(--color-surface)" },
      focus: { boxShadow: "0 0 0 2px var(--color-border-focus)" },
    },
    danger: {
      base: {
        backgroundColor: "var(--color-error)",
        color: "var(--color-text-inverse)",
        borderColor: "var(--color-error)",
      },
      hover: { backgroundColor: "#e53e3e" },
      focus: { boxShadow: "0 0 0 2px rgba(245, 101, 101, 0.3)" },
    },
  } as const;

  const {
    base: variantBase,
    hover: hoverStyles,
    focus: focusStyles,
  } = rawVariantStyles[variant];

  const style = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantBase,
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      type={type}
      className={className}
      style={style}
      onClick={handleClick}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, hoverStyles);
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.backgroundColor = variantBase.backgroundColor;
        }
      }}
      onFocus={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, focusStyles);
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {loading && (
        <span
          style={{
            marginRight: "var(--space-2)",
            display: "inline-block",
            width: "1rem",
            height: "1rem",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
      )}
      {children}
    </button>
  );
}

// Add spinner animation to global styles
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;
document.head.appendChild(style);
