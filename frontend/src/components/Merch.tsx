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
  const tipIndex = isMobile ? 1 : 0;

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

  // Countdown component
  const Countdown: React.FC<{ targetIso: string }> = ({ targetIso }) => {
    const [now, setNow] = useState<number>(() => Date.now());
    useEffect(() => {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }, []);
    const target = new Date(targetIso).getTime();
    const diff = Math.max(0, target - now);
    if (!isFinite(diff) || diff <= 0) {
      return (
        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: isMobile ? "0.8rem" : undefined,
          }}
        >
          Ended
        </span>
      );
    }
    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad2 = (n: number) => String(Math.max(0, n)).padStart(2, "0");
    const dd = String(Math.max(0, days)).padStart(2, "0");
    const hh = pad2(hours);
    const mm = pad2(minutes);
    const ss = pad2(seconds);
    return (
      <span
        style={{
          color: "var(--color-primary)",
          fontWeight: 600,
          fontSize: isMobile ? "0.8rem" : undefined,
        }}
      >
        {`${dd}:${hh}:${mm}:${ss}`}
      </span>
    );
  };

  return (
    <div
      style={{
        padding: isMobile ? "var(--space-4)" : "var(--space-6)",
        overflowX: "hidden",
        overflowY: isMobile ? ("auto" as any) : ("hidden" as any),
        width: "100%",
        boxSizing: "border-box",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          alignItems: "stretch",
          flexDirection: isMobile ? "column" : "row",
          width: "100%",
          boxSizing: "border-box",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left: 3D viewer */}
        <div
          style={{
            width: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            flex: isMobile ? undefined : "1 1 60%",
            minHeight: 0,
            overflow: isMobile ? (undefined as any) : ("hidden" as any),
          }}
        >
          {isMobile ? (
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <ModelViewer
                  height="40vh"
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
                    justifyContent: "space-evenly",
                    gap: "var(--space-1)",
                    marginLeft: "var(--space-2)",
                    backgroundColor: "var(--color-bg)",
                    padding: "var(--space-2)",
                    borderRadius: "var(--radius-md)",
                    alignSelf: "stretch",
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
              <div
                style={{
                  flex: "1 1 auto",
                  minHeight: 0,
                  display: "flex",
                }}
              >
                <ModelViewer
                  height="100%"
                  isMobile={isMobile}
                  shirtTexture={shirtTexture}
                  animation={currentAnim}
                  onAnimationsLoaded={(names) => {
                    setAnimNames(names);
                    if (!currentAnim) setCurrentAnim(names[0]);
                  }}
                />
              </div>
              {/* Animation shape buttons – 3 on top, 4 on bottom */}
              <div
                style={{
                  marginTop: "var(--space-3)",
                  position: "relative",
                  width: "100%",
                  overflow: "hidden",
                  flex: "0 0 auto",
                  minHeight: animNames.length > 0 ? 140 : 64,
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
                {animNames.length > 0 && (
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
                )}
                {/* Container flexes to bottom; stripes background (absolute) already covers full height */}
              </div>
            </>
          )}
        </div>

        {/* Right: Products grid */}
        <div
          className={
            isMobile ? "merch-products-grid" : "merch-products-grid desktop"
          }
          style={{
            flex: isMobile ? "0 0 auto" : "0 0 40%",
            width: isMobile ? "100%" : undefined,
            display: isMobile ? "grid" : "flex",
            flexDirection: isMobile ? undefined : "column",
            gridAutoFlow: isMobile ? "column" : undefined,
            gridAutoColumns: isMobile ? "40vw" : undefined,
            overflowX: isMobile ? "auto" : undefined,
            WebkitOverflowScrolling: isMobile ? ("touch" as any) : undefined,
            overscrollBehaviorX: isMobile ? "contain" : undefined,
            gridTemplateColumns: isMobile ? undefined : undefined,
            gap: isMobile ? "var(--space-2)" : "var(--space-4)",
            maxHeight: isMobile ? undefined : "100%",
            height: isMobile ? "auto" : "100%",
            overflowY: isMobile ? "hidden" : "auto",
            minHeight: 0,
            boxSizing: "border-box",
            alignItems: isMobile ? "stretch" : undefined,
            scrollSnapType: isMobile ? ("x mandatory" as any) : undefined,
            cursor: isMobile ? "grab" : undefined,
            userSelect: isMobile ? ("none" as any) : undefined,
            touchAction: isMobile ? ("pan-x" as any) : undefined,
            scrollBehavior: isMobile ? ("smooth" as any) : undefined,
          }}
          ref={productsRef}
          onPointerDown={isMobile ? undefined : onPointerDown}
          onPointerMove={isMobile ? undefined : onPointerMove}
          onPointerUp={isMobile ? undefined : onPointerEnd}
          onPointerLeave={isMobile ? undefined : onPointerEnd}
        >
          {loading && <p>Loading…</p>}
          {!loading && products.length === 0 && <p>No products available.</p>}
          {products.map((p, idx) => {
            const isTipTarget = idx === tipIndex && products.length > tipIndex;
            const isExpired = p.autoDisableAt
              ? Date.now() >= new Date(p.autoDisableAt).getTime()
              : false;
            return (
              <Card
                key={p.id}
                clickable
                padding={isMobile ? "none" : "md"}
                style={{
                  background: "var(--color-bg-elevated)",
                  cursor: "pointer",
                  width: isMobile ? "100%" : undefined,
                  height: isMobile ? "auto" : undefined,
                  display: isMobile ? "flex" : undefined,
                  flex: isMobile ? undefined : "0 0 auto",
                  flexDirection: isMobile ? "column" : undefined,
                  position: "relative",
                  boxSizing: "border-box",
                  overflow: "hidden",
                  scrollSnapAlign: isMobile ? ("center" as any) : undefined,
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
                    height: isMobile ? "auto" : "auto",
                    objectFit: isMobile ? undefined : undefined,
                    borderRadius: "var(--radius-md)",
                    display: "block",
                    marginBottom: -14,
                  }}
                  data-tip-target={isTipTarget ? "merch-card" : undefined}
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
                    name={
                      expandedImageUrl === p.imageUrl ? "collapse" : "expand"
                    }
                    size={18}
                    color="var(--color-bg-elevated)"
                  />
                </button>
                <Stack
                  spacing="sm"
                  style={{
                    marginTop: "var(--space-3)",
                    minHeight: isMobile ? 0 : undefined,
                    overflow: "hidden",
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-2)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        color: "var(--color-text-secondary)",
                        fontSize: isMobile ? "0.8rem" : undefined,
                      }}
                    >
                      {"$" + p.price}
                    </p>
                    {p.autoDisableAt && (
                      <div
                        style={{ whiteSpace: "nowrap" }}
                        aria-label="Time remaining"
                        data-tip-target={isTipTarget ? "time-limit" : undefined}
                      >
                        <Countdown targetIso={p.autoDisableAt} />
                      </div>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    fullWidth
                    disabled={isExpired}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isExpired) return;
                      cart.addItem(p, 1);
                    }}
                  >
                    {isExpired ? "Unavailable" : "Add to Cart"}
                  </Button>
                </Stack>
              </Card>
            );
          })}
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
