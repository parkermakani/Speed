import React, { useEffect, useState } from "react";
import type { City } from "../types";
import {
  fetchCities,
  toggleCurrentCity,
  updateCity,
  uploadCityLocatorIcon,
  ApiError,
} from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { Card, Stack, Text, Button, Icon } from "./primitives";
import { CityEditDialog } from "./CityEditDialog";

interface CityTableProps {
  onChange?: () => void; // callback after successful toggle
}

export const CityTable: React.FC<CityTableProps> = ({ onChange }) => {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { token } = useAuth();

  const HIDE = import.meta.env.VITE_HIDE_CITIES === "true";

  // dialog state
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadCities = async () => {
    try {
      const data = await fetchCities();
      setCities(data);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError("Failed to load cities");
      }
    }
  };

  useEffect(() => {
    loadCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (id: number) => {
    if (!token) {
      alert("Auth expired. Please log in again.");
      return;
    }
    setLoading(true);
    try {
      await toggleCurrentCity(id, token);
      await loadCities();
      onChange?.();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Failed to update city");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (city: City) => {
    setEditingCity(city);
    setDialogOpen(true);
  };

  const handleDialogSave = async (payload: {
    city: string;
    state: string;
    keywords: string;
    start?: string | null;
    file?: File | null;
  }) => {
    if (!token || !editingCity) return;
    setLoading(true);
    try {
      const { file, start, ...updatePayload } = payload;
      // First update textual fields (map Start to last_current_at)
      const body: any = { ...updatePayload };
      if (start) body.last_current_at = start;
      try {
        await updateCity(editingCity.id, body, token);
      } catch (err: any) {
        const msg = err?.message || "Failed to update city";
        alert(`City update failed: ${msg}`);
        throw err;
      }
      // Then upload file if provided
      if (file) {
        try {
          const url = await uploadCityLocatorIcon(editingCity.id, file, token);
          console.debug("[CityTable] Uploaded locator icon:", url);
        } catch (err: any) {
          const msg = err?.message || "Upload failed";
          alert(
            `Locator icon upload failed: ${msg}\n\nCheck that you are logged in and the backend has Firebase service account + Storage bucket configured.`
          );
          throw err;
        }
      }
    } catch (e) {
      // Keep dialog open so user can retry when an error occurs
      setLoading(false);
      return;
    } finally {
      // Close on success
      if (!loading) return;
      try {
        setDialogOpen(false);
        setEditingCity(null);
        await loadCities();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <Card
        padding="md"
        style={{ width: "100%", maxWidth: "800px", margin: "0 auto" }}
      >
        <Stack spacing="sm">
          <Text size="lg" weight="medium">
            Journey Cities
          </Text>
          {error && (
            <Text size="sm" color="error">
              {error}
            </Text>
          )}
          <div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px" }}>#</th>
                  <th style={{ textAlign: "left", padding: "4px" }}>City</th>
                  <th style={{ textAlign: "left", padding: "4px" }}>State</th>
                  <th style={{ textAlign: "left", padding: "4px" }}>
                    Keywords
                  </th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c, idx) => (
                  <tr
                    key={c.id}
                    style={{ borderTop: "1px solid var(--color-border)" }}
                  >
                    <td style={{ padding: "4px" }}>
                      {HIDE ? idx + 1 : c.order}
                    </td>
                    <td style={{ padding: "4px" }}>{HIDE ? "—" : c.city}</td>
                    <td style={{ padding: "4px" }}>{HIDE ? "—" : c.state}</td>
                    <td
                      style={{
                        padding: "4px",
                        maxWidth: "200px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.keywords || ""}
                    </td>
                    <td
                      style={{
                        padding: "4px",
                        display: "flex",
                        gap: "0.5rem",
                        justifyContent: "flex-end",
                        marginRight: "var(--space-8)",
                      }}
                    >
                      {c.is_current ? (
                        <Button size="sm" variant="ghost">
                          <Text size="sm" weight="bold" color="accent">
                            Current
                          </Text>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleToggle(c.id)}
                          disabled={loading}
                        >
                          Make Current
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(c)}
                      >
                        <Icon
                          name="edit"
                          size={20}
                          stroke="var(--color-primary)"
                          fill="transparent"
                          style={{ alignItems: "center" }}
                        />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Stack>
      </Card>

      {/* Edit dialog */}
      <CityEditDialog
        city={editingCity}
        open={dialogOpen}
        onSave={handleDialogSave}
        onClose={() => {
          setDialogOpen(false);
          setEditingCity(null);
        }}
      />
    </>
  );
};
