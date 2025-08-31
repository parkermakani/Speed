import React from "react";
import { Card } from "./primitives/Card";
import { ChromaticText } from "./ChromaticText";
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

      /* Scrollbar styling to match merch list */
      .city-posts-grid {
        scrollbar-color: var(--color-primary) transparent;
        scrollbar-width: thin;
      }
      .city-posts-grid::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .city-posts-grid::-webkit-scrollbar-track {
        background: transparent;
      }
      .city-posts-grid::-webkit-scrollbar-thumb {
        background-color: var(--color-primary);
        border-radius: 8px;
      }
    `;
    document.head.appendChild(styleEl);
  }

  const containerStyles: React.CSSProperties = {
    width: inDrawer ? "100%" : "min(80vw, 600px)",
    maxWidth: inDrawer ? "100%" : "min(80vw, 600px)",
    minWidth: inDrawer ? "100%" : "min(50vw, 420px)",
    height: undefined,
    maxHeight: inDrawer ? undefined : "75vh",
    padding: inDrawer
      ? "var(--space-3)"
      : "var(--space-3) var(--space-3) calc(var(--space-3) + 10px)",
    background: "var(--color-land)",
    border: inDrawer ? "none" : "3px solid var(--color-land-dark)",
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

  // Limit gallery to two rows tall, then scroll
  const gridMaxHeight: string | undefined = inDrawer
    ? undefined
    : "calc((((min(80vw, 600px)) - (var(--space-3) * 2)) / 3) * 2 + var(--space-2))";

  return (
    <div style={containerStyles}>
      {/* Posts gallery */}
      <div style={{ padding: "var(--space-2)", alignItems: "center", justifyContent: "center", }}>
        {!inDrawer && (
          <ChromaticText
            text={city.city}
            layers={["base"]}
            style={{
              margin: 0,
              fontSize: "1.5rem",
              zIndex: 1,
            }}
          />
        )}
      </div>
      <div
        className="city-posts-grid"
        style={{
          flex: inDrawer ? undefined : 1,
          minHeight: 0,
          overflowY: inDrawer ? "visible" : "auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-2)",
          paddingBottom: "var(--space-1)",
          maxHeight: gridMaxHeight,
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
            // Use proxied URL already provided by API for posts endpoint; city posts may not be proxied
            const src = imgUrl;
            const href = post.url || "#";
            const title = post.caption || "Social post";
            return (
              <Card key={i} padding="none" style={{ overflow: "hidden" }}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={title}
                  style={{
                    display: "block",
                    width: "100%",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {src ? (
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "1 / 1",
                        overflow: "hidden",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <img
                        src={src}
                        alt={title}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
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
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        borderRadius: "var(--radius-sm)",
                        padding: "0 var(--space-2)",
                      }}
                      title={title}
                    >
                      {title}
                    </div>
                  )}
                </a>
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
