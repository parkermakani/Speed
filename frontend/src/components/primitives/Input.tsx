import React from "react";

interface InputProps {
  type?: "text" | "email" | "password" | "number" | "tel" | "url" | "search";
  placeholder?: string;
  value?: string | number;
  defaultValue?: string | number;
  disabled?: boolean;
  error?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  name?: string;
  id?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      type = "text",
      placeholder,
      value,
      defaultValue,
      disabled = false,
      error = false,
      size = "md",
      fullWidth = false,
      name,
      id,
      autoComplete,
      autoFocus = false,
      required = false,
      readOnly = false,
      maxLength,
      min,
      max,
      step,
      onChange,
      onBlur,
      onFocus,
      onKeyDown,
      className = "",
    }: InputProps,
    ref
  ) {
    const baseStyles: React.CSSProperties = {
      display: "block",
      width: fullWidth ? "100%" : "auto",
      boxSizing: "border-box",
      fontFamily: "var(--font-sans)",
      backgroundColor: disabled
        ? "var(--color-surface)"
        : "var(--color-bg-elevated)",
      color: "var(--color-text)",
      border: `1px solid ${
        error ? "var(--color-error)" : "var(--color-border)"
      }`,
      borderRadius: "var(--radius-md)",
      transition: "var(--transition-fast)",
      outline: "none",
      opacity: disabled ? 0.6 : 1,
      cursor: disabled ? "not-allowed" : "text",
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
        padding: "var(--space-4) var(--space-5)",
        fontSize: "var(--text-lg)",
        minHeight: "3rem",
      },
    };

    const style = {
      ...baseStyles,
      ...sizeStyles[size],
    };

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      if (!disabled) {
        event.currentTarget.style.borderColor = error
          ? "var(--color-error)"
          : "var(--color-accent)";
        event.currentTarget.style.boxShadow = error
          ? "0 0 0 2px rgba(245, 101, 101, 0.3)"
          : "0 0 0 2px rgba(97, 218, 251, 0.3)";
      }
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      event.currentTarget.style.borderColor = error
        ? "var(--color-error)"
        : "var(--color-border)";
      event.currentTarget.style.boxShadow = "none";
      onBlur?.(event);
    };

    const handleMouseEnter = (event: React.MouseEvent<HTMLInputElement>) => {
      if (!disabled && !event.currentTarget.matches(":focus")) {
        event.currentTarget.style.borderColor = error
          ? "var(--color-error)"
          : "var(--color-border-focus)";
      }
    };

    const handleMouseLeave = (event: React.MouseEvent<HTMLInputElement>) => {
      if (!disabled && !event.currentTarget.matches(":focus")) {
        event.currentTarget.style.borderColor = error
          ? "var(--color-error)"
          : "var(--color-border)";
      }
    };

    return (
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        id={id}
        autoComplete={autoComplete}
        autoFocus={autoFocus || undefined}
        required={required || undefined}
        readOnly={readOnly || undefined}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={onKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
        style={style}
        // Note: error prop is not passed to DOM, only used for styling
      />
    );
  }
);

export default Input;
