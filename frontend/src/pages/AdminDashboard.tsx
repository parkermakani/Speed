import React, { useState, useEffect, useRef } from "react";
import { Stack, Text, Button, FormField, Card } from "../components/primitives";
import { useAuth } from "../hooks/useAuth";
import { fetchStatus, updateStatus, ApiError } from "../services/api";
import { fetchSleep, toggleSleep } from "../services/api";
import { CityTable } from "../components/CityTable";
import type { Status, StatusUpdate } from "../types";

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
  const [submitError, setSubmitError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [selectedCityIndex, setSelectedCityIndex] = useState(-1);
  const [debounceCityTimeout, setDebounceCityTimeout] = useState<number | null>(
    null
  );
  const cityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCurrentStatus();
    loadSleep();
  }, []);

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
          setSubmitError("Authentication expired. Please log in again.");
          // Could trigger logout here
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

  const handleCityInputChange = (value: string) => {
    setFormData((prev) => ({ ...prev, city: value }));

    if (value.trim()) {
      debouncedCitySearch(value);
    } else {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
    }
  };

  // Fetch city suggestions from Mapbox Geocoding API
  const searchCitySuggestions = async (query: string) => {
    if (!query.trim()) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      return;
    }

    const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!MAPBOX_TOKEN) return;

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query.trim()
      )}.json?types=place&limit=5&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        setCitySuggestions(data.features);
        setShowCitySuggestions(true);
        setSelectedCityIndex(-1);
      } else {
        setCitySuggestions([]);
        setShowCitySuggestions(false);
      }
    } catch (err) {
      console.error("Failed to search cities", err);
      setCitySuggestions([]);
      setShowCitySuggestions(false);
    }
  };

  const debouncedCitySearch = (query: string) => {
    if (debounceCityTimeout) {
      clearTimeout(debounceCityTimeout);
    }

    const timeout = setTimeout(() => {
      searchCitySuggestions(query);
    }, 300);

    setDebounceCityTimeout(timeout);
  };

  const selectCitySuggestion = (suggestion: any) => {
    setFormData((prev) => ({
      ...prev,
      city: suggestion.place_name || suggestion.text,
    }));
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    setSelectedCityIndex(-1);
    // remove lat/lng errors

    // Keep focus on input after selection
    setTimeout(() => {
      cityInputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showCitySuggestions || citySuggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedCityIndex((prev) =>
          prev < citySuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedCityIndex((prev) =>
          prev > 0 ? prev - 1 : citySuggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedCityIndex >= 0) {
          selectCitySuggestion(citySuggestions[selectedCityIndex]);
        }
        break;
      case "Escape":
        setCitySuggestions([]);
        setShowCitySuggestions(false);
        setSelectedCityIndex(-1);
        break;
    }
  };

  // Fetch city polygon on blur
  const handleCityBlur = async () => {
    if (!formData.city) return;

    const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!MAPBOX_TOKEN) {
      console.error("Mapbox token missing");
      return;
    }

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        formData.city
      )}.json?types=place&limit=1&polygon_geojson=true&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];

        let geometry = feature.geometry;
        const centerCoords =
          feature.center || feature.geometry?.coordinates[0][0];
        const [lngCenter, latCenter] = centerCoords;

        // extract state name from context
        const region = feature.context?.find((c: any) =>
          c.id.startsWith("region")
        );
        const stateName = region?.text || "";

        // If Mapbox didn't return a polygon, build one from bbox (paid boundaries absent)
        if (
          geometry.type !== "Polygon" &&
          feature.bbox &&
          Array.isArray(feature.bbox)
        ) {
          const [minLng, minLat, maxLng, maxLat] = feature.bbox;
          geometry = {
            type: "Polygon",
            coordinates: [
              [
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat],
              ],
            ],
          } as any;
        }

        setFormData((prev) => ({
          ...prev,
          lat: latCenter,
          lng: lngCenter,
          state: stateName,
          cityPolygon: JSON.stringify(geometry),
        }));
      }
    } catch (error) {
      console.error("Failed to fetch city polygon", error);
    }
  };

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

        <Card padding="sm" style={{ boxShadow: "none", display: "flex", alignSelf: "center" }}>
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
        </Card>

        {/* Journey Cities Table */}
        <CityTable onChange={loadCurrentStatus} />

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
