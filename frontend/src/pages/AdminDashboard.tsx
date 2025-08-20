import React, { useState, useEffect } from "react";
import { Stack, Text, Button, FormField, Card } from "../components/primitives";
import { useAuth } from "../hooks/useAuth";
import { fetchStatus, updateStatus, ApiError } from "../services/api";
import { fetchSleep, toggleSleep } from "../services/api";
import { fetchCities, runScrape } from "../services/api";
import { CityTable } from "../components/CityTable";
import { AdminMerch } from "../components/AdminMerch";
import type { Status, StatusUpdate } from "../types";
import { fetchSettings, updateSettings } from "../services/api";
import { Input } from "../components/primitives/Input";
import type { Settings } from "../types";

interface AdminDashboardProps {
  onStatusUpdate?: (status: Status) => void;
}

export function AdminDashboard({ onStatusUpdate }: AdminDashboardProps) {
  const { logout, token } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<Status | null>(null);
  const [isSleep, setIsSleep] = useState(false);
  const [formData, setFormData] = useState<StatusUpdate>({
    lat: 0,
    lng: 0,
    state: "",
    quote: "",
    city: "",
    cityPolygon: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string>("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsForm, setSettingsForm] = useState<Settings>({
    socialScrapeIntervalMin: 60,
    instagramUsername: "",
    twitterUsername: "",
    twitchUsername: "",
    youtubeUsername: "",
  });
  const [submitError, setSubmitError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  // City input removed – suggestions state deleted

  useEffect(() => {
    loadCurrentStatus();
    loadSleep();
    loadSettingsFromServer();
  }, []);

  const loadSettingsFromServer = async () => {
    try {
      const s = await fetchSettings();
      setSettings(s);
      setSettingsForm(s);
    } catch (e) {
      console.error("Failed to fetch settings", e);
    }
  };

  const loadSleep = async () => {
    try {
      const data = await fetchSleep();
      setIsSleep(data.isSleep);
    } catch (e) {
      console.error("Failed to fetch sleep", e);
    }
  };

  const handleSleepToggle = async () => {
    if (!token) return;
    const newVal = !isSleep;
    setIsSleep(newVal);
    try {
      await toggleSleep(newVal, token);
    } catch (e) {
      console.error("Failed to toggle sleep", e);
      // revert UI
      setIsSleep(!newVal);
    }
  };

  const handleManualScrape = async () => {
    if (!token) return;
    setScrapeMsg("Running scrape...");
    try {
      const cities = await fetchCities();
      const current = cities.find((c) => c.is_current);
      if (!current) {
        setScrapeMsg("No current city set.");
        return;
      }
      const saved = await runScrape(current.id, token);
      setScrapeMsg(`Fetched ${saved} posts.`);
    } catch (e) {
      setScrapeMsg("Scrape failed");
    }
  };

  const handleSaveSettings = async () => {
    if (!token) return;
    try {
      const updated = await updateSettings(settingsForm, token);
      setSettings(updated);
      alert("Settings updated");
    } catch (e) {
      alert("Failed to update settings");
    }
  };

  const loadCurrentStatus = async () => {
    try {
      const status = await fetchStatus();
      setCurrentStatus(status);
      setFormData({
        lat: status.lat,
        lng: status.lng,
        state: status.state || "",
        quote: status.quote,
        city: status.city || "",
        cityPolygon: status.cityPolygon || "",
      });
      setLastUpdated(status.lastUpdated);
    } catch (error) {
      console.error("Failed to load current status:", error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Lat/Lng no longer user-editable; rely on city polygon center.
    setErrors(newErrors);

    // Validate city
    if (!formData.city?.trim()) {
      newErrors.city = "City is required";
    }

    // Validate quote
    if (!formData.quote.trim()) {
      newErrors.quote = "Quote is required";
    } else if (formData.quote.length > 500) {
      newErrors.quote = "Quote must be 500 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !token) {
      return;
    }

    setLoading(true);
    setSubmitError("");

    try {
      const updatedStatus = await updateStatus(formData, token);
      setCurrentStatus(updatedStatus);
      setLastUpdated(updatedStatus.lastUpdated);

      // Notify parent component of the update
      onStatusUpdate?.(updatedStatus);

      // Show success (could add a success message state)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setSubmitError("Session expired. Please log in again.");
          logout();
        } else {
          setSubmitError(error.message);
        }
      } else {
        setSubmitError("Failed to update status. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const updateField = (field: keyof StatusUpdate, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  // removed city suggestion handlers

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "var(--space-container)",
        background: "var(--color-bg)",
      }}
    >
      <Stack spacing="xl">
        {/* Header */}
        <Card padding="md">
          <Stack direction="row" justify="between" align="center">
            <Stack spacing="xs">
              <Text as="h1" size="2xl" weight="bold">
                Admin Dashboard
              </Text>
              <Text size="sm" color="secondary">
                Update map location and quote
              </Text>
            </Stack>
            <Button variant="ghost" onClick={handleLogout}>
              Logout
            </Button>
          </Stack>
        </Card>

        {/* Current Status */}
        {currentStatus && (
          <Card padding="md" style={{ boxShadow: "none" }}>
            <Stack spacing="sm">
              <Text size="lg" weight="medium">
                Current Status
              </Text>
              <Stack spacing="xs">
                {currentStatus.city && (
                  <Text size="sm" color="secondary">
                    City: {currentStatus.city}
                  </Text>
                )}
                <Text size="sm" color="secondary">
                  Quote: "{currentStatus.quote}"
                </Text>
                <Text size="xs" color="muted">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </Text>
              </Stack>
            </Stack>
          </Card>
        )}

        <Card
          padding="sm"
          style={{
            boxShadow: "none",
            display: "flex",
            alignSelf: "center",
            width: "100%",
            maxWidth: "600px",
            flexDirection: "row",
            justifyContent: "space-around",
            alignItems: "center",
          }}
        >
          <Stack
            direction="row"
            spacing="sm"
            align="center"
            justify="center"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-2)",
            }}
          >
            <label htmlFor="sleep-switch">Sleep Mode</label>
            <input
              id="sleep-switch"
              type="checkbox"
              checked={isSleep}
              onChange={handleSleepToggle}
            />
          </Stack>

          {/* Manual scrape button */}
          <Button
            variant="secondary"
            onClick={handleManualScrape}
            disabled={!token || loading}
          >
            Fetch Posts Now
          </Button>
          {scrapeMsg && (
            <Text size="xs" color="secondary">
              {scrapeMsg}
            </Text>
          )}
        </Card>

        {/* Journey Cities Table */}
        <CityTable onChange={loadCurrentStatus} />

        {/* Merch Management */}
        <AdminMerch />

        {/* Settings */}
        <Card
          padding="lg"
          style={{ width: "100%", maxWidth: "600px", alignSelf: "center" }}
        >
          <Stack spacing="lg">
            <Text size="lg" weight="medium">
              Social Settings
            </Text>
            <FormField label="Scrape Interval (minutes)">
              <Input
                type="number"
                value={settingsForm.socialScrapeIntervalMin}
                onChange={(e) =>
                  setSettingsForm((p) => ({
                    ...p,
                    socialScrapeIntervalMin: Number(e.target.value),
                  }))
                }
              />
            </FormField>
            <FormField label="Instagram Username">
              <Input
                value={settingsForm.instagramUsername}
                onChange={(e) =>
                  setSettingsForm((p) => ({
                    ...p,
                    instagramUsername: e.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Twitter Username">
              <Input
                value={settingsForm.twitterUsername}
                onChange={(e) =>
                  setSettingsForm((p) => ({
                    ...p,
                    twitterUsername: e.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Twitch Username">
              <Input
                value={settingsForm.twitchUsername}
                onChange={(e) =>
                  setSettingsForm((p) => ({
                    ...p,
                    twitchUsername: e.target.value,
                  }))
                }
              />
            </FormField>

            <FormField label="YouTube Username">
              <Input
                value={settingsForm.youtubeUsername}
                onChange={(e) =>
                  setSettingsForm((p) => ({
                    ...p,
                    youtubeUsername: e.target.value,
                  }))
                }
              />
            </FormField>
            <Button
              variant="primary"
              onClick={handleSaveSettings}
              disabled={!token}
            >
              Save Settings
            </Button>
          </Stack>
        </Card>

        {/* Update Form */}
        <Card padding="lg">
          <form onSubmit={handleSubmit}>
            <Stack spacing="lg">
              <Text size="lg" weight="medium">
                Update Location & Quote
              </Text>

              {submitError && (
                <Card
                  variant="outlined"
                  padding="sm"
                  style={{ borderColor: "var(--color-error)" }}
                >
                  <Text size="sm" color="error">
                    {submitError}
                  </Text>
                </Card>
              )}

              {/* City Field removed – managed via Journey Table */}

              {/* Lat/Lng fields removed – no longer used */}

              {/* Quote Field */}
              <FormField
                label="Quote"
                error={errors.quote}
                description={`${formData.quote.length}/500 characters`}
                required
              >
                <textarea
                  value={formData.quote}
                  onChange={(e) => updateField("quote", e.target.value)}
                  placeholder="Enter a quote to display on the map..."
                  disabled={loading}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "var(--space-3) var(--space-4)",
                    fontSize: "var(--text-base)",
                    fontFamily: "var(--font-sans)",
                    backgroundColor: "var(--color-bg-elevated)",
                    color: "var(--color-text)",
                    border: `1px solid ${
                      errors.quote
                        ? "var(--color-error)"
                        : "var(--color-border)"
                    }`,
                    borderRadius: "var(--radius-md)",
                    outline: "none",
                    resize: "vertical",
                    minHeight: "2.5rem",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = errors.quote
                      ? "var(--color-error)"
                      : "var(--color-accent)";
                    e.target.style.boxShadow = errors.quote
                      ? "0 0 0 2px rgba(245, 101, 101, 0.3)"
                      : "0 0 0 2px rgba(97, 218, 251, 0.3)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.quote
                      ? "var(--color-error)"
                      : "var(--color-border)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </FormField>

              {/* Submit button */}
              <Stack direction="row" spacing="md" justify="end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={loadCurrentStatus}
                  disabled={loading}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  disabled={loading}
                >
                  Update
                </Button>
              </Stack>
            </Stack>
          </form>
        </Card>

        {/* Helper Info */}
        <Card variant="outlined" padding="md">
          <Stack spacing="sm">
            <Text size="sm" weight="medium">
              Tips
            </Text>
            <Stack spacing="xs">
              <Text size="xs" color="muted">
                • Use tools like Google Maps or GPS coordinates for accurate
                latitude/longitude
              </Text>
              <Text size="xs" color="muted">
                • Latitude: -90 to 90 (negative = South, positive = North)
              </Text>
              <Text size="xs" color="muted">
                • Longitude: -180 to 180 (negative = West, positive = East)
              </Text>
              <Text size="xs" color="muted">
                • Changes will be visible immediately on the map
              </Text>
            </Stack>
          </Stack>
        </Card>
      </Stack>
    </div>
  );
}
