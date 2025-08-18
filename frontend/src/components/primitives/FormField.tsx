import React from "react";
import { Text } from "./Text";
import { Stack } from "./Stack";

interface FormFieldProps {
  children: React.ReactNode;
  label?: string;
  error?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function FormField({
  children,
  label,
  error,
  description,
  required = false,
  disabled = false,
  className = "",
  style,
}: FormFieldProps) {
  const fieldId = React.useId();

  // Clone children to add proper ARIA attributes
  const enhancedChildren = React.cloneElement(children as React.ReactElement, {
    id: fieldId,
    "aria-describedby":
      [
        description ? `${fieldId}-description` : "",
        error ? `${fieldId}-error` : "",
      ]
        .filter(Boolean)
        .join(" "),
    "aria-invalid": error ? "true" : "false",
    error: !!error,
    disabled,
    required,
  } as any);

  return (
    <Stack spacing="sm" className={className} style={style}>
      {label && (
        <Text
          as="label"
          htmlFor={fieldId}
          size="sm"
          weight="medium"
          color={disabled ? "muted" : "secondary"}
          style={{
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {label}
          {required && (
            <Text
              as="span"
              color="error"
              style={{ marginLeft: "var(--space-1)" }}
            >
              *
            </Text>
          )}
        </Text>
      )}

      {description && (
        <Text id={`${fieldId}-description`} size="sm" color="muted">
          {description}
        </Text>
      )}

      {enhancedChildren}

      {error && (
        <Text id={`${fieldId}-error`} size="sm" color="error" role="alert">
          {error}
        </Text>
      )}
    </Stack>
  );
}
