import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
import type React from "react";
import { fetchAllPosts, type SocialPost } from "../services/api";
import SleepExpandRow from "../components/SleepExpandRow";
import { Header } from "../components/Header";
import { Quote } from "../components/Quote";
import AnimatedSleeping from "../components/AnimatedSleeping";

const POLL_MS = 60_000; // refresh every minute
const SCROLL_SPEED_PX_PER_SEC = 15; // quarter speed (~15 px/sec)
const NUM_COLUMNS = 5; // keep in sync with CSS grid-template-columns

export default function SleepScreen() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  // Removed user bar toggle; no longer used
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const expandedIndexRef = useRef<number | null>(null);
  const [expandedAnchorIndex, setExpandedAnchorIndex] = useState<number | null>(
    null
  );
  const expandedAnchorIndexRef = useRef<number | null>(null);
  const lastSwitchScrollRef = useRef(0);
  const lastSwitchTimeRef = useRef(0);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [leavingAnchorIndex, setLeavingAnchorIndex] = useState<number | null>(
    null
  );
  const prevExpandedRef = useRef<number | null>(null);
  const prevAnchorRef = useRef<number | null>(null);
  const TRANSITION_MS = 350;
  const switchTimerRef = useRef<number | null>(null);
  const REPEAT_FACTOR = 6;
  const tileElsRef = useRef<Map<number, Element>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleIndicesRef = useRef<Set<number>>(new Set());
  const enteringExpandRef = useRef<HTMLDivElement | null>(null);
  const leavingExpandRef = useRef<HTMLDivElement | null>(null);
  const [pointerLeft, setPointerLeft] = useState<number>(40);
  // Visual ordering: maps visual index -> underlying post index in displayPosts
  const [order, setOrder] = useState<number[]>([]);
  const isSwappingRef = useRef<boolean>(false);
  const swapTimerRef = useRef<number | null>(null);

  // Floating sleeper sprite state
  const [floatVisible, setFloatVisible] = useState<boolean>(false);
  const [floatPos, setFloatPos] = useState<{ x: number; y: number }>({
    x: -200,
    y: -200,
  });
  const [floatAngle, setFloatAngle] = useState<number>(0);
  const floatTimerRef = useRef<number | null>(null);

  const displayPosts = useMemo(() => {
    if (!posts || posts.length === 0) return [] as SocialPost[];
    const out: SocialPost[] = [];
    for (let i = 0; i < posts.length * REPEAT_FACTOR; i++) {
      out.push(posts[i % posts.length]);
    }
    return out;
  }, [posts]);

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

  // Initialize or resize visual order when length changes
  useEffect(() => {
    const len = displayPosts.length;
    if (len === 0) {
      setOrder([]);
      return;
    }
    setOrder((prev) => {
      if (prev.length === len) return prev;
      const next = new Array(len).fill(0).map((_, i) => i);
      return next;
    });
  }, [displayPosts.length]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchAllPosts();
        if (mounted) {
          setPosts(data);
        }
      } catch {}
      if (mounted) setLoading(false);
    };
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  // Auto-scroll loop (and time-based random expansion)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let lastTs = performance.now();
    let remainder = 0;
    const step = () => {
      const node = scrollRef.current;
      if (!node) return;
      const now = performance.now();
      const dt = Math.max(0, now - lastTs) / 1000; // seconds
      lastTs = now;
      const delta = SCROLL_SPEED_PX_PER_SEC * dt;
      remainder += delta;
      const whole = Math.floor(remainder);
      if (whole >= 1) {
        node.scrollTop = node.scrollTop + whole;
        remainder -= whole;
      }
      if (node.scrollTop + node.clientHeight >= node.scrollHeight - 1) {
        node.scrollTop = 0;
      }
      // No switching here; handled by a separate timer for smoothness
      scrollTimerRef.current = window.requestAnimationFrame(
        step
      ) as unknown as number;
    };
    scrollTimerRef.current = window.requestAnimationFrame(
      step
    ) as unknown as number;
    return () => {
      if (scrollTimerRef.current != null) {
        window.cancelAnimationFrame(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, [posts.length]);

  // Ensure something expands once posts are loaded (then scrolling will rotate it)
  useEffect(() => {
    if (!loading && displayPosts.length > 0 && expandedIndex == null) {
      const initial = Math.floor(Math.random() * displayPosts.length);
      setExpandedIndex(initial);
      expandedIndexRef.current = initial;
      lastSwitchScrollRef.current = scrollRef.current?.scrollTop ?? 0;
      lastSwitchTimeRef.current = Date.now();
    }
  }, [loading, displayPosts.length, expandedIndex]);

  // Keep ref in sync so RAF reads fresh value
  useEffect(() => {
    expandedIndexRef.current = expandedIndex;
  }, [expandedIndex]);

  // Measure and set max-heights for smooth expand/collapse
  const updatePointerAndHeights = useCallback(() => {
    const entering = enteringExpandRef.current;
    if (entering) {
      const inner = entering.querySelector(
        ".sleep-expand__inner"
      ) as HTMLDivElement | null;
      const root = scrollRef.current;
      let anchorIdx: number | null = expandedAnchorIndexRef.current ?? null;
      if (anchorIdx == null && leavingAnchorIndex != null) {
        anchorIdx = leavingAnchorIndex;
      }
      const selectedEl =
        anchorIdx != null
          ? (tileElsRef.current.get(anchorIdx) as HTMLElement | undefined)
          : undefined;
      if (root && selectedEl) {
        const rootRect = root.getBoundingClientRect();
        const tileRect = selectedEl.getBoundingClientRect();
        const left = tileRect.left - rootRect.left + tileRect.width / 2;
        setPointerLeft(left);
      }
      entering.style.height = "0px";
      // Force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      entering.offsetHeight;
      const contentHeight = inner ? inner.scrollHeight : entering.scrollHeight;
      entering.style.height = `${contentHeight}px`;
    }
    const leaving = leavingExpandRef.current;
    if (leaving) {
      const inner = leaving.querySelector(
        ".sleep-expand__inner"
      ) as HTMLDivElement | null;
      const startHeight = inner ? inner.scrollHeight : leaving.scrollHeight;
      leaving.style.height = `${startHeight}px`;
      // Force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      leaving.offsetHeight;
      leaving.style.height = "0px";
    }
  }, []);

  useLayoutEffect(() => {
    updatePointerAndHeights();
  }, [updatePointerAndHeights, expandedIndex, leavingIndex]);

  useEffect(() => {
    const onResize = () => updatePointerAndHeights();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updatePointerAndHeights]);

  // Periodically drift a sleeping sprite across the screen from a random edge
  useEffect(() => {
    if (floatTimerRef.current != null) {
      window.clearTimeout(floatTimerRef.current);
      floatTimerRef.current = null;
    }
    const schedule = () => {
      const MIN_MS = 16000;
      const MAX_MS = 30000;
      const delay = MIN_MS + Math.random() * (MAX_MS - MIN_MS);
      floatTimerRef.current = window.setTimeout(() => {
        const root = scrollRef.current;
        if (!root) return schedule();
        const rect = root.getBoundingClientRect();
        const size = 180; // pixel size for sprite (bigger)
        // Random start edge: 0=left,1=right,2=top,3=bottom
        const edge = Math.floor(Math.random() * 4);
        let startX = -size;
        let startY = Math.random() * (rect.height - size);
        let endX = rect.width + size;
        let endY = Math.random() * (rect.height - size);
        if (edge === 1) {
          // right -> left
          startX = rect.width + size;
          endX = -size;
        } else if (edge === 2) {
          // top -> bottom
          startX = Math.random() * (rect.width - size);
          endX = Math.random() * (rect.width - size);
          startY = -size;
          endY = rect.height + size;
        } else if (edge === 3) {
          // bottom -> top
          startX = Math.random() * (rect.width - size);
          endX = Math.random() * (rect.width - size);
          startY = rect.height + size;
          endY = -size;
        }
        // Choose a curved control point roughly near the midpoint, offset perpendicular
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const dx = endX - startX;
        const dy = endY - startY;
        const len = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / len;
        const ny = dx / len;
        const curvature =
          Math.min(rect.width, rect.height) * (0.15 + Math.random() * 0.25);
        const bend = (Math.random() < 0.5 ? -1 : 1) * curvature;
        const ctrlX = midX + nx * bend;
        const ctrlY = midY + ny * bend;
        // Initial facing angle
        const baseAngle = 0; // keep upright
        setFloatAngle(baseAngle);
        setFloatPos({ x: startX, y: startY });
        setFloatVisible(true);
        const DUR = 20000 + Math.random() * 15000; // slower drift
        const spinSpeed = 0; // no spin, always upright
        const startTime = performance.now();
        const animate = (now: number) => {
          const t = Math.min(1, (now - startTime) / DUR);
          const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
          // Quadratic Bezier for curve
          const omt = 1 - easeT;
          const x =
            omt * omt * startX + 2 * omt * easeT * ctrlX + easeT * easeT * endX;
          const y =
            omt * omt * startY + 2 * omt * easeT * ctrlY + easeT * easeT * endY;
          setFloatPos({ x, y });
          // Derivative for tangent angle
          // Keep upright; ignore derivative
          const travelAngle = 0;
          const elapsedSec = (now - startTime) / 1000;
          setFloatAngle(travelAngle + spinSpeed * elapsedSec);
          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            setFloatVisible(false);
          }
        };
        requestAnimationFrame(animate);
        schedule();
      }, delay) as unknown as number;
    };
    schedule();
    return () => {
      if (floatTimerRef.current != null) {
        window.clearTimeout(floatTimerRef.current);
        floatTimerRef.current = null;
      }
    };
  }, []);

  // Helper to choose two close-by visual indices to swap (excluding the anchor)
  const chooseNearbyPair = useCallback((): [number, number] | null => {
    const total = displayPosts.length;
    if (total < 4) return null;
    const anchor = expandedAnchorIndexRef.current;
    const vis = Array.from(visibleIndicesRef.current.values());
    const pool = vis.length >= 4 ? vis : [...Array(total).keys()];
    // pick first candidate not equal to anchor
    let a = pool[Math.floor(Math.random() * pool.length)];
    let safety = 0;
    while (anchor != null && a === anchor && safety++ < 10) {
      a = pool[Math.floor(Math.random() * pool.length)];
    }
    const col = a % NUM_COLUMNS;
    const neighbors: number[] = [];
    const pushIfValid = (idx: number) => {
      if (idx >= 0 && idx < total) neighbors.push(idx);
    };
    // left/right (same row)
    if (col - 1 >= 0) pushIfValid(a - 1);
    if (col + 1 < NUM_COLUMNS) pushIfValid(a + 1);
    // up/down
    pushIfValid(a - NUM_COLUMNS);
    pushIfValid(a + NUM_COLUMNS);
    // filter out anchor and out of pool
    const neighborPool = (neighbors.length > 0 ? neighbors : pool).filter(
      (idx) => (anchor == null || idx !== anchor) && idx !== a
    );
    if (neighborPool.length === 0) return null;
    const b = neighborPool[Math.floor(Math.random() * neighborPool.length)];
    return [a, b];
  }, [displayPosts.length]);

  // Perform a FLIP-like visual swap of two tiles, then swap their mapped content
  const animateAndSwap = useCallback((a: number, b: number) => {
    const elA = tileElsRef.current.get(a) as HTMLElement | undefined;
    const elB = tileElsRef.current.get(b) as HTMLElement | undefined;
    if (!elA || !elB) return;
    const rectA = elA.getBoundingClientRect();
    const rectB = elB.getBoundingClientRect();
    const dxA = rectB.left - rectA.left;
    const dyA = rectB.top - rectA.top;
    const dxB = rectA.left - rectB.left;
    const dyB = rectA.top - rectB.top;
    const DUR = 450;
    const lift = (el: HTMLElement, dx: number, dy: number) => {
      el.style.willChange = "transform";
      el.style.transition = `transform ${DUR}ms ease`;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.zIndex = "3";
      el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.35)";
    };
    const drop = (el: HTMLElement) => {
      el.style.transition = "";
      el.style.transform = "";
      el.style.willChange = "";
      el.style.zIndex = "";
      el.style.boxShadow = "";
    };
    lift(elA, dxA, dyA);
    lift(elB, dxB, dyB);
    window.setTimeout(() => {
      // swap mapped content for visual indices a and b
      setOrder((prev) => {
        const next = prev.slice();
        const tmp = next[a];
        next[a] = next[b];
        next[b] = tmp;
        return next;
      });
      // allow the content swap to paint, then drop
      window.requestAnimationFrame(() => {
        drop(elA);
        drop(elB);
        isSwappingRef.current = false;
      });
    }, DUR);
  }, []);

  // Schedule random neighbor swaps periodically, avoiding the anchor tile
  useEffect(() => {
    if (swapTimerRef.current != null) {
      window.clearTimeout(swapTimerRef.current);
      swapTimerRef.current = null;
    }
    const schedule = () => {
      const MIN_MS = 5000;
      const MAX_MS = 9000;
      const delay = MIN_MS + Math.random() * (MAX_MS - MIN_MS);
      swapTimerRef.current = window.setTimeout(() => {
        if (!isSwappingRef.current) {
          const pair = chooseNearbyPair();
          const anchor = expandedAnchorIndexRef.current;
          if (
            pair &&
            (anchor == null || (pair[0] !== anchor && pair[1] !== anchor))
          ) {
            isSwappingRef.current = true;
            animateAndSwap(pair[0], pair[1]);
          }
        }
        schedule();
      }, delay) as unknown as number;
    };
    schedule();
    return () => {
      if (swapTimerRef.current != null) {
        window.clearTimeout(swapTimerRef.current);
        swapTimerRef.current = null;
      }
    };
  }, [chooseNearbyPair, animateAndSwap]);

  // Track previous expanded to animate closing
  useEffect(() => {
    const prev = (prevExpandedRef as React.MutableRefObject<number | null>)
      .current;
    if (prev != null && prev !== expandedIndex) {
      setLeavingIndex(prev);
      setLeavingAnchorIndex(
        (prevAnchorRef as React.MutableRefObject<number | null>).current
      );
      window.setTimeout(() => {
        setLeavingIndex((v) => (v === prev ? null : v));
        setLeavingAnchorIndex((v) => (v === prev ? null : v));
      }, TRANSITION_MS);
    }
    (prevExpandedRef as React.MutableRefObject<number | null>).current =
      expandedIndex;
    (prevAnchorRef as React.MutableRefObject<number | null>).current =
      expandedAnchorIndex;
  }, [expandedIndex]);

  // Dedicated timer for random switching at smooth intervals
  useEffect(() => {
    if (switchTimerRef.current != null) {
      window.clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }
    if (displayPosts.length === 0) return;
    // Always schedule the next switch
    const MIN_MS = 10000;
    const MAX_MS = 15000;
    const delay = MIN_MS + Math.random() * (MAX_MS - MIN_MS);
    switchTimerRef.current = window.setTimeout(() => {
      const total = displayPosts.length;
      if (total > 0) {
        const vis = Array.from(visibleIndicesRef.current.values()).sort(
          (a, b) => a - b
        );
        let candidates: number[] = vis;
        if (vis.length > 0) {
          const maxVisible = vis[vis.length - 1];
          const nextRowStart =
            maxVisible + (NUM_COLUMNS - (maxVisible % NUM_COLUMNS));
          const nextRow = [] as number[];
          for (let k = 0; k < NUM_COLUMNS; k++) {
            const idx = nextRowStart + k;
            if (idx < total) nextRow.push(idx);
          }
          candidates = [...new Set([...vis, ...nextRow])];
        }
        if (candidates.length === 0) candidates = [...Array(total).keys()];
        let nextIndex =
          candidates[Math.floor(Math.random() * candidates.length)];
        const currentExpanded = expandedIndexRef.current;
        if (
          currentExpanded != null &&
          total > 1 &&
          nextIndex === currentExpanded
        ) {
          if (candidates.length > 1) {
            const alt = candidates.find((c) => c !== currentExpanded);
            if (alt != null) nextIndex = alt;
          } else {
            nextIndex = (nextIndex + 1) % total;
          }
        }
        setExpandedIndex(nextIndex);
        expandedIndexRef.current = nextIndex;
        // Choose a random anchor within the row of the selected index
        const rowStart = nextIndex - (nextIndex % NUM_COLUMNS);
        const rowEnd = Math.min(rowStart + (NUM_COLUMNS - 1), total - 1);
        const anchor =
          rowStart + Math.floor(Math.random() * (rowEnd - rowStart + 1));
        setExpandedAnchorIndex(anchor);
        expandedAnchorIndexRef.current = anchor;
      }
    }, delay) as unknown as number;
    return () => {
      if (switchTimerRef.current != null) {
        window.clearTimeout(switchTimerRef.current);
        switchTimerRef.current = null;
      }
    };
  }, [displayPosts.length, expandedIndex]);

  // Visibility tracking: only pick from visible tiles + next row
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    const root = scrollRef.current;
    if (!root) return;
    const options: IntersectionObserverInit = {
      root,
      rootMargin: "0px",
      threshold: 0.5, // at least 50% visible
    };
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        // Find index by reverse lookup of element
        let idx: number | undefined;
        for (const [k, el] of tileElsRef.current.entries()) {
          if (el === entry.target) {
            idx = k;
            break;
          }
        }
        if (idx === undefined) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          visibleIndicesRef.current.add(idx);
        } else {
          visibleIndicesRef.current.delete(idx);
        }
      }
    }, options);
    observerRef.current = obs;
    for (const el of tileElsRef.current.values()) {
      obs.observe(el);
    }
    return () => {
      obs.disconnect();
    };
  }, [displayPosts.length]);

  // Inject minimal full-screen styles
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "_sleep_screen_styles";
    const css = `
      html, body, #root { height: 100%; }
      .sleep-wrapper { position: fixed; inset: 0; background: var(--color-bg); color: var(--color-text); }
      .sleep-grid { display: grid; grid-template-columns: repeat(5, 1fr); height: 100%; overflow-y: scroll; scrollbar-width: none; }
      .sleep-grid::-webkit-scrollbar { width: 0px; height: 0px; }
      .sleep-tile { width: 100%; aspect-ratio: 3 / 4; position: relative; overflow: hidden;}
      .sleep-tile > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .sleep-expand { grid-column: 1 / -1; position: relative; overflow: hidden; height: 0; opacity: 0; transition: height 400ms ease, opacity 300ms ease; }
      .sleep-expand.enter { opacity: 1; }
      .sleep-expand.leave { opacity: 0; }
      .sleep-expand__inner { position: relative; display: grid; grid-template-columns: 2fr 3fr; gap: var(--space-4); padding: var(--space-4); background: var(--color-bg-elevated); border-radius: var(--radius-md); align-items: center; }
      .sleep-expand__inner::after { content: ""; position: absolute; top: 0; left: var(--pointer-left, 40px); width: 12px; height: 12px; background: var(--color-bg-elevated); transform: translate(-50%, -50%) rotate(45deg); border-radius: 2px; }
      .sleep-expand__media { width: 100%; aspect-ratio: 16 / 9; position: relative; overflow: hidden; }
      .sleep-expand__media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .sleep-expand__content { min-width: 0; }
      .sleep-expand__title { color: var(--color-text); font-size: 14px; font-weight: 600; margin: 0 0 var(--space-2) 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sleep-expand__caption { color: var(--color-text-secondary); font-size: 13px; margin: 0; max-height: 6em; overflow: hidden; }
    `;
    const existing = document.getElementById(id) as HTMLStyleElement | null;
    if (existing) {
      existing.innerHTML = css;
    } else {
      const styleEl = document.createElement("style");
      styleEl.id = id;
      styleEl.innerHTML = css;
      document.head.appendChild(styleEl);
    }
  }, []);

  return (
    <div className="sleep-wrapper">
      {/* Overlay header to match home screen */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 1500,
        }}
      >
        <Header />
        <div style={{ marginTop: -16 }}>
          <Quote quote="#SpeedDoesAmerica" quoted={false} withShadow />
        </div>
      </div>
      <div ref={scrollRef} className="sleep-grid">
        {loading && <div>Loading…</div>}
        {!loading &&
          [...Array(displayPosts.length).keys()].flatMap((i) => {
            const postIdx = order[i] ?? i;
            const p = displayPosts[postIdx];
            const img = p?.mediaUrl || p?.imageUrl;
            const isTwitter =
              (p?.platform || "").toLowerCase() === "twitter" ||
              (p?.url || "").includes("twitter.com") ||
              (p?.url || "").includes("x.com");
            const href = p?.url || undefined;
            const inner = (
              <div
                className="sleep-tile"
                data-sleep-tile-index={i}
                title={p.caption || "Post"}
                ref={(el) => {
                  const map = tileElsRef.current;
                  if (el) {
                    map.set(i, el);
                  } else {
                    map.delete(i);
                  }
                }}
              >
                {/* Username/avatar removed; shown only in expanded row */}

                {img ? (
                  <img src={img} alt={p.caption || "Post"} />
                ) : isTwitter ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      justifyContent: "flex-start",
                      background: "#fff",
                      color: "#000",
                      padding: "12px",
                      boxSizing: "border-box",
                      overflow: "auto",
                      textAlign: "left",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.3,
                      fontSize: "clamp(12px, 1.6vw, 16px)",
                    }}
                  >
                    {(p?.avatarUrl || p?.username) && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        {p?.avatarUrl && (
                          <img
                            src={p.avatarUrl}
                            alt={p.username || "User"}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              objectFit: "cover",
                              flex: "0 0 36px",
                            }}
                          />
                        )}
                        {p?.username && (
                          <span style={{ color: "#000", fontWeight: 600 }}>
                            @{p.username}
                          </span>
                        )}
                      </div>
                    )}
                    <div>
                      {renderHashtagText(p?.text || p?.caption || "Tweet")}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--color-surface)",
                      padding: "var(--space-2)",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.caption || "Post"}
                  </div>
                )}
              </div>
            );
            const tileEl = href ? (
              <a
                key={`tile-${i}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none" }}
              >
                {inner}
              </a>
            ) : (
              <div key={`tile-${i}`}>{inner}</div>
            );

            // For each row end, insert expansion if selected index is within that row
            const rowStart = i - (i % NUM_COLUMNS);
            const rowEnd = rowStart + (NUM_COLUMNS - 1);
            const isLastInRow = i % NUM_COLUMNS === NUM_COLUMNS - 1;
            if (isLastInRow) {
              const expandedInRow =
                expandedIndex != null &&
                expandedIndex >= rowStart &&
                expandedIndex <= rowEnd;
              const leavingInRow =
                leavingIndex != null &&
                leavingIndex >= rowStart &&
                leavingIndex <= rowEnd;
              if (expandedInRow || leavingInRow) {
                const expansionKey = `exp-row-${rowStart}`;
                const selectedIdx = expandedInRow
                  ? (expandedAnchorIndex as number)
                  : (leavingAnchorIndex as number);
                const expPost =
                  selectedIdx >= 0 && selectedIdx < displayPosts.length
                    ? displayPosts[order[selectedIdx] ?? selectedIdx]
                    : p;
                const expansion = (
                  <SleepExpandRow
                    key={expansionKey}
                    post={expPost}
                    pointerLeftPx={pointerLeft}
                    anchorIndex={selectedIdx}
                    state={expandedInRow ? "enter" : "leave"}
                  />
                );
                return [tileEl, expansion];
              }
            }
            return [tileEl];
          })}
        {floatVisible && (
          <div
            style={{
              position: "absolute",
              pointerEvents: "none",
              transform: `translate(${floatPos.x}px, ${floatPos.y}px) rotate(${floatAngle}rad)`,
              transition: "transform 50ms linear",
              zIndex: 5,
            }}
          >
            <AnimatedSleeping size={180} />
          </div>
        )}
      </div>
    </div>
  );
}
