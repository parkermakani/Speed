import { useLayoutEffect, useRef, useState } from "react";
import type { SocialPost } from "../services/api";

interface SleepExpandRowProps {
  post: SocialPost | null;
  pointerLeftPx: number;
  state: "enter" | "leave";
  transitionMs?: number;
}

function cleanCaption(raw?: string): string {
  if (!raw) return "";
  let out = raw;
  // Remove known embed blocks (e.g., TikTok)
  out = out.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, " ");
  // Strip any remaining HTML tags
  out = out.replace(/<[^>]+>/g, " ");
  // Decode a few common HTML entities
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
  // Collapse whitespace
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

export default function SleepExpandRow({
  post,
  pointerLeftPx,
  state,
  transitionMs = 800,
}: SleepExpandRowProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [localLeft, setLocalLeft] = useState<number>(pointerLeftPx);

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
    borderRadius: "var(--radius-md)",
    alignItems: "start",
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
    color: "var(--color-text)",
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
  };

  const captionStyle: React.CSSProperties = {
    color: "var(--color-text-secondary)",
    fontSize: 24,
    fontWeight: "bold",
    margin: 0,
  };

  const safeCaption = cleanCaption(post?.caption);

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
                  style={mediaImgStyle}
                />
              );
            }
            return null;
          })()}
        </div>
        <div style={{ minWidth: 0 }}>
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
              <div style={titleStyle}>{post.username}</div>
            </div>
          )}
          {safeCaption && <p style={captionStyle}>{safeCaption}</p>}
        </div>
      </div>
    </div>
  );
}
