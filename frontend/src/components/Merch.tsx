import React, { useEffect, useState } from "react";
import { Card } from "./primitives/Card";
import { Button } from "./primitives/Button";
import { Stack } from "./primitives/Stack";
// 3D model removed for now – placeholder only
import { ModelViewer } from "./ModelViewer";
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
  const [shirtTexture, setShirtTexture] = useState<string | undefined>(
    undefined
  );
  const [animNames, setAnimNames] = useState<string[]>([]);
  const [currentAnim, setCurrentAnim] = useState<string | undefined>(undefined);

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
        {/* Left: 3D viewer */}
        <div style={{ width: "100%" }}>
          <ModelViewer
            shirtTexture={shirtTexture}
            animation={currentAnim}
            onAnimationsLoaded={(names) => {
              setAnimNames(names);
              if (!currentAnim) setCurrentAnim(names[0]);
            }}
          />
          {/* Simple animation selector */}
          {animNames.length > 1 && (
            <select
              style={{ marginTop: "var(--space-2)", width: "100%" }}
              value={currentAnim}
              onChange={(e) => setCurrentAnim(e.target.value)}
            >
              {animNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
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
          {loading && <p>Loading…</p>}
          {!loading && products.length === 0 && <p>No products available.</p>}
          {products.map((p) => (
            <Card
              key={p.id}
              clickable
              style={{
                background: "var(--color-bg-elevated)",
                cursor: "pointer",
              }}
              onClick={() => {
                console.log("Preview merch: ", p.name, p.shirtTexture);
                setShirtTexture(p.shirtTexture);
                if (p.defaultAnimation) setCurrentAnim(p.defaultAnimation);
              }}
            >
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
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(p.url, "_blank");
                  }}
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
