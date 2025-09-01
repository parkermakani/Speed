// Minimal Shopify service to satisfy imports and allow optional enablement
// without breaking the app when Shopify isn't configured.

export interface ShopifyItem {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  url?: string;
  active: boolean;
  shopifyProductId?: string;
  shopifyVariantId?: string;
}

const SHOPIFY_DOMAIN =
  (import.meta.env.VITE_SHOPIFY_DOMAIN as string | undefined) || "";
const SHOPIFY_STOREFRONT_TOKEN =
  (import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as string | undefined) || "";
const SHOPIFY_ENABLED =
  (import.meta.env.VITE_SHOPIFY_ENABLE as string | undefined) === "true";

export function isShopifyConfigured(): boolean {
  return Boolean(SHOPIFY_ENABLED && SHOPIFY_DOMAIN && SHOPIFY_STOREFRONT_TOKEN);
}

// Placeholder: return empty list unless we wire real Storefront queries.
export async function fetchShopifyMerch(): Promise<ShopifyItem[]> {
  if (!isShopifyConfigured()) return [];
  // Intentionally return empty for now. When enabling, implement Storefront fetch here.
  return [];
}

export async function createShopifyCheckout(
  lineItems: Array<{ variantId: string; quantity: number }>
): Promise<string> {
  if (!isShopifyConfigured()) {
    throw new Error("Shopify is not configured");
  }

  // Build a cart URL as a simple, dependency-free fallback.
  // Format: https://{domain}/cart/VARIANT:QTY,VARIANT:QTY
  const sanitized = lineItems
    .filter((li) => li.variantId && li.quantity > 0)
    .map(
      (li) =>
        `${encodeURIComponent(li.variantId)}:${Math.max(
          1,
          Math.floor(li.quantity)
        )}`
    );

  if (sanitized.length === 0) {
    throw new Error("No valid Shopify line items");
  }

  return `https://${SHOPIFY_DOMAIN}/cart/${sanitized.join(",")}`;
}
