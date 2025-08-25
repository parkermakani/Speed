import React from "react";
import { Card } from "./primitives/Card";
import type { JourneyCity } from "../types";
import { fetchCities, fetchCityPosts, type SocialPost } from "../services/api";
import { useEffect, useState } from "react";

interface CityPopupProps {
  city: JourneyCity;
  onClose: () => void;
  showArrow?: boolean;
  inDrawer?: boolean;
  arrowDirection?: "up" | "down";
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
  arrowDirection = "down",
}) => {
  const [posts, setPosts] = useState<SocialPost[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPosts() {
      try {
        // find city id first
        const all = await fetchCities();
        const match = all.find(
          (c) => c.city === city.city && c.state === city.state
        );
        if (match) {
          const data = await fetchCityPosts(match.id);
          if (isMounted) setPosts(data);
        }
      } catch (e) {
        // ignore errors silently for now
        if (isMounted) setPosts([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, [city.city, city.state]);

  // Inject Mapbox popup override styles once
  if (
    typeof document !== "undefined" &&
    !document.getElementById("_city_popup_styles")
  ) {
    const styleEl = document.createElement("style");
    styleEl.id = "_city_popup_styles";
    styleEl.innerHTML = `
      .mapboxgl-popup.city-popup { z-index: 2000 !important; }
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
    minWidth: inDrawer ? "100%" : "min(60vw, 500px)",
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
      {/* Posts gallery */}
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
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} padding="none" style={{ overflow: "hidden" }}>
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  background: "var(--color-border)",
                  animation: "pulse 1.5s infinite",
                }}
              />
            </Card>
          ))}

        {!loading &&
          posts &&
          posts.length > 0 &&
          posts.slice(0, 30).map((post, i) => {
            const imgUrl = post.mediaUrl || post.imageUrl;
            return (
              <Card key={i} padding="none" style={{ overflow: "hidden" }}>
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={post.caption || "Social post"}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                    }}
                  />
                ) : (
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
                    No&nbsp;image
                  </div>
                )}
              </Card>
            );
          })}

        {!loading && posts && posts.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              color: "var(--color-text-secondary)",
            }}
          >
            No posts yet.
          </div>
        )}
      </div>
      {shouldShowArrow && (
        <>
          {arrowDirection === "down" ? (
            <>
              {/* Outer arrow (border) */}
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
              {/* Inner arrow */}
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
          ) : (
            <>
              {/* Upward outer arrow */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translate(-50%, -100%)",
                  width: 0,
                  height: 0,
                  borderLeft: "16px solid transparent",
                  borderRight: "16px solid transparent",
                  borderBottom: "16px solid var(--color-land-dark)",
                  pointerEvents: "none",
                }}
              />
              {/* Upward inner arrow */}
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: "50%",
                  transform: "translate(-50%, calc(-100% + 2px))",
                  width: 0,
                  height: 0,
                  borderLeft: "12px solid transparent",
                  borderRight: "12px solid transparent",
                  borderBottom: "12px solid var(--color-land)",
                  pointerEvents: "none",
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};
