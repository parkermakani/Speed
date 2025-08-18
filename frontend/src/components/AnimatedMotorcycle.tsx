import React, { useEffect, useState } from "react";

import frame0 from "../assets/SpeedMotorcycle/SpeedMotorcycle_00000.png";
import frame1 from "../assets/SpeedMotorcycle/SpeedMotorcycle_00001.png";
import frame2 from "../assets/SpeedMotorcycle/SpeedMotorcycle_00002.png";
import frame3 from "../assets/SpeedMotorcycle/SpeedMotorcycle_00003.png";

const FRAMES = [frame0, frame1, frame2, frame3];

export interface AnimatedMotorcycleProps {
  /**
   * Pixel size for width/height. Defaults to 64.
   */
  size?: number;
  /**
   * Additional className(s) for the underlying img element.
   */
  className?: string;
}

/**
 * AnimatedMotorcycle renders a 4-frame PNG loop at ~4 fps (250 ms per frame).
 * Designed to be wrapped inside a Mapbox GL JS Marker for use on the map, but
 * it can be rendered anywhere in the React tree.
 */
const AnimatedMotorcycle: React.FC<AnimatedMotorcycleProps> = ({
  size = 200,
  className,
}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAMES.length);
    }, 250); // 4 fps
    return () => clearInterval(id);
  }, []);

  return (
    <img
      src={FRAMES[frame]}
      width={size}
      height={size}
      className={className}
      alt="Animated motorcycle"
      draggable={false}
      style={{ pointerEvents: "none" }}
    />
  );
};

export default AnimatedMotorcycle;
