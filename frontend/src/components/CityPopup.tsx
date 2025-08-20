import React from "react";
import { Card } from "./primitives/Card";
import { Icon } from "./primitives/Icon";
import type { JourneyCity } from "../types";
import { ChromaticText } from "./ChromaticText";

interface CityPopupProps {
  city: JourneyCity;
  onClose: () => void;
  showArrow?: boolean;
  inDrawer?: boolean;
}

/**
 * Shared popup content for both desktop (Mapbox Popup) and mobile (Drawer).
 * Shows city name and placeholder gallery cards that will be filled later.
 */
export const CityPopup: React.FC<CityPopupProps> = ({
  city,
  onClose: _onClose,
  showArrow = true,
  inDrawer = false,
}) => {
  // Inject Mapbox popup override styles once
  if (
    typeof document !== "undefined" &&
    !document.getElementById("_city_popup_styles")
  ) {
    const styleEl = document.createElement("style");
    styleEl.id = "_city_popup_styles";
    styleEl.innerHTML = `
      .mapboxgl-popup.city-popup,
      .mapboxgl-popup.city-popup .mapboxgl-popup-content {
        max-width: none !important;
      }
      .mapboxgl-popup.city-popup .mapboxgl-popup-content {
        background: transparent;
        padding: 0;
        border-radius: 0;
        box-shadow: none;
      }
      .mapboxgl-popup.city-popup .mapboxgl-popup-tip {
        display: none;
      }
    `;
    document.head.appendChild(styleEl);
  }

  const containerStyles: React.CSSProperties = {
    width: "100%",
    maxWidth: inDrawer ? "100%" : "min(90vw, 800px)",
    maxHeight: "75vh",
    padding: inDrawer
      ? "var(--space-4)"
      : "var(--space-4) var(--space-4) calc(var(--space-4) + 12px)",
    background: "var(--color-land)",
    border: inDrawer ? "none" : "4px solid var(--color-land-dark)",
    borderRadius: inDrawer ? 0 : "var(--radius-lg)",
    boxShadow: inDrawer ? "none" : "var(--shadow-lg)",
    color: "var(--color-text)",
    display: "flex",
    flexDirection: "column",
    overflow: "visible",
    boxSizing: "border-box",
    position: "relative",
    alignSelf: inDrawer ? "center" : undefined,
  };

  // Force no arrow when in drawer
  const shouldShowArrow = inDrawer ? false : showArrow;

  return (
    <div style={containerStyles}>
      {inDrawer && (
        <button
          onClick={_onClose}
          style={{
            position: "absolute",
            top: "var(--space-3)",
            left: "var(--space-3)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="Back"
        >
          <Icon
            name="left-chevron"
            size={28}
            stroke="var(--color-land-dark)"
            fill="transparent"
          />
        </button>
      )}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "var(--space-4)",
          paddingLeft: inDrawer
            ? "var(--space-6)"
            : undefined /* offset for back button */,
        }}
      >
        <ChromaticText
          text={`${city.city}, ${city.state}`}
          layers={["base", "outline"]}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: inDrawer ? "2.5rem" : "1.35rem",
            lineHeight: 1.2,
            textAlign: "center",
          }}
        />
      </header>
      {/* Placeholder gallery grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-3)",
          paddingBottom: "var(--space-1)",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} padding="none" style={{ overflow: "hidden" }}>
            <div
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                background: "var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-secondary)",
                fontSize: "0.8rem",
              }}
            >
              Coming&nbsp;soon
            </div>
          </Card>
        ))}
      </div>
      {shouldShowArrow && (
        <>
          {/* Outer arrow to represent border */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translate(-50%, 100%)",
              width: 0,
              height: 0,
              borderLeft: "16px solid transparent",
              borderRight: "16px solid transparent",
              borderTop: "16px solid var(--color-land-dark)",
              pointerEvents: "none",
            }}
          />
          {/* Inner arrow fills popup background */}
          <div
            style={{
              position: "absolute",
              bottom: 2,
              left: "50%",
              transform: "translate(-50%, calc(100% - 2px))",
              width: 0,
              height: 0,
              borderLeft: "12px solid transparent",
              borderRight: "12px solid transparent",
              borderTop: "12px solid var(--color-land)",
              pointerEvents: "none",
            }}
          />
        </>
      )}
    </div>
  );
};
