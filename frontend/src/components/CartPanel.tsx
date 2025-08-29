import React from "react";
import { useCart } from "../hooks/useCart";
import { Button } from "./primitives/Button";
import { Card } from "./primitives/Card";
import {
  isShopifyConfigured,
  createShopifyCheckout,
} from "../services/shopify";

export const CartPanel: React.FC = () => {
  const { items, removeItem, setQuantity, clear } = useCart();

  const handleCheckout = async () => {
    if (isShopifyConfigured()) {
      try {
        // Our cart items may or may not have Shopify variant IDs; skip those without
        const lineItems = items
          .map((i) => ({
            variantId: (i as any).shopifyVariantId as string | undefined,
            quantity: i.quantity,
          }))
          .filter((li) => li.variantId && li.quantity > 0) as Array<{
          variantId: string;
          quantity: number;
        }>;

        if (lineItems.length === 0) {
          // Fallback to summary if nothing mappable
          const summary = items
            .map((i) => `${i.quantity} x ${i.name} (${i.price})`)
            .join(", ");
          // eslint-disable-next-line no-console
          console.log("Checkout items (no Shopify variants found):", summary);
          alert(
            `Checkout items (no Shopify variants found):\n${items
              .map((i) => `${i.quantity} x ${i.name} (${i.price})`)
              .join("\n")}`
          );
          return;
        }

        const url = await createShopifyCheckout(lineItems);
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Shopify checkout failed:", err);
        // fall through to summary alert
      }
    }

    const summary = items
      .map((i) => `${i.quantity} x ${i.name} (${i.price})`)
      .join(", ");
    // eslint-disable-next-line no-console
    console.log("Checkout items:", summary);
    alert(
      `Checkout items:\n${items
        .map((i) => `${i.quantity} x ${i.name} (${i.price})`)
        .join("\n")}`
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      {items.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          {items.map((it) => (
            <Card key={it.id}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <img
                  src={it.imageUrl}
                  alt={it.name}
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: "cover",
                    borderRadius: 8,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{it.name}</div>
                  <div style={{ color: "var(--color-text-secondary)" }}>
                    {it.price}
                  </div>
                </div>
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) =>
                    setQuantity(it.id, Math.max(1, Number(e.target.value) || 1))
                  }
                  style={{ width: 64 }}
                  aria-label={`Quantity for ${it.name}`}
                />
                <Button variant="secondary" onClick={() => removeItem(it.id)}>
                  Remove
                </Button>
              </div>
            </Card>
          ))}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={clear}>
              Clear
            </Button>
            <Button variant="primary" onClick={handleCheckout}>
              Checkout
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
