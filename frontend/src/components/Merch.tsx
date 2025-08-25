import React, { useEffect, useRef, useState } from "react";
import { Card } from "./primitives/Card";
import { Button } from "./primitives/Button";
import { Stack } from "./primitives/Stack";
// 3D model removed for now – placeholder only
import { ModelViewer } from "./ModelViewer";
import { fetchMerch } from "../services/api";
import type { MerchItem } from "../services/api";
import { Icon } from "./primitives/Icon";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useCart } from "../hooks/useCart";

const useMerch = () => {
  const [products, setProducts] = useState<MerchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMerch = async () => {
      try {
        const all: MerchItem[] = await fetchMerch();
        setProducts(all.filter((m: MerchItem) => m.active));
      } catch (e) {
        console.error("Failed to fetch merch:", e);
      } finally {
        setLoading(false);
      }
    };
    loadMerch();
  }, []);

  return { products, loading };
};

export const Merch: React.FC = () => {
  const { products, loading } = useMerch();
  const cart = useCart();
  const [shirtTexture, setShirtTexture] = useState<string | undefined>(
    undefined
  );
  const [animNames, setAnimNames] = useState<string[]>([]);
  const [currentAnim, setCurrentAnim] = useState<string | undefined>(undefined);
  const isDesktop = useMediaQuery("(min-width: 1100px)");
  const isMobile = !isDesktop;
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  // Drag-to-scroll for mobile products list
  const productsRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const dragStateRef = useRef({ startX: 0, scrollLeft: 0 });
  const didDragRef = useRef(false);
  const momentumAnimRef = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const lastMoveRef = useRef<{ x: number; t: number } | null>(null);
  const DRAG_THRESHOLD_PX = 10;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile || !productsRef.current) return;
    // Cancel any ongoing inertia
    if (momentumAnimRef.current != null) {
      cancelAnimationFrame(momentumAnimRef.current);
      momentumAnimRef.current = null;
    }
    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    didDragRef.current = false;
    dragStateRef.current = {
      startX: e.clientX,
      scrollLeft: productsRef.current.scrollLeft,
    };
    velocityRef.current = 0;
    lastMoveRef.current = { x: e.clientX, t: performance.now() };
    // Do not set pointer capture yet; only after crossing threshold
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile || !isPointerDownRef.current || !productsRef.current) return;
    const now = performance.now();
    const dx = e.clientX - dragStateRef.current.startX;
    if (!isDraggingRef.current) {
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) {
        isDraggingRef.current = true;
        didDragRef.current = true;
        productsRef.current.setPointerCapture?.(e.pointerId);
        productsRef.current.style.cursor = "grabbing";
      } else {
        // Not dragging yet; ignore small movements to allow clicks
        return;
      }
    }
    productsRef.current.scrollLeft = dragStateRef.current.scrollLeft - dx;
    // Track velocity (px/ms)
    if (lastMoveRef.current) {
      const dt = Math.max(1, now - lastMoveRef.current.t);
      const vx = (e.clientX - lastMoveRef.current.x) / dt; // px per ms
      velocityRef.current = velocityRef.current * 0.8 + vx * 0.2;
    }
    lastMoveRef.current = { x: e.clientX, t: now };
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile || !productsRef.current) return;
    const wasDragging = isDraggingRef.current;
    isPointerDownRef.current = false;
    isDraggingRef.current = false;
    productsRef.current.releasePointerCapture?.(e.pointerId);
    productsRef.current.style.cursor = "grab";
    // Snap to the nearest card only if a drag actually occurred
    if (wasDragging) {
      const el = productsRef.current;
      const firstChild = el.firstElementChild as HTMLElement | null;
      const childWidth =
        firstChild?.getBoundingClientRect().width ?? el.clientWidth * 0.4;
      const computed = getComputedStyle(el);
      const gapPx = parseFloat(computed.columnGap || computed.gap || "0") || 0;
      const stride = childWidth + gapPx;
      if (stride > 0) {
        const maxIndex = Math.max(0, products.length - 1);
        const targetIndex = Math.max(
          0,
          Math.min(Math.round(el.scrollLeft / stride), maxIndex)
        );
        const targetLeft = targetIndex * stride;
        el.scrollTo({ left: targetLeft, behavior: "smooth" });
      }
    }
    // Reset drag-flag after click propagation completes
    setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  // Cleanup any running animation on unmount
  useEffect(() => {
    return () => {
      if (momentumAnimRef.current != null) {
        cancelAnimationFrame(momentumAnimRef.current);
      }
    };
  }, []);

  // Inject custom scrollbar styles for desktop products list
  useEffect(() => {
    if (typeof document === "undefined") return;
    const styleId = "_merch_scroll_styles";
    if (document.getElementById(styleId)) return;
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.innerHTML = `
      .merch-products-grid.desktop {
        scrollbar-color: var(--color-primary) transparent;
        scrollbar-width: thin;
      }
      .merch-products-grid.desktop::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .merch-products-grid.desktop::-webkit-scrollbar-track {
        background: transparent;
      }
      .merch-products-grid.desktop::-webkit-scrollbar-thumb {
        background-color: var(--color-primary);
        border-radius: 8px;
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  // Inject styles for animation icon buttons
  useEffect(() => {
    if (typeof document === "undefined") return;
    const styleId = "_merch_anim_hover_styles";
    if (document.getElementById(styleId)) return;
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.innerHTML = `
      /* Remove native square focus ring on the button */
      .anim-btn:focus, .anim-btn:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }
      /* Show circular ring on the icon for keyboard focus (not hover) */
      .anim-btn:focus-visible .anim-icon {
        outline: 2px solid var(--color-text-border);
        outline-offset: 2px;
        border-radius: 50%;
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  return (
    <div
      style={{
        padding: isMobile ? "var(--space-4)" : "var(--space-6)",
        overflowX: "hidden",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          alignItems: isMobile ? "stretch" : "flex-start",
          flexDirection: isMobile ? "column" : "row",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Left: 3D viewer */}
        <div style={{ width: "100%", boxSizing: "border-box" }}>
          {isMobile ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <ModelViewer
                  height="45vh"
                  isMobile={isMobile}
                  shirtTexture={shirtTexture}
                  animation={currentAnim}
                  onAnimationsLoaded={(names) => {
                    setAnimNames(names);
                    if (!currentAnim) setCurrentAnim(names[0]);
                  }}
                />
              </div>
              {animNames.length > 0 && (
                <div
                  data-tip-target="anim-icons"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-1)",
                    marginLeft: "var(--space-2)",
                    backgroundColor: "var(--color-bg)",
                    padding: "var(--space-2)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {animNames.map((n) => {
                    const icon = "anim-star" as const;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCurrentAnim(n)}
                        style={{
                          background: "transparent",
                          border: "none",
                          borderRadius: "var(--radius-md)",
                          padding: "4px",
                          cursor: "pointer",
                          width: 36,
                          height: 36,
                          outline: "none",
                          boxShadow: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        className="anim-btn"
                      >
                        <Icon
                          name={icon}
                          size={22}
                          color="var(--color-star-white)"
                          style={{
                            outline:
                              currentAnim === n
                                ? "2px solid var(--color-star-white)"
                                : undefined,
                            outlineOffset: 2,
                            borderRadius: "50%",
                          }}
                          className="anim-icon"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              <ModelViewer
                height="70vh"
                isMobile={isMobile}
                shirtTexture={shirtTexture}
                animation={currentAnim}
                onAnimationsLoaded={(names) => {
                  setAnimNames(names);
                  if (!currentAnim) setCurrentAnim(names[0]);
                }}
              />
              {/* Animation shape buttons – 3 on top, 4 on bottom */}
              {animNames.length > 0 && (
                <div
                  style={{
                    marginTop: "var(--space-3)",
                    position: "relative",
                    width: "100%",
                    overflow: "hidden",
                  }}
                >
                  {/* Stripes layer behind the union (stars) block and extending right */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "repeating-linear-gradient(to bottom, var(--color-primary) 0 12px, var(--color-star-white) 12px 24px)",
                      zIndex: 0,
                    }}
                  />
                  {/* Union (stars) block */}
                  <div
                    data-tip-target="anim-icons"
                    style={{
                      display: "inline-block",
                      backgroundColor: "var(--color-bg)",
                      padding: "var(--space-2)",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {[animNames.slice(0, 3), animNames.slice(3)].map(
                      (row, rowIdx) => (
                        <div
                          key={rowIdx}
                          style={{
                            display: "flex",
                            justifyContent: "left",
                            gap: "var(--space-2)",
                            marginTop: rowIdx === 0 ? 0 : "var(--space-2)",
                            marginLeft:
                              rowIdx === 0 ? "calc(16px + var(--space-2))" : 0,
                          }}
                        >
                          {row.map((n) => {
                            const icon = "anim-star" as const;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setCurrentAnim(n)}
                                style={{
                                  background: "transparent",
                                  borderRadius: "var(--radius-md)",
                                  padding: "4px",
                                  cursor: "pointer",
                                  width: 50,
                                  height: 50,
                                  outline: "none",
                                  boxShadow: "none",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                className="anim-btn"
                              >
                                <Icon
                                  name={icon}
                                  size={32}
                                  color="var(--color-star-white)"
                                  style={{
                                    outline:
                                      currentAnim === n
                                        ? "2px solid var(--color-text-border)"
                                        : undefined,
                                    outlineOffset: 2,
                                    borderRadius: "50%",
                                  }}
                                  className="anim-icon"
                                />
                              </button>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                  {/* Extend stripes below the union */}
                  <div style={{ height: 64 }} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Products grid */}
        <div
          className={
            isMobile ? "merch-products-grid" : "merch-products-grid desktop"
          }
          style={{
            flex: isMobile ? "initial" : "0 0 40%",
            width: isMobile ? "100%" : undefined,
            display: isMobile ? "grid" : "grid",
            gridAutoFlow: isMobile ? "column" : undefined,
            gridAutoColumns: isMobile ? "40vw" : undefined,
            overflowX: isMobile ? "auto" : undefined,
            WebkitOverflowScrolling: isMobile ? ("touch" as any) : undefined,
            overscrollBehaviorX: isMobile ? "contain" : undefined,
            gridTemplateColumns: !isMobile
              ? "repeat(auto-fill, minmax(140px, 1fr))"
              : undefined,
            gap: isMobile ? "var(--space-2)" : "var(--space-4)",
            maxHeight: isMobile ? undefined : "89vh",
            overflowY: isMobile ? "hidden" : "auto",
            boxSizing: "border-box",
            height: isMobile ? "40vh" : undefined,
            alignItems: isMobile ? "stretch" : undefined,
            scrollSnapType: isMobile ? ("x mandatory" as any) : undefined,
            cursor: isMobile ? "grab" : undefined,
            userSelect: isMobile ? ("none" as any) : undefined,
            touchAction: isMobile ? ("pan-y" as any) : undefined,
            scrollBehavior: isMobile ? ("smooth" as any) : undefined,
          }}
          ref={productsRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerLeave={onPointerEnd}
        >
          {loading && <p>Loading…</p>}
          {!loading && products.length === 0 && <p>No products available.</p>}
          {products.map((p) => (
            <Card
              key={p.id}
              clickable
              padding={isMobile ? "none" : "md"}
              style={{
                background: "var(--color-bg-elevated)",
                cursor: "pointer",
                width: isMobile ? "100%" : undefined,
                height: isMobile ? "100%" : undefined,
                display: isMobile ? "flex" : undefined,
                flexDirection: isMobile ? "column" : undefined,
                position: "relative",
                boxSizing: "border-box",
                overflow: "hidden",
                scrollSnapAlign: isMobile ? ("start" as any) : undefined,
                padding: "var(--space-2)",
              }}
              onClick={() => {
                if (didDragRef.current) return;
                console.log("Preview merch: ", p.name, p.shirtTexture);
                setShirtTexture(p.shirtTexture);
                if (p.defaultAnimation) setCurrentAnim(p.defaultAnimation);
              }}
            >
              <img
                src={p.imageUrl}
                alt={p.name}
                style={{
                  width: "100%",
                  height: isMobile ? "50%" : "auto",
                  objectFit: isMobile ? "cover" : undefined,
                  borderRadius: "var(--radius-md)",
                  display: "block",
                  marginBottom: -14,
                }}
                data-tip-target={
                  products[0]?.id === p.id ? "merch-card" : undefined
                }
              />
              {/* Expand/collapse button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (didDragRef.current) return; // treat as drag, not click
                  setExpandedImageUrl((prev) =>
                    prev === p.imageUrl ? null : p.imageUrl
                  );
                }}
                aria-label={
                  expandedImageUrl === p.imageUrl
                    ? "Collapse image"
                    : "Expand image"
                }
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  boxShadow: "none",
                  cursor: "pointer",
                  padding: 6,
                  zIndex: 1000,
                }}
              >
                <Icon
                  name={expandedImageUrl === p.imageUrl ? "collapse" : "expand"}
                  size={18}
                  color="var(--color-bg-elevated)"
                />
              </button>
              <Stack
                spacing="sm"
                style={{
                  marginTop: "var(--space-3)",
                  flex: isMobile ? 1 : undefined,
                  minHeight: isMobile ? 0 : undefined,
                  overflow: isMobile ? "hidden" : undefined,
                  boxSizing: "border-box",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    color: "var(--color-text)",
                    fontSize: isMobile ? "1rem" : undefined,
                    display: "-webkit-box",
                    WebkitLineClamp: "2" as any,
                    WebkitBoxOrient: "vertical" as any,
                    overflow: "hidden",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  {p.name}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "var(--color-text-secondary)",
                    fontSize: isMobile ? "0.8rem" : undefined,
                  }}
                  data-tip-target={
                    products[0]?.id === p.id ? "time-limit" : undefined
                  }
                >
                  {p.price}
                </p>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={(e) => {
                    e.stopPropagation();
                    cart.addItem(p, 1);
                  }}
                >
                  Add to Cart
                </Button>
              </Stack>
            </Card>
          ))}
        </div>
        {expandedImageUrl && (
          <div
            onClick={() => setExpandedImageUrl(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            }}
            role="dialog"
            aria-modal="true"
          >
            <img
              src={expandedImageUrl}
              alt="Preview"
              style={{
                maxWidth: "90vw",
                maxHeight: "85vh",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
