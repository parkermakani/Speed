import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
import { fetchAllPosts, type SocialPost } from "../services/api";
import SleepExpandRow from "../components/SleepExpandRow";

const POLL_MS = 60_000; // refresh every minute
const SCROLL_SPEED_PX_PER_SEC = 15; // quarter speed (~15 px/sec)
const NUM_COLUMNS = 5; // keep in sync with CSS grid-template-columns

export default function SleepScreen() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
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

  const displayPosts = useMemo(() => {
    if (!posts || posts.length === 0) return [] as SocialPost[];
    const out: SocialPost[] = [];
    for (let i = 0; i < posts.length * REPEAT_FACTOR; i++) {
      out.push(posts[i % posts.length]);
    }
    return out;
  }, [posts]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchAllPosts();
        if (mounted) setPosts(data);
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
      .sleep-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); padding: var(--space-4); height: 100%; overflow-y: scroll; scrollbar-width: none; }
      .sleep-grid::-webkit-scrollbar { width: 0px; height: 0px; }
      .sleep-tile { width: 100%; aspect-ratio: 1 / 1; position: relative; overflow: hidden; border-radius: var(--radius-md); }
      .sleep-tile > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .sleep-expand { grid-column: 1 / -1; position: relative; overflow: hidden; height: 0; opacity: 0; transition: height 400ms ease, opacity 300ms ease; }
      .sleep-expand.enter { opacity: 1; }
      .sleep-expand.leave { opacity: 0; }
      .sleep-expand__inner { position: relative; display: grid; grid-template-columns: 2fr 3fr; gap: var(--space-4); padding: var(--space-4); background: var(--color-bg-elevated); border-radius: var(--radius-md); align-items: center; }
      .sleep-expand__inner::after { content: ""; position: absolute; top: 0; left: var(--pointer-left, 40px); width: 12px; height: 12px; background: var(--color-bg-elevated); transform: translate(-50%, -50%) rotate(45deg); border-radius: 2px; }
      .sleep-expand__media { width: 100%; aspect-ratio: 16 / 9; position: relative; overflow: hidden; border-radius: var(--radius-md); }
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
      <div ref={scrollRef} className="sleep-grid">
        {loading && <div>Loading…</div>}
        {!loading &&
          displayPosts.flatMap((p, i) => {
            const img = p.mediaUrl || p.imageUrl;
            const href = p.url || undefined;
            const inner = (
              <div
                className="sleep-tile"
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
                {/* Header with avatar and username (guarded render) */}
                {p.avatarUrl && p.username && (
                  <div
                    style={{
                      position: "absolute",
                      top: 6,
                      left: 6,
                      right: 6,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      zIndex: 2,
                      background: "var(--color-primary-50)",
                      padding: "4px 8px",
                      borderRadius: "var(--radius-lg)",
                      backdropFilter: "blur(2px)",
                      minWidth: 0,
                      gap: 8,
                    }}
                  >
                    <img
                      src={p.avatarUrl}
                      alt={`@${p.username || "Unknown"}`}
                      style={{
                        position: "relative",
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flex: "0 0 20px",
                      }}
                    />
                    <span
                      style={{
                        color: "white",
                        fontSize: 16,
                        lineHeight: 1,
                        flex: "1 1 auto",
                        minWidth: 0,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {`@${p.username || "Unknown"}`}
                    </span>
                  </div>
                )}

                {img ? (
                  <img src={img} alt={p.caption || "Post"} />
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
                    ? displayPosts[selectedIdx]
                    : p;
                const expansion = (
                  <SleepExpandRow
                    key={expansionKey}
                    post={expPost}
                    pointerLeftPx={pointerLeft}
                    state={expandedInRow ? "enter" : "leave"}
                  />
                );
                return [tileEl, expansion];
              }
            }
            return [tileEl];
          })}
      </div>
    </div>
  );
}
