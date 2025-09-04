import { useLayoutEffect, useRef, useState, useEffect, useMemo } from "react";
import type React from "react";
import type { SocialPost } from "../services/api";
import AnimatedMotorcycle from "./AnimatedMotorcycle";

interface SleepExpandRowProps {
  post: SocialPost | null;
  pointerLeftPx: number;
  anchorIndex: number;
  state: "enter" | "leave";
  transitionMs?: number;
}

function cleanCaption(raw?: string): string {
  if (!raw) return "";
  let input = raw;
  // Try to extract TikTok caption from <blockquote class="tiktok-embed"><section>...</section></blockquote>
  try {
    const tiktokMatch = input.match(
      /<blockquote[^>]*class=["'][^"']*tiktok-embed[^"']*["'][\s\S]*?<section[^>]*>([\s\S]*?)<\/section>[\s\S]*?<\/blockquote>/i
    );
    if (tiktokMatch && tiktokMatch[1]) {
      const sectionHtml = tiktokMatch[1];
      const sectionText = sectionHtml.replace(/<[^>]+>/g, " ");
      const entities: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
        "&nbsp;": " ",
      };
      const decoded = sectionText.replace(
        /&(amp|lt|gt|quot|#39|nbsp);/gi,
        (m) => entities[m.toLowerCase()] || " "
      );
      const collapsed = decoded.replace(/\s+/g, " ").trim();
      if (collapsed) return collapsed;
    }
  } catch {}

  // Fallback: strip embeds and tags, decode entities
  let out = input;
  out = out.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, " ");
  out = out.replace(/<[^>]+>/g, " ");
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };
  out = out.replace(
    /&(amp|lt|gt|quot|#39|nbsp);/gi,
    (m) => entities[m.toLowerCase()] || " "
  );
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const lower = url.split("?")[0].toLowerCase();
    return /\.(mp4|webm|mov|m4v)$/.test(lower);
  } catch {
    return false;
  }
}

function isTwitterPost(url?: string, platform?: string): boolean {
  const p = (platform || "").toLowerCase();
  const u = url || "";
  return p === "twitter" || u.includes("twitter.com") || u.includes("x.com");
}

export default function SleepExpandRow({
  post,
  pointerLeftPx,
  anchorIndex,
  state,
  transitionMs = 800,
}: SleepExpandRowProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [localLeft, setLocalLeft] = useState<number>(pointerLeftPx);
  const rightColRef = useRef<HTMLDivElement | null>(null);
  const whitePanelRef = useRef<HTMLDivElement | null>(null);
  const [showMotor, setShowMotor] = useState<boolean>(false);
  const [motorHeight, setMotorHeight] = useState<number>(0);
  const motorConfig = useMemo(() => {
    // Defaults
    let variant: "bounce" | "l2r_exit" | "r2l_exit" = "bounce";
    let durationMs = 5000;
    let delayMs = 0;
    let iteration = "infinite" as string;
    if (motorHeight > 0) {
      delayMs = Math.floor(Math.random() * 6000);
      durationMs = 4000 + Math.floor(Math.random() * 5000);
      const r = Math.random();
      if (r < 0.45) {
        variant = "bounce";
        iteration = "infinite";
      } else if (r < 0.725) {
        variant = "l2r_exit";
        iteration = "1";
      } else {
        variant = "r2l_exit";
        iteration = "1";
      }
    }
    return { variant, durationMs, delayMs, iteration };
  }, [motorHeight]);
  const [panDown] = useState<boolean>(Math.random() < 0.5);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer) return;
    // Compute pointer left relative to inner container based on grid
    if (inner) {
      const grid = inner.closest(".sleep-grid") as HTMLElement | null;
      if (grid) {
        const gridRect = grid.getBoundingClientRect();
        const innerRect = inner.getBoundingClientRect();
        const leftWithin = pointerLeftPx - (innerRect.left - gridRect.left);
        setLocalLeft(leftWithin);
      } else {
        setLocalLeft(pointerLeftPx);
      }
    }
    const current = outer;
    const contentHeight = inner?.scrollHeight ?? 0;
    if (state === "enter") {
      current.style.height = "0px";
      // Force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      current.offsetHeight;
      current.style.height = `${contentHeight}px`;
      current.style.opacity = "1";
    } else {
      const startHeight = contentHeight || current.scrollHeight;
      current.style.height = `${startHeight}px`;
      // Force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      current.offsetHeight;
      current.style.height = "0px";
      current.style.opacity = "0";
    }
  }, [state, post?.id, post?.url, post?.caption]);

  // Recompute pointer position based on the actual anchor tile element
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      setLocalLeft(pointerLeftPx);
      return;
    }
    const grid = inner.closest(".sleep-grid") as HTMLElement | null;
    const anchorEl = grid?.querySelector(
      `[data-sleep-tile-index="${anchorIndex}"]`
    ) as HTMLElement | null;
    if (anchorEl) {
      const innerRect = inner.getBoundingClientRect();
      const tileRect = anchorEl.getBoundingClientRect();
      const leftWithin = tileRect.left - innerRect.left + tileRect.width / 2;
      setLocalLeft(leftWithin);
    } else {
      setLocalLeft(pointerLeftPx);
    }
  }, [anchorIndex, pointerLeftPx]);

  // Adjust on resize to keep pointer aligned during layout changes
  useLayoutEffect(() => {
    const onResize = () => {
      const inner = innerRef.current;
      if (!inner) return;
      const grid = inner.closest(".sleep-grid") as HTMLElement | null;
      const anchorEl = grid?.querySelector(
        `[data-sleep-tile-index="${anchorIndex}"]`
      ) as HTMLElement | null;
      if (anchorEl) {
        const innerRect = inner.getBoundingClientRect();
        const tileRect = anchorEl.getBoundingClientRect();
        const leftWithin = tileRect.left - innerRect.left + tileRect.width / 2;
        setLocalLeft(leftWithin);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [anchorIndex]);

  const containerStyle: React.CSSProperties = {
    gridColumn: "1 / -1",
    overflow: "visible",
    height: 0,
    opacity: state === "enter" ? 1 : 0,
    transition: `height ${transitionMs}ms ease, opacity ${Math.max(
      1,
      transitionMs - 100
    )}ms ease`,
  };

  const innerStyle: React.CSSProperties = {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "2fr 3fr",
    gap: "var(--space-4)",
    padding: "var(--space-4)",
    background: "var(--color-primary)",
    alignItems: "stretch",
  };

  const pointerStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: localLeft,
    width: 12,
    height: 12,
    transform: "translate(-50%, -50%) rotate(45deg)",
    background: "var(--color-primary)",
    borderRadius: 2,
  };

  const mediaWrapStyle: React.CSSProperties = {
    width: "100%",
    aspectRatio: "16 / 9",
    position: "relative",
    overflow: "hidden",
    borderRadius: "var(--radius-md)",
  };

  const mediaImgStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
  const mediaVideoStyle: React.CSSProperties = mediaImgStyle;

  const titleStyle: React.CSSProperties = {
    color: "var(--color-text-inverse)",
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
  };

  const captionStyle: React.CSSProperties = {
    color: "var(--color-text-inverse)",
    fontSize: 24,
    fontWeight: "bold",
    margin: 0,
  };

  const safeCaption = cleanCaption(post?.caption);

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

  const bikeRunnerStyle: React.CSSProperties & {
    [key: string]: string | number | undefined;
  } = {
    position: "absolute",
    top: 0,
    left:
      motorConfig.variant === "bounce"
        ? "var(--bike-margin)"
        : motorConfig.variant === "l2r_exit"
        ? "calc(-1 * var(--bike-size))"
        : "calc(100% + var(--bike-margin))",
    width: motorHeight,
    height: motorHeight,
    willChange: "left, transform",
    animationName:
      motorConfig.variant === "bounce"
        ? "sleep-motor-run-x-margin"
        : motorConfig.variant === "l2r_exit"
        ? "sleep-motor-left-to-right-exit"
        : "sleep-motor-right-to-left-exit",
    animationDuration: `${motorConfig.durationMs}ms`,
    animationTimingFunction: "ease-in-out",
    animationDelay: `${motorConfig.delayMs}ms`,
    animationIterationCount: motorConfig.iteration,
    animationFillMode: motorConfig.variant === "bounce" ? "none" : "forwards",
    transform: motorConfig.variant === "r2l_exit" ? "scaleX(-1)" : "scaleX(1)",
    "--bike-size": `${motorHeight}px`,
    "--bike-margin": "10px",
  };

  // Inject keyframes for motorcycle run once (with margins to avoid clipping)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "_sleep_expand_motor_styles_v5";
    if (!document.getElementById(id)) {
      const styleEl = document.createElement("style");
      styleEl.id = id;
      styleEl.innerHTML = `
        @keyframes sleep-motor-run-x-margin {
          0% { left: var(--bike-margin); transform: scaleX(1); }
          49.999% { left: calc(100% - var(--bike-size) - var(--bike-margin)); transform: scaleX(1); }
          50% { left: calc(100% - var(--bike-size) - var(--bike-margin)); transform: scaleX(-1); }
          100% { left: var(--bike-margin); transform: scaleX(-1); }
        }
        @keyframes sleep-motor-left-to-right-exit {
          0% { left: calc(-1 * var(--bike-size)); transform: scaleX(1); }
          100% { left: calc(100% + var(--bike-margin)); transform: scaleX(1); }
        }
        @keyframes sleep-motor-right-to-left-exit {
          0% { left: calc(100% + var(--bike-margin)); transform: scaleX(-1); }
          100% { left: calc(-1 * var(--bike-size)); transform: scaleX(-1); }
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Inject keyframes for slow vertical image pan
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "_sleep_expand_pan_styles";
    if (!document.getElementById(id)) {
      const styleEl = document.createElement("style");
      styleEl.id = id;
      styleEl.innerHTML = `
        @keyframes sleep-pan-down { from { object-position: 50% 0%; } to { object-position: 50% 100%; } }
        @keyframes sleep-pan-up { from { object-position: 50% 100%; } to { object-position: 50% 0%; } }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Determine if there is enough leftover vertical space to show the motor row
  useLayoutEffect(() => {
    const measure = () => {
      const rightCol = rightColRef.current;
      const white = whitePanelRef.current;
      if (!rightCol || !white) return setShowMotor(false);
      const available = Math.max(0, rightCol.clientHeight - white.scrollHeight);
      setMotorHeight(available);
      setShowMotor(available >= 48); // show when enough space
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [safeCaption, post?.avatarUrl, post?.username]);

  // No-op effect now; config handled by useMemo

  return (
    <div ref={outerRef} style={containerStyle}>
      <div ref={innerRef} style={innerStyle}>
        <div style={pointerStyle} />
        <div style={mediaWrapStyle}>
          {(() => {
            const media = post?.mediaUrl || post?.imageUrl;
            const poster = post?.imageUrl || post?.mediaUrl;
            if (isVideoUrl(post?.mediaUrl)) {
              return (
                <video
                  style={mediaVideoStyle}
                  src={post?.mediaUrl}
                  poster={poster}
                  muted
                  loop
                  playsInline
                  autoPlay
                  preload="metadata"
                />
              );
            }
            if (media) {
              return (
                <img
                  src={media}
                  alt={post?.caption || "Post"}
                  style={{
                    ...mediaImgStyle,
                    objectPosition: panDown ? "50% 0%" : "50% 100%",
                    animation: `${
                      panDown ? "sleep-pan-down" : "sleep-pan-up"
                    } 30s linear infinite alternate`,
                    willChange: "object-position",
                  }}
                />
              );
            }
            if (isTwitterPost(post?.url, post?.platform)) {
              const body = post?.text || safeCaption || "Tweet";
              return (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#fff",
                    color: "#000",
                    padding: 16,
                    boxSizing: "border-box",
                    overflow: "auto",
                    textAlign: "left",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.35,
                    fontSize: 18,
                  }}
                >
                  {body}
                </div>
              );
            }
            return null;
          })()}
        </div>
        <div
          ref={rightColRef}
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <div
            ref={whitePanelRef}
            style={{
              background: "var(--color-star-white)",
              color: "var(--color-text-inverse)",
              padding: "var(--space-4)",
              borderRadius: "var(--radius-md)",
              boxSizing: "border-box",
            }}
          >
            {post?.avatarUrl && post?.username && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <img
                  src={post.avatarUrl}
                  alt={post.username || "User"}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
                <div style={titleStyle}>{"@" + post.username}</div>
              </div>
            )}
            {safeCaption && (
              <p style={captionStyle}>{renderHashtagText(safeCaption)}</p>
            )}
          </div>
          {showMotor && (
            <div
              style={{
                height: motorHeight,
                position: "relative",
                marginTop: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: motorHeight,
                  pointerEvents: "none",
                }}
              >
                <div style={bikeRunnerStyle}>
                  <AnimatedMotorcycle size={motorHeight || 0} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
