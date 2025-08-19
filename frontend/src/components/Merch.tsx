import React from "react";
import { Card } from "./primitives/Card";
import { Button } from "./primitives/Button";
import { Stack } from "./primitives/Stack";
import { lazy, Suspense } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { ChromaticText } from "./ChromaticText";

interface Product {
  id: string;
  name: string;
  price: string;
  image: string;
  url: string;
}

const PRODUCTS: Product[] = [
  {
    id: "tee",
    name: "Speed Does America Tee",
    price: "$25",
    image: "https://placehold.co/300x200?text=Tee",
    url: "#",
  },
  {
    id: "hoodie",
    name: "Patriotic Hoodie",
    price: "$45",
    image: "https://placehold.co/300x200?text=Hoodie",
    url: "#",
  },
  {
    id: "sticker",
    name: "Logo Sticker Pack",
    price: "$8",
    image: "https://placehold.co/300x200?text=Stickers",
    url: "#",
  },
];

// Lazy-load the heavy 3D viewer so the ~40 MB GLB is downloaded only when truly needed
const ModelViewer = lazy(() =>
  import("./ModelViewer").then((m) => ({ default: m.ModelViewer }))
);

export const Merch: React.FC = () => {
  const isWide = useMediaQuery("(min-width: 1100px)"); // only show 3D viewer on larger screens
  return (
    <div style={{ padding: "var(--space-6)" }}>
      <div style={{ textAlign: "center" }}>
        <ChromaticText
          text="Tour Merch"
          style={{
            fontSize: "3rem",
            marginBottom: "var(--space-2)",
            marginTop: 0,
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60% 40%",
          columnGap: "var(--space-4)",
        }}
      >
        {/* Left: Model viewer (desktop only) */}
        <div style={{ width: "100%" }}>
          {isWide ? (
            <Suspense
              fallback={
                <div
                  style={{
                    color: "var(--color-text-secondary)",
                    textAlign: "center",
                  }}
                >
                  Loading 3D…
                </div>
              }
            >
              <ModelViewer height={"100%"} />
            </Suspense>
          ) : (
            <div
              style={{
                width: "100%",
                height: "260px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-secondary)",
                background: "var(--color-bg-elevated)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              3D preview available on desktop
            </div>
          )}
        </div>

        {/* Right: Products grid */}
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "var(--space-4)",
            overflowY: "auto",
          }}
        >
          {PRODUCTS.map((p) => (
            <Card key={p.id} style={{ background: "var(--color-bg-elevated)" }}>
              <img
                src={p.image}
                alt={p.name}
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: "var(--radius-md)",
                }}
              />
              <Stack spacing="sm" style={{ marginTop: "var(--space-3)" }}>
                <h3 style={{ margin: 0, color: "var(--color-text)" }}>
                  {p.name}
                </h3>
                <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
                  {p.price}
                </p>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => window.open(p.url, "_blank")}
                >
                  Add to Cart
                </Button>
              </Stack>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
