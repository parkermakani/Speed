import React, { useEffect, useState } from "react";
import type { City } from "../types";
import {
  fetchCities,
  toggleCurrentCity,
  updateCity,
  ApiError,
} from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { Card, Stack, Text, Button, Icon } from "./primitives";

interface CityTableProps {
  onChange?: () => void; // callback after successful toggle
}

export const CityTable: React.FC<CityTableProps> = ({ onChange }) => {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { token } = useAuth();

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

  const handleEdit = async (city: City) => {
    if (!token) return;
    const newCity = prompt("City name", city.city) || city.city;
    const newState = prompt("State", city.state) || city.state;
    if (newCity === city.city && newState === city.state) return;
    setLoading(true);
    try {
      await updateCity(city.id, { city: newCity, state: newState }, token);
    } catch (e) {
      /* ignore */
    } finally {
      await loadCities();
      setLoading(false);
    }
  };

  return (
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
              </tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderTop: "1px solid var(--color-border)" }}
                >
                  <td style={{ padding: "4px" }}>{c.order}</td>
                  <td style={{ padding: "4px" }}>{c.city}</td>
                  <td style={{ padding: "4px" }}>{c.state}</td>
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
  );
};
