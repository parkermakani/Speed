import React from "react";
import { Card } from "./primitives/Card";
import { ChromaticText } from "./ChromaticText";
import { Stack } from "./primitives/Stack";
import Eagle from "../assets/Graphics/eagle.png";
import type { JourneyCity } from "../types";
import { fetchCities, fetchCityPosts, type SocialPost } from "../services/api";
import { useEffect, useRef, useState } from "react";

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

  // Scroll shadow indicators for the posts grid
  const gridRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollShadows = () => {
    const el = gridRef.current;
    if (!el) return;
    const up = el.scrollTop > 0;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setCanScrollUp(up);
    setCanScrollDown(down);
  };

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

  // Attach scroll listener and recalc on mount/resize/content changes
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const onScroll = () => updateScrollShadows();
    el.addEventListener("scroll", onScroll, { passive: true });
    updateScrollShadows();

    const ro = new ResizeObserver(() => updateScrollShadows());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [gridRef.current]);

  useEffect(() => {
    // Recompute shadows when content changes
    updateScrollShadows();
  }, [loading, posts]);

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

  // Inject eagle float keyframes once
  if (
    typeof document !== "undefined" &&
    !document.getElementById("_eagle_float_styles")
  ) {
    const styleEl = document.createElement("style");
    styleEl.id = "_eagle_float_styles";
    styleEl.innerHTML = `
      @keyframes eagle-float { from { transform: translateY(0); } to { transform: translateY(-16px); } }
      @keyframes eagle-float-flip { from { transform: scaleX(-1) translateY(0); } to { transform: scaleX(-1) translateY(-16px); } }
      @keyframes eagle-shadow { from { opacity: 0.6; transform: translate(-50%, 3px); } to { opacity: 0.15; transform: translate(-50%, 0px); } }
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
      ? 0
      : "var(--space-3) var(--space-3) calc(var(--space-3) + 10px)",
    background: "var(--color-border)",
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
    : "calc((((min(80vw, 600px)) - (var(--space-3) * 2)) / 3) * (8 / 3) + var(--space-2))";

  return (
    <div style={containerStyles}>
      {/* Posts gallery */}
      <div
        style={{
          display: "flex",
          height: inDrawer ? 0 : "10px",
          flexDirection: "row",
          padding: inDrawer ? 0 : "var(--space-4)",
          alignSelf: "center",
          alignItems: "center",
          justifyContent: "center",
          gap: "-84px",
        }}
      >
        {!inDrawer && (
          <>
            <Stack>
              <div
                style={{
                  position: "relative",
                  width: "auto",
                  height: 64,
                  marginBottom: 32,
                }}
              >
                <img
                  src={Eagle}
                  style={{
                    height: "64px",
                    width: "auto",
                    animation:
                      "eagle-float-flip 1.8s ease-in-out infinite alternate",
                    display: "block",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: -2,
                    width: 56,
                    height: 12,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.0) 70%)",
                    pointerEvents: "none",
                    animation:
                      "eagle-shadow 1.8s ease-in-out infinite alternate",
                  }}
                />
              </div>
            </Stack>
            <ChromaticText
              text={city.city}
              layers={["base", "outline"]}
              style={{
                margin: 0,
                fontSize: "1.5rem",
                zIndex: 1,
              }}
            />
            <Stack>
              <div
                style={{
                  position: "relative",
                  width: "auto",
                  height: 64,
                  marginBottom: 32,
                }}
              >
                <img
                  src={Eagle}
                  style={{
                    height: "64px",
                    width: "auto",
                    animation:
                      "eagle-float 1.8s ease-in-out infinite alternate",
                    display: "block",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: -2,
                    width: 56,
                    height: 12,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.0) 70%)",
                    pointerEvents: "none",
                    animation:
                      "eagle-shadow 1.8s ease-in-out infinite alternate",
                  }}
                />
              </div>
            </Stack>
          </>
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
          backgroundColor: "var(--color-border)",
          gap: 1,
          paddingBottom: 0,
          maxHeight: gridMaxHeight,
          position: "relative",
        }}
        ref={gridRef}
      >
        {/* Top scroll shadow */}
        {!inDrawer && canScrollUp && (
          <div
            style={{
              position: "sticky",
              top: 0,
              left: 0,
              right: 0,
              height: 12,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0))",
              zIndex: 1,
              gridColumn: "1 / -1",
              pointerEvents: "none",
            }}
          />
        )}
        {/* Bottom scroll shadow */}
        {!inDrawer && canScrollDown && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              left: 0,
              right: 0,
              height: 12,
              background:
                "linear-gradient(to top, rgba(0, 0, 0, 0.47), rgba(0,0,0,0))",
              zIndex: 1,
              gridColumn: "1 / -1",
              pointerEvents: "none",
              marginTop: -12,
            }}
          />
        )}
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              padding="none"
              style={{ overflow: "hidden", background: "var(--color-land)" }}
              clickable
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "3 / 4",
                    background: "var(--color-border)",
                    animation: "pulse 1.5s infinite",
                    borderRadius: 0,
                  }}
                />
              </div>
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
            const title = post.text || "Social post";
            return (
              <Card
                key={i}
                padding="none"
                style={{
                  overflow: "hidden",
                  background: "var(--color-land)",
                  borderRadius: 0,
                }}
                clickable
              >
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={title}
                  style={{
                    display: "flex",
                    flexDirection: "column",
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
                        aspectRatio: "3 / 4",
                        overflow: "hidden",
                        borderRadius: 0,
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
                        aspectRatio: "3 / 4",
                        background: "var(--color-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--color-text-secondary)",
                        fontSize: "0.8rem",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        borderRadius: inDrawer ? 0 : "var(--radius-sm)",
                        padding: "0 var(--space-2)",
                      }}
                      title={title}
                    ></div>
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
