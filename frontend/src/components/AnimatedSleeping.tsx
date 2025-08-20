import React, { useEffect, useState } from "react";

// Import sleeping frames
import frame0 from "../assets/SpeedSleeping/SpeedSleeping_00000.png";
import frame1 from "../assets/SpeedSleeping/SpeedSleeping_00001.png";
import frame2 from "../assets/SpeedSleeping/SpeedSleeping_00002.png";
import frame3 from "../assets/SpeedSleeping/SpeedSleeping_00003.png";

const FRAMES = [frame0, frame1, frame2, frame3]; 

export interface AnimatedSleepingProps {
  /** Pixel size for width/height. Defaults to 64. */
  size?: number;
  /** Additional className(s) for the underlying img element. */
  className?: string;
  /** Optional click handler (e.g., open modal, etc.) */
  onClick?: () => void;
  /** Show debug border; helpful when sizing/anchoring. */
  showBorder?: boolean;

  /** Width of the clickable overlay in pixels (defaults to `size`). */
  clickWidth?: number;
  /** Height of the clickable overlay in pixels (defaults to `size`). */
  clickHeight?: number;
  /** X offset (px) of clickable overlay relative to top‐left of the image. */
  clickOffsetX?: number;
  /** Y offset (px) of clickable overlay relative to top‐left of the image. */
  clickOffsetY?: number;
  /** Show border around the clickable overlay for debugging. */
  showClickBorder?: boolean;
}

/**
 * AnimatedSleeping renders a 4-frame PNG loop at ~4 fps (250 ms per frame).
 * Designed to be wrapped inside a Mapbox GL JS Marker for use on the map, but
 * it can be rendered anywhere in the React tree.
 */
const AnimatedSleeping: React.FC<AnimatedSleepingProps> = ({
  size = 64,
  className,
  onClick,
  showBorder = false,
  clickWidth,
  clickHeight,
  clickOffsetX = 0,
  clickOffsetY = 0,
  showClickBorder = false,
}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAMES.length);
    }, 250); // 4 fps
    return () => clearInterval(id);
  }, []);

  const overlayW = clickWidth ?? size;
  const overlayH = clickHeight ?? size;

  return (
    <div
      style={{ position: "relative", width: size, height: size }}
      className={className}
    >
      <img
        src={FRAMES[frame]}
        width={size}
        height={size}
        alt="Animated sleeping"
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          border: showBorder ? "2px dashed red" : undefined,
          userSelect: "none",
        }}
      />
      {onClick && (
        <div
          onClick={onClick}
          style={{
            position: "absolute",
            left: clickOffsetX,
            top: clickOffsetY,
            width: overlayW,
            height: overlayH,
            cursor: "pointer",
            border: showClickBorder ? "2px dotted blue" : undefined,
            background: "transparent",
          }}
        />
      )}
    </div>
  );
};

export default AnimatedSleeping;
