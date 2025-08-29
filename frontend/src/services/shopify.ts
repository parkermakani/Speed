// Lightweight Shopify Storefront API integration used only when env vars are present.
// We intentionally avoid the Buy Button UI SDK to keep our own styling.

type Maybe<T> = T | undefined | null;

const SHOPIFY_DOMAIN = (
  import.meta.env.VITE_SHOPIFY_DOMAIN as Maybe<string>
)?.trim();
const SHOPIFY_TOKEN = (
  import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as Maybe<string>
)?.trim();
const COLLECTION_HANDLE = (
  import.meta.env.VITE_SHOPIFY_COLLECTION_HANDLE as Maybe<string>
)?.trim();
const COLLECTION_ID_NUM = (
  import.meta.env.VITE_SHOPIFY_COLLECTION_ID as Maybe<string>
)?.trim();
const COLLECTION_GID = (
  import.meta.env.VITE_SHOPIFY_COLLECTION_GID as Maybe<string>
)?.trim();

export function isShopifyConfigured(): boolean {
  return Boolean(
    SHOPIFY_DOMAIN &&
      SHOPIFY_TOKEN &&
      (COLLECTION_HANDLE || COLLECTION_ID_NUM || COLLECTION_GID)
  );
}

function getStorefrontEndpoint(): string | undefined {
  if (!SHOPIFY_DOMAIN) return undefined;
  return `https://${SHOPIFY_DOMAIN}/api/2024-07/graphql.json`;
}

function toCollectionGid(): string | undefined {
  if (COLLECTION_GID) return COLLECTION_GID;
  if (COLLECTION_ID_NUM && /^\d+$/.test(COLLECTION_ID_NUM)) {
    return `gid://shopify/Collection/${COLLECTION_ID_NUM}`;
  }
  return undefined;
}

async function storefrontQuery<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const endpoint = getStorefrontEndpoint();
  if (!endpoint || !SHOPIFY_TOKEN) throw new Error("Shopify not configured");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (!res.ok || data.errors) {
    throw new Error(`Shopify error: ${JSON.stringify(data.errors || data)}`);
  }
  return data.data as T;
}

export type ShopifyMappedItem = {
  id: string;
  name: string;
  price: string; // formatted with currency symbol
  imageUrl: string;
  url?: string;
  active: boolean;
  shopifyProductId?: string;
  shopifyVariantId?: string;
};

export async function fetchShopifyMerch(): Promise<ShopifyMappedItem[]> {
  if (!isShopifyConfigured()) return [];

  // Prefer handle; fallback to explicit GID/ID
  if (COLLECTION_HANDLE) {
    type Resp = {
      collectionByHandle: {
        products: {
          edges: Array<{ node: ShopifyProductNode }>;
        } | null;
      } | null;
    };
    const data = await storefrontQuery<Resp>(
      /* GraphQL */ `
        query CollectionByHandle($handle: String!, $first: Int!) {
          collectionByHandle(handle: $handle) {
            products(first: $first) {
              edges {
                node {
                  id
                  title
                  handle
                  images(first: 1) {
                    edges {
                      node {
                        url
                        altText
                      }
                    }
                  }
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        price {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      { handle: COLLECTION_HANDLE, first: 50 }
    );
    const nodes =
      data.collectionByHandle?.products?.edges?.map((e) => e.node) || [];
    return nodes.map(mapProductNodeToItem);
  }

  const gid = toCollectionGid();
  if (!gid) return [];
  type Resp = {
    collection: {
      products: { edges: Array<{ node: ShopifyProductNode }> } | null;
    } | null;
  };
  const data = await storefrontQuery<Resp>(
    /* GraphQL */ `
      query CollectionById($id: ID!, $first: Int!) {
        collection(id: $id) {
          products(first: $first) {
            edges {
              node {
                id
                title
                handle
                images(first: 1) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      id
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { id: gid, first: 50 }
  );
  const nodes = data.collection?.products?.edges?.map((e) => e.node) || [];
  return nodes.map(mapProductNodeToItem);
}

type ShopifyProductNode = {
  id: string;
  title: string;
  handle: string;
  images: { edges: Array<{ node: { url: string; altText?: string | null } }> };
  variants: {
    edges: Array<{
      node: { id: string; price: { amount: string; currencyCode: string } };
    }>;
  };
};

function formatMoney(amount: string, currencyCode: string): string {
  const n = Number(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode as any,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(isFinite(n) ? n : 0);
  } catch {
    return `$${amount}`;
  }
}

function mapProductNodeToItem(node: ShopifyProductNode): ShopifyMappedItem {
  const img = node.images.edges[0]?.node?.url || "";
  const v0 = node.variants.edges[0]?.node;
  const price = v0
    ? formatMoney(v0.price.amount, v0.price.currencyCode)
    : "$0.00";
  return {
    id: node.id,
    name: node.title,
    price,
    imageUrl: img,
    url: SHOPIFY_DOMAIN
      ? `https://${SHOPIFY_DOMAIN}/products/${node.handle}`
      : undefined,
    active: true,
    shopifyProductId: node.id,
    shopifyVariantId: v0?.id,
  };
}

export async function createShopifyCheckout(
  lineItems: Array<{ variantId: string; quantity: number }>
): Promise<string> {
  // Returns checkout webUrl
  type Resp = {
    checkoutCreate: {
      checkout: { webUrl: string } | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  };
  const data = await storefrontQuery<Resp>(
    /* GraphQL */ `
      mutation CreateCheckout($lineItems: [CheckoutLineItemInput!]!) {
        checkoutCreate(input: { lineItems: $lineItems }) {
          checkout {
            webUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    { lineItems }
  );
  const url = data.checkoutCreate.checkout?.webUrl;
  if (!url)
    throw new Error(
      `Shopify checkoutCreate failed: ${JSON.stringify(
        data.checkoutCreate.userErrors
      )}`
    );
  return url;
}
