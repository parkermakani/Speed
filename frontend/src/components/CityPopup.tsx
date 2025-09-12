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
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(30);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  // Scroll shadow indicators for the posts grid
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollShadows = (sourceEl?: HTMLElement | null) => {
    const el = sourceEl || gridRef.current;
    if (!el) return;
    const up = el.scrollTop > 0;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setCanScrollUp(up);
    setCanScrollDown(down);
  };

  const findScrollableParent = (el: HTMLElement | null): HTMLElement | null => {
    let node: HTMLElement | null = el?.parentElement || null;
    while (node) {
      const style = window.getComputedStyle(node);
      const oy = style.overflowY;
      if (oy === "auto" || oy === "scroll") return node;
      node = node.parentElement;
    }
    return null;
  };

  const maybeLoadMore = (sourceEl?: HTMLElement | null) => {
    const el = sourceEl || gridRef.current;
    if (!el) return;
    if (!posts || posts.length === 0) return;
    if (visibleCount >= posts.length) return;
    const threshold = 200;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      setVisibleCount((c) => Math.min(c + 30, posts.length));
    }
  };

  useEffect(() => {
    const abort = new AbortController();
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadPosts() {
      try {
        const all = await fetchCities();
        const match = all.find(
          (c) => c.city === city.city && c.state === city.state
        );
        if (!match) {
          throw new Error("City not found");
        }
        const data = await fetchCityPosts(match.id);
        if (isMounted) {
          setPosts(data);
          setVisibleCount(Math.min(30, data.length || 0));
        }
      } catch (e: any) {
        if (abort.signal.aborted) return;
        if (isMounted) {
          setError(e?.message || "Failed to load posts");
          setPosts([]);
        }
      } finally {
        if (!abort.signal.aborted && isMounted) setLoading(false);
      }
    }

    loadPosts();

    return () => {
      isMounted = false;
      abort.abort();
    };
  }, [city.city, city.state]);

  // Attach scroll listener and recalc on mount/resize/content changes
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const scrollEl = inDrawer ? findScrollableParent(el) || el : el;

    const onScroll = () => {
      updateScrollShadows(scrollEl);
      maybeLoadMore(scrollEl);
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    updateScrollShadows(scrollEl);
    // If already near-bottom on mount, load more immediately
    maybeLoadMore(scrollEl);

    const ro = new ResizeObserver(() => updateScrollShadows());
    ro.observe(el);

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [inDrawer]);

  useEffect(() => {
    // Recompute shadows when content changes
    const base = gridRef.current;
    const scrollEl = inDrawer ? findScrollableParent(base!) || base : base;
    updateScrollShadows(scrollEl || undefined);
  }, [loading, posts, inDrawer]);

  // Reset visible count on posts change
  useEffect(() => {
    if (posts) setVisibleCount(Math.min(30, posts.length));
  }, [posts]);

  // IntersectionObserver sentinel to load more when near bottom
  useEffect(() => {
    const base = gridRef.current;
    const sentinel = sentinelRef.current;
    if (!base || !sentinel) return;
    const rootEl = inDrawer ? findScrollableParent(base) || base : base;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisibleCount((c) => Math.min(posts?.length || 0, c + 30));
          }
        }
      },
      { root: rootEl, rootMargin: "200px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => {
      try {
        observer.unobserve(sentinel);
      } catch {}
      try {
        observer.disconnect();
      } catch {}
    };
  }, [inDrawer, posts]);

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
    background: inDrawer ? "var(--color-border)" : "var(--color-land)",
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

  const renderHashtagText = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /(#[A-Za-z0-9_]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const tag = match[1];
      parts.push(
        <span
          key={`${match.index}-${tag}`}
          style={{ color: "var(--color-liberty-blue)" }}
        >
          {tag}
        </span>
      );
      lastIndex = match.index + tag.length;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return <>{parts}</>;
  };

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
          backgroundColor: inDrawer
            ? "var(--color-border)"
            : "var(--color-land)",
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
        {loading && (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-3)",
              color: "var(--color-text-secondary)",
            }}
          >
            Loading posts…
          </div>
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
          !error &&
          posts &&
          posts.length > 0 &&
          posts.slice(0, visibleCount).map((post, i) => {
            const imgUrl = post.mediaUrl || post.imageUrl;
            // Use proxied URL already provided by API for posts endpoint; city posts may not be proxied
            const src = imgUrl;
            const href = post.url || "#";
            const title = post.text || "Social post";
            const isTwitter =
              (post.platform || "").toLowerCase() === "twitter" ||
              (post.url || "").includes("twitter.com") ||
              (post.url || "").includes("x.com");
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
                  {src && !imgErrors[i] ? (
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
                        onError={() =>
                          setImgErrors((m) => ({ ...m, [i]: true }))
                        }
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  ) : src && imgErrors[i] ? (
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "3 / 4",
                        background: "var(--color-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--color-text-secondary)",
                        fontSize: "0.5rem",
                        textAlign: "center",
                        padding: "0 var(--space-2)",
                        borderRadius: 0,
                      }}
                      title={title}
                    >
                      Image expired, click to view
                    </div>
                  ) : isTwitter ? (
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "3 / 4",
                        background: "#fff",
                        color: "#000",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        justifyContent: "flex-start",
                        padding: "12px",
                        overflow: "auto",
                        boxSizing: "border-box",
                        borderRadius: 0,
                        textAlign: "left",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.3,
                        fontSize: "clamp(12px, 1.8vw, 16px)",
                      }}
                      title={title}
                    >
                      {/* Username/avatar removed here; shown only in expanded row */}
                      <div>
                        {renderHashtagText(
                          post.text || post.caption || "Tweet"
                        )}
                      </div>
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

        {/* Infinite-scroll sentinel and fallback Load More */}
        {!loading && !error && posts && visibleCount < posts.length && (
          <>
            <div
              ref={sentinelRef}
              style={{ gridColumn: "1 / -1", height: 1 }}
            />
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "center",
                padding: "var(--space-2)",
              }}
            >
              <button
                onClick={() =>
                  setVisibleCount((c) => Math.min(posts?.length || 0, c + 30))
                }
                style={{
                  appearance: "none",
                  background: "var(--color-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                Load more
              </button>
            </div>
          </>
        )}

        {!loading && !error && posts && posts.length === 0 && (
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

        {!loading && error && (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "var(--space-3)",
              color: "var(--color-text-secondary)",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: 4 }}>Failed to load posts.</div>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                setPosts(null);
                // trigger effect by toggling a tiny state or relying on deps; we can reuse city deps by force-setting
                // no-op because deps are city props; just re-run logic locally
                // Call same loader
                // We can't easily call the useEffect function; let loading indicator show and user can close/reopen popup or change city to refetch.
                // Better approach: simple inline refetch:
                (async () => {
                  try {
                    const all = await fetchCities();
                    const match = all.find(
                      (c) => c.city === city.city && c.state === city.state
                    );
                    if (!match) throw new Error("City not found");
                    const data = await fetchCityPosts(match.id);
                    setPosts(data);
                    setVisibleCount(Math.min(30, data.length || 0));
                    setError(null);
                  } catch (e: any) {
                    setError(e?.message || "Failed to load posts");
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
              style={{
                appearance: "none",
                background: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
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
