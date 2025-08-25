import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TipStep } from "../types";
import { tipsConfig } from "../tips/tipsConfig";
import { SpotlightOverlay } from "./SpotlightOverlay";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface TipContextValue {
  start: () => void;
  close: () => void;
  next: () => void;
  isActive: boolean;
}

const TipContext = createContext<TipContextValue | null>(null);

export const useTips = () => {
  const ctx = useContext(TipContext);
  if (!ctx) throw new Error("useTips must be used within <TipProvider>");
  return ctx;
};

const STORAGE_SESSION_KEY = "tips_prompt_shown_session";

export const TipProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [steps] = useState<TipStep[]>(tipsConfig);
  const [index, setIndex] = useState<number>(-1);
  const [mounted, setMounted] = useState(false);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [nudgeExiting, setNudgeExiting] = useState(false);
  const [isExitingStep, setIsExitingStep] = useState(false);
  const nudgeTimerRef = useRef<number | null>(null);
  const nudgeHideTimerRef = useRef<number | null>(null);
  const nudgeHideEndTimerRef = useRef<number | null>(null);
  const [debug, setDebug] = useState<boolean>(() => {
    try {
      const fromLs = localStorage.getItem("tips_debug");
      const fromUrl = new URLSearchParams(window.location.search).get(
        "tipsDebug"
      );
      return fromLs === "1" || fromUrl === "1";
    } catch {
      return false;
    }
  });

  const isActive = index >= 0 && index < steps.length;
  const current = isActive ? steps[index] : null;
  const isMobile = useMediaQuery("(max-width: 767px)");

  type Placement = {
    offsetX: number;
    offsetY: number;
    rotationDeg?: number;
    anchor?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "center";
    scale?: number;
  };
  const [overrides, setOverrides] = useState<
    Record<string, { desktop?: Placement; mobile?: Placement }>
  >(() => {
    try {
      const raw = localStorage.getItem("tips_overrides");
      return raw
        ? (JSON.parse(raw) as Record<
            string,
            { desktop?: Placement; mobile?: Placement }
          >)
        : {};
    } catch {
      return {};
    }
  });

  const getEffectivePlacement = useCallback(
    (step: TipStep | null | undefined): Placement | undefined => {
      if (!step) return undefined;
      const ov = overrides[step.id];
      const base = isMobile ? step.placementMobile : step.placementDesktop;
      const over = isMobile ? ov?.mobile : ov?.desktop;
      return over ?? base ?? undefined;
    },
    [overrides, isMobile]
  );

  // Auto prompt once per session after 12s with a subtle nudge (Tip0) that auto-hides after 3s
  useEffect(() => {
    setMounted(true);
    // Inject animations once
    const animStyleId = "_tips_anim_styles";
    if (!document.getElementById(animStyleId)) {
      const s = document.createElement("style");
      s.id = animStyleId;
      s.textContent = `
        @keyframes tip-scale-in {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes tip-scale-out {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0; }
        }
        .tip-anim-in { animation: tip-scale-in 400ms cubic-bezier(.2,.8,.2,1) both; }
        .tip-anim-out { animation: tip-scale-out 180ms ease-in both; }
      `;
      document.head.appendChild(s);
    }
    const params = new URLSearchParams(window.location.search);
    const force = params.get("tipsForce");
    const stepId = params.get("tipsStep");
    const stepIndexParam = params.get("tipsIndex");
    if (force === "1") {
      if (stepId) {
        const idx = steps.findIndex((s) => s.id === stepId);
        if (idx >= 0) {
          if (debug)
            console.debug("[Tips] Force start at step id", stepId, "idx", idx);
          setIndex(idx);
          return;
        }
      }
      if (stepIndexParam) {
        const idxNum = Math.max(
          0,
          Math.min(steps.length - 1, parseInt(stepIndexParam, 10) || 0)
        );
        if (debug) console.debug("[Tips] Force start at index", idxNum);
        setIndex(idxNum);
        return;
      }
      if (debug) console.debug("[Tips] Force start at index 0");
      setIndex(0);
      return;
    }
    const t = window.setTimeout(() => {
      sessionStorage.setItem(STORAGE_SESSION_KEY, "1");
      setNudgeVisible(true);
      const hideTimer = window.setTimeout(() => {
        setNudgeExiting(true);
        const hideEndTimer = window.setTimeout(() => {
          setNudgeVisible(false);
          setNudgeExiting(false);
        }, 180) as unknown as number;
        nudgeHideEndTimerRef.current = hideEndTimer;
      }, 5000) as unknown as number;
      nudgeHideTimerRef.current = hideTimer;
    }, 12000) as unknown as number;
    nudgeTimerRef.current = t;
    return () => {
      if (nudgeTimerRef.current != null) {
        window.clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = null;
      }
      if (nudgeHideTimerRef.current != null) {
        window.clearTimeout(nudgeHideTimerRef.current);
        nudgeHideTimerRef.current = null;
      }
      if (nudgeHideEndTimerRef.current != null) {
        window.clearTimeout(nudgeHideEndTimerRef.current);
        nudgeHideEndTimerRef.current = null;
      }
    };
  }, [steps, debug]);

  const start = useCallback(() => {
    // Cancel any scheduled or visible nudge when user manually starts tips
    if (nudgeTimerRef.current != null) {
      window.clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
    if (nudgeHideTimerRef.current != null) {
      window.clearTimeout(nudgeHideTimerRef.current);
      nudgeHideTimerRef.current = null;
    }
    if (nudgeHideEndTimerRef.current != null) {
      window.clearTimeout(nudgeHideEndTimerRef.current);
      nudgeHideEndTimerRef.current = null;
    }
    setNudgeVisible(false);
    setNudgeExiting(false);
    const tipQuoteIdx = steps.findIndex((s) => s.id === "Tip-Quote");
    setIndex(tipQuoteIdx >= 0 ? tipQuoteIdx : 0);
  }, [steps]);

  const close = useCallback(() => {
    if (isExitingStep) return;
    setIsExitingStep(true);
    window.setTimeout(() => {
      setIndex(-1);
      setIsExitingStep(false);
    }, 180);
  }, [isExitingStep]);

  const next = useCallback(() => {
    if (isExitingStep) return;
    setIsExitingStep(true);
    window.setTimeout(() => {
      setIndex((i) => (i < steps.length - 1 ? i + 1 : -1));
      setIsExitingStep(false);
    }, 180);
  }, [steps.length, isExitingStep]);

  // Advance automatically when continueMode is clickTarget and target becomes unavailable/changed condition
  useEffect(() => {
    if (!current) return;
    if (current.continueMode === "waitCondition" && current.waitCondition) {
      const id = window.setInterval(() => {
        try {
          if (current.waitCondition!()) next();
        } catch {}
      }, 250);
      return () => window.clearInterval(id);
    }
  }, [current, next]);

  // Wait for current step target to exist before showing overlay (keeps polling so late-mounted targets work)
  const [targetReady, setTargetReady] = useState(false);
  useEffect(() => {
    setTargetReady(false);
    if (!current) return;
    const sel = typeof current.target === "string" ? current.target : "";
    const check = () => {
      if (!sel) return false;
      const el = document.querySelector(sel) as HTMLElement | null;
      return !!el && (el.isConnected ?? true);
    };
    const id = window.setInterval(() => {
      const ready = check();
      setTargetReady(ready);
      if (debug) {
        const el = sel
          ? (document.querySelector(sel) as HTMLElement | null)
          : null;
        if (el) {
          const r = el.getBoundingClientRect();
          console.debug("[Tips] Poll target", current?.id, sel, {
            exists: !!el,
            rect: {
              x: Math.round(r.left),
              y: Math.round(r.top),
              w: Math.round(r.width),
              h: Math.round(r.height),
            },
            ready,
          });
        } else {
          console.debug("[Tips] Poll target", current?.id, sel, {
            exists: false,
            ready,
          });
        }
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [current, debug]);

  // For Tip3 (Shop Tab), do not auto-open; we will open on user click only
  // This effect intentionally does nothing now to avoid automatic drawer opening
  useEffect(() => {
    if (!current) return;
    if (current.id === "Tip3") {
      if (debug)
        console.debug("[Tips] Tip3: no auto-open; waiting for user click");
    }
  }, [current, debug]);

  // Handle clickTarget: listen for clicks on target (only when targetReady)
  useEffect(() => {
    if (!current || current.continueMode !== "clickTarget" || !targetReady)
      return;
    const sel = typeof current.target === "string" ? current.target : undefined;
    const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
    if (!el) return;
    const handler = () => next();
    el.addEventListener("click", handler, { once: true });
    return () => el.removeEventListener("click", handler);
  }, [current, next, targetReady]);

  // Removed extra tap-anywhere listeners to avoid double-advancing

  const value = useMemo(
    () => ({ start, close, next, isActive }),
    [start, close, next, isActive]
  );

  // Toggle debug with key 'd'
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "d") {
        setDebug((d) => {
          const v = !d;
          try {
            localStorage.setItem("tips_debug", v ? "1" : "0");
          } catch {}
          return v;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A11y: close on Escape when active
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, close]);

  // Helper: anchored tip image with per-breakpoint placement
  const TipImageAnchor: React.FC<{
    imageUrl: string;
    targetSelector: string;
    placement?:
      | {
          offsetX: number;
          offsetY: number;
          rotationDeg?: number;
          anchor?:
            | "topLeft"
            | "topRight"
            | "bottomLeft"
            | "bottomRight"
            | "center";
          scale?: number;
        }
      | null
      | undefined;
    onClick?: () => void;
    children?: React.ReactNode;
    debug?: boolean;
    stepId?: string;
    passThrough?: boolean;
    isLast?: boolean;
    exiting?: boolean;
  }> = ({
    imageUrl,
    targetSelector,
    placement,
    onClick,
    children,
    debug,
    stepId,
    passThrough = false,
    isLast = false,
    exiting = false,
  }) => {
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [dragging, setDragging] = useState(false);
    const startRef = useRef<{ x: number; y: number } | null>(null);
    const deltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const [, force] = useState(0);
    useEffect(() => {
      const el = document.querySelector(targetSelector) as HTMLElement | null;
      const update = () => setRect(el ? el.getBoundingClientRect() : null);
      update();
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
      const id = window.setInterval(update, 300);
      return () => {
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
        window.clearInterval(id);
      };
    }, [targetSelector]);

    if (!rect) return null;
    const p = placement ?? {
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      anchor: "bottomRight",
    };
    let baseX = rect.left;
    let baseY = rect.top;
    switch (p.anchor) {
      case "topRight":
        baseX = rect.right;
        baseY = rect.top;
        break;
      case "bottomLeft":
        baseX = rect.left;
        baseY = rect.bottom;
        break;
      case "bottomRight":
        baseX = rect.right;
        baseY = rect.bottom;
        break;
      case "center":
        baseX = rect.left + rect.width / 2;
        baseY = rect.top + rect.height / 2;
        break;
      case "topLeft":
      default:
        baseX = rect.left;
        baseY = rect.top;
    }

    const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
      if (!debug) return;
      const target = e.target as HTMLElement;
      const tagName = target.tagName;
      if (
        e.button !== 0 ||
        tagName === "INPUT" ||
        tagName === "BUTTON" ||
        tagName === "LABEL" ||
        tagName === "SELECT" ||
        tagName === "TEXTAREA" ||
        !!target.closest(".tips-debug-panel")
      ) {
        return;
      }
      setDragging(true);
      startRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      e.stopPropagation();
      const onMove = (ev: MouseEvent) => {
        if (!startRef.current) return;
        deltaRef.current = {
          x: ev.clientX - startRef.current.x,
          y: ev.clientY - startRef.current.y,
        };
        force((n) => n + 1);
      };
      const onUp = () => {
        setDragging(false);
        startRef.current = null;
        if (stepId) {
          const base = placement ?? { offsetX: 0, offsetY: 0 };
          const nextPlacement = {
            offsetX: (base.offsetX || 0) + deltaRef.current.x,
            offsetY: (base.offsetY || 0) + deltaRef.current.y,
            rotationDeg: base.rotationDeg,
            anchor: base.anchor,
          } as any;
          setOverrides((prev) => {
            const next = {
              ...prev,
              [stepId]: {
                ...(prev[stepId] || {}),
                [isMobile ? "mobile" : "desktop"]: nextPlacement,
              },
            };
            try {
              localStorage.setItem("tips_overrides", JSON.stringify(next));
            } catch {}
            return next;
          });
          deltaRef.current = { x: 0, y: 0 };
        }
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    const x = baseX + (p.offsetX || 0) + (debug ? deltaRef.current.x : 0);
    const y = baseY + (p.offsetY || 0) + (debug ? deltaRef.current.y : 0);

    return (
      <div
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          if (debug && dragging) {
            e.stopPropagation();
            return;
          }
          onClick?.();
        }}
        style={{
          position: "fixed",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) rotate(${p.rotationDeg || 0}deg)`,
          pointerEvents: debug ? "auto" : passThrough ? "none" : "auto",
        }}
      >
        <div
          className={exiting ? "tip-anim-out" : "tip-anim-in"}
          style={{ transformOrigin: "center center" }}
        >
          <img
            src={imageUrl}
            alt="Tip"
            style={{
              width: (() => {
                const s = (placement as any)?.scale;
                const scaleNum = typeof s === "number" && isFinite(s) ? s : 1;
                return 260 * scaleNum;
              })(),
              height: "auto",
              display: "block",
              filter:
                "drop-shadow(0 6px 16px rgba(0,0,0,0.5)) drop-shadow(0 18px 48px rgba(0,0,0,0.45)) drop-shadow(0 40px 120px rgba(0,0,0,0.25))",
            }}
          />
          {children}
        </div>
        {debug && (
          <>
            <div
              style={{
                position: "absolute",
                left: 14,
                top: 14,
                background: "rgba(0,0,0,0.85)",
                color: "white",
                padding: "6px 8px",
                borderRadius: 6,
                fontSize: 12,
                zIndex: 7000,
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              Drag image • x:{" "}
              {Math.round((p.offsetX || 0) + deltaRef.current.x)}, y:{" "}
              {Math.round((p.offsetY || 0) + deltaRef.current.y)}
            </div>
            <div
              style={{
                position: "fixed",
                left: 12,
                bottom: 12,
                display: "flex",
                gap: 8,
                zIndex: 4000,
                alignItems: "center",
                background: "rgba(0,0,0,0.5)",
                padding: "6px 8px",
                borderRadius: 8,
              }}
              className="tips-debug-panel"
            >
              <label style={{ color: "white", fontSize: 12 }}>Scale</label>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={(() => {
                  const s = (placement as any)?.scale;
                  return typeof s === "number" && isFinite(s) ? s : 1;
                })()}
                onChange={(e) => {
                  const newScale = parseFloat(e.target.value);
                  setOverrides((prev) => {
                    if (!stepId) return prev;
                    const base = placement ?? { offsetX: 0, offsetY: 0 };
                    const nextPlacement = {
                      // Keep offsets stable when scaling via slider
                      offsetX: base.offsetX || 0,
                      offsetY: base.offsetY || 0,
                      rotationDeg: base.rotationDeg,
                      anchor: base.anchor,
                      scale: newScale,
                    } as any;
                    const next = {
                      ...prev,
                      [stepId]: {
                        ...(prev[stepId] || {}),
                        [isMobile ? "mobile" : "desktop"]: nextPlacement,
                      },
                    };
                    try {
                      localStorage.setItem(
                        "tips_overrides",
                        JSON.stringify(next)
                      );
                    } catch {}
                    return next;
                  });
                }}
                style={{ cursor: "pointer" }}
              />
              {isLast && (
                <button
                  style={{
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-land-dark)",
                    borderRadius: 6,
                    padding: "6px 8px",
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const merged = tipsConfig.map((s) => {
                      const ov = overrides[s.id];
                      if (!ov) return s;
                      return {
                        ...s,
                        placementDesktop: ov.desktop ?? s.placementDesktop,
                        placementMobile: ov.mobile ?? s.placementMobile,
                      } as any;
                    });
                    // eslint-disable-next-line no-console
                    console.log(
                      "[Tips] Full merged tipsConfig:\n",
                      JSON.stringify(merged, null, 2)
                    );
                  }}
                >
                  Print config
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <TipContext.Provider value={value}>
      {children}
      {/* Subtle nudge: show Tip0 without dimming, pass-through, auto-hides */}
      {mounted && nudgeVisible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 4000,
          }}
        >
          {(() => {
            const tip0 = steps.find((s) => s.id === "Tip0");
            if (!tip0) return null;
            return (
              <TipImageAnchor
                imageUrl={tip0.imageUrl}
                targetSelector={
                  typeof tip0.target === "string" ? tip0.target : ""
                }
                placement={getEffectivePlacement(tip0)}
                debug={debug}
                passThrough
                stepId={tip0.id}
                exiting={nudgeExiting}
              />
            );
          })()}
        </div>
      )}
      {mounted && current && targetReady && (
        <SpotlightOverlay
          target={
            typeof current.target === "string"
              ? current.target
              : current.target?.current ?? null
          }
          onBackdropClick={() => {
            if (current.continueMode === "tapAnywhere") next();
          }}
          captureAllClicks={current.continueMode === "tapAnywhere"}
          zIndex={5000}
        >
          <TipImageAnchor
            imageUrl={current.imageUrl}
            targetSelector={
              typeof current.target === "string" ? current.target : ""
            }
            placement={getEffectivePlacement(current)}
            stepId={current.id}
            debug={debug}
            passThrough={
              current.continueMode === "clickTarget" ||
              current.continueMode === "waitCondition"
            }
            isLast={index === steps.length - 1}
            exiting={isExitingStep}
            onClick={() => {
              if (current.continueMode === "tapAnywhere") next();
            }}
          ></TipImageAnchor>
        </SpotlightOverlay>
      )}
    </TipContext.Provider>
  );
};
