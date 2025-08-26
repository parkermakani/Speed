import type { TipStep } from "../types";
import tip1 from "../assets/Tips/tip-1.png";
import tip2 from "../assets/Tips/tip-2.png";
import tip3 from "../assets/Tips/tip-3.png";
import tip4 from "../assets/Tips/tip-4.png";
import tip5 from "../assets/Tips/tip-5.png";
import tip6 from "../assets/Tips/tip-6.png";
import tip7 from "../assets/Tips/tip-7.png";

// Helper query selectors for known targets
//const q = (sel: string) => sel;

export const tipsConfig: TipStep[] = [
  {
    id: "Tip0",
    imageUrl: tip7,
    target: '[data-tip-target="help"]',
    continueMode: "tapAnywhere",
    placementDesktop: {
      offsetX: 81,
      offsetY: 87,
      rotationDeg: 0,
      anchor: "center",
      scale: 1.25,
    },
    placementMobile: {
      offsetX: 79,
      offsetY: 94,
      rotationDeg: 0,
      anchor: "center",
      scale: 1.7,
    },
  },
  {
    id: "Tip-Quote",
    imageUrl: tip4,
    target: '[data-tip-target="quote"]',
    continueMode: "tapAnywhere",
    placementDesktop: {
      offsetX: -148,
      offsetY: 127,
      rotationDeg: 0,
      anchor: "bottomRight",
      scale: 1.35,
    },
    placementMobile: {
      offsetX: -138,
      offsetY: 119,
      rotationDeg: 0,
      anchor: "bottomRight",
      scale: 1.8,
    },
  },
  {
    id: "Tip-CurrentCity",
    imageUrl: tip3,
    target: '[data-tip-target="current-city"]',
    continueMode: "tapAnywhere",
    placementDesktop: {
      offsetX: 339,
      offsetY: -9,
      rotationDeg: 0,
      anchor: "topLeft",
      scale: 1.6,
    },
    placementMobile: {
      offsetX: 200,
      offsetY: 40,
      rotationDeg: 0,
      anchor: "topLeft",
      scale: 1,
    },
  },
  {
    id: "Tip3",
    imageUrl: tip5,
    target: '[data-tip-target="shoptab"]',
    continueMode: "tapAnywhere",
    placementDesktop: {
      offsetX: -163,
      offsetY: 35,
      rotationDeg: 0,
      anchor: "center",
      scale: 1.75,
    },
    placementMobile: {
      offsetX: -153,
      offsetY: 31,
      rotationDeg: 0,
      anchor: "center",
      scale: 1.4,
    },
  },
  {
    id: "Tip-Merch",
    imageUrl: tip2,
    target: '[data-tip-target="merch-card"]',
    continueMode: "tapAnywhere",
    placementDesktop: {
      offsetX: -228,
      offsetY: 60,
      rotationDeg: 0,
      anchor: "center",
      scale: 1.35,
    },
    placementMobile: {
      offsetX: -130,
      offsetY: -41,
      rotationDeg: 0,
      anchor: "center",
      scale: 1.55,
    },
  },
  {
    id: "Tip-AnimIcons",
    imageUrl: tip1,
    target: '[data-tip-target="anim-icons"]',
    continueMode: "tapAnywhere",
    placementDesktop: {
      offsetX: -269,
      offsetY: -91,
      rotationDeg: 0,
      anchor: "center",
      scale: 1.25,
    },
    placementMobile: {
      offsetX: -170,
      offsetY: 29,
      rotationDeg: 0,
      anchor: "center",
    },
  },
  {
    id: "Tip-MerchCard",
    imageUrl: tip6,
    target: '[data-tip-target="time-limit"]',
    continueMode: "tapAnywhere",
    placementDesktop: {
      offsetX: -313,
      offsetY: -119,
      rotationDeg: 0,
      anchor: "center",
      scale: 2,
    },
    placementMobile: {
      offsetX: -157,
      offsetY: -84,
      rotationDeg: 0,
      anchor: "center",
      scale: 1.2,
    },
  },
];
