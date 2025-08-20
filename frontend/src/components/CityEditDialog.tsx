import React, { useState, useEffect } from "react";
import type { City } from "../types";
import { Card, Stack, Text, FormField, Button, Input } from "./primitives";

interface CityEditDialogProps {
  city: City | null;
  open: boolean;
  onSave: (payload: { city: string; state: string; keywords: string }) => void;
  onClose: () => void;
}

export const CityEditDialog: React.FC<CityEditDialogProps> = ({
  city,
  open,
  onSave,
  onClose,
}) => {
  const [cityVal, setCityVal] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [keywordsVal, setKeywordsVal] = useState("");

  useEffect(() => {
    if (city) {
      setCityVal(city.city);
      setStateVal(city.state);
      setKeywordsVal(city.keywords || "");
    }
  }, [city]);

  if (!open || !city) return null;

  const handleSave = () => {
    onSave({
      city: cityVal.trim(),
      state: stateVal.trim(),
      keywords: keywordsVal.trim(),
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card padding="lg" style={{ minWidth: 320, maxWidth: "90vw" }}>
        <Stack spacing="lg">
          <Text size="lg" weight="medium">
            Edit City
          </Text>
          <FormField label="City">
            <Input
              value={cityVal}
              onChange={(e) => setCityVal(e.target.value)}
            />
          </FormField>
          <FormField label="State">
            <Input
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
            />
          </FormField>
          <FormField label="Keywords (comma separated)">
            <Input
              value={keywordsVal}
              onChange={(e) => setKeywordsVal(e.target.value)}
              placeholder="e.g. skyline, beach, tacos"
            />
          </FormField>
          <Stack direction="row" justify="end" spacing="md">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save
            </Button>
          </Stack>
        </Stack>
      </Card>
    </div>
  );
};
