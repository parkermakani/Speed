import React from "react";
import { Card } from "./primitives/Card";
import { Button } from "./primitives/Button";
import { Stack } from "./primitives/Stack";
// 3D model removed for now – placeholder only
import { ChromaticText } from "./ChromaticText";
import shirtNavyImg from "../assets/examples/Shirt1.png";
import shirtWhiteImg from "../assets/examples/Shirt2.png";

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
    name: "Speed Does America Tee - Navy",
    price: "$30",
    image: shirtNavyImg,
    url: "https://speed.store/products/gold-logo-black-tee",
  },
  {
    id: "hoodie",
    name: "Speed Does America Tee - White",
    price: "$30",
    image: shirtWhiteImg,
    url: "https://speed.store/products/gold-logo-black-tee",
  }
];

export const Merch: React.FC = () => {
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
        {/* Left: Placeholder – 3D coming soon */}
        <div style={{ width: "100%" }}>
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
            3D preview coming soon
          </div>
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
                  variant="primary"
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
