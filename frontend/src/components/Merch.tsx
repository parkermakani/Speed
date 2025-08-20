import React, { useEffect, useState } from "react";
import { Card } from "./primitives/Card";
import { Button } from "./primitives/Button";
import { Stack } from "./primitives/Stack";
// 3D model removed for now – placeholder only
import { ChromaticText } from "./ChromaticText";
import { fetchMerch } from "../services/api";
import type { MerchItem } from "../services/api";

const useMerch = () => {
  const [products, setProducts] = useState<MerchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMerch = async () => {
      try {
        const all: MerchItem[] = await fetchMerch();
        setProducts(all.filter((m: MerchItem) => m.active));
      } catch (e) {
        console.error("Failed to fetch merch:", e);
      } finally {
        setLoading(false);
      }
    };
    loadMerch();
  }, []);

  return { products, loading };
};

export const Merch: React.FC = () => {
  const { products, loading } = useMerch();

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
          {loading && <p>Loading…</p>}
          {!loading && products.length === 0 && <p>No products available.</p>}
          {products.map((p) => (
            <Card key={p.id} style={{ background: "var(--color-bg-elevated)" }}>
              <img
                src={p.imageUrl}
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
