import React, { useState } from "react";
import {
  Stack,
  Text,
  Button,
  Input,
  FormField,
  Card,
} from "../components/primitives";
import { useAuth } from "../hooks/useAuth";

interface LoginForm {
  email: string;
  password: string;
}

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [form, setForm] = useState<LoginForm>({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }

    if (!form.password.trim()) {
      setError("Password is required");
      return;
    }

    setLoading(true);
    setError("");

    const result = await login(form.email, form.password);

    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.error || "Login failed");
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-container)",
        background: "var(--color-bg)",
      }}
    >
      <Card
        variant="elevated"
        padding="xl"
        style={{ width: "100%", maxWidth: "400px" }}
      >
        <form onSubmit={handleSubmit}>
          <Stack spacing="lg">
            <Stack spacing="sm" align="center">
              <Text as="h1" size="2xl" weight="bold" align="center">
                Admin Login
              </Text>
              <Text size="sm" color="secondary" align="center">
                Enter the admin password to access the dashboard
              </Text>
            </Stack>

            <FormField
              label="Email"
              required
              error={error && !form.email ? error : undefined}
            >
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                disabled={loading}
                fullWidth
                autoFocus
              />
            </FormField>

            <FormField
              label="Password"
              required
              error={error && !form.password ? error : undefined}
            >
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
                disabled={loading}
                fullWidth
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={!form.email.trim() || !form.password.trim() || loading}
            >
              Login
            </Button>

            <Text size="xs" color="muted" align="center">
              This is a secure admin area. Unauthorized access is not permitted.
            </Text>
          </Stack>
        </form>
      </Card>
    </div>
  );
}
