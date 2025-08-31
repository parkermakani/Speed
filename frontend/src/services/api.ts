import type { Status, StatusUpdate } from "../types";
import type { City, JourneyResponse, SleepResponse, Settings } from "../types";

// Determine base URL for API calls.
// Use explicit VITE_API_BASE_URL when provided (handy for local dev when the
// frontend runs on a different port than the backend). Fallback to the current
// origin so that production builds served by FastAPI continue to work without
// extra configuration.
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  window.location.origin;
const API_ORIGIN = new URL(API_BASE_URL).origin;

const HIDE = (import.meta.env.VITE_HIDE_CITIES ?? "false") === "true";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function fetchStatus(): Promise<Status> {
  const response = await fetch(`${API_BASE_URL}/api/status`);

  if (!response.ok) {
    throw new ApiError(response.status, "Failed to fetch status");
  }

  const data = await response.json();

  const res: Status = {
    ...data,
    cityPolygon: data.cityPolygon ?? data.city_polygon ?? null,
    state: data.state ?? data.state,
  } as Status;

  if (HIDE) {
    res.city = null;
  }

  return res;
}

export async function updateStatus(
  data: StatusUpdate,
  token: string
): Promise<Status> {
  const payload: any = { ...data } as any;
  if (payload.cityPolygon !== undefined) {
    payload.city_polygon = payload.cityPolygon;
    delete payload.cityPolygon;
  }

  // Nothing to transform for state, lat, lng

  const response = await fetch(`${API_BASE_URL}/api/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(
      response.status,
      error.detail || "Failed to update status"
    );
  }

  const resData = await response.json();
  return {
    ...resData,
    cityPolygon: resData.cityPolygon ?? resData.city_polygon ?? null,
  };
}

// -------------------- Journey --------------------

export async function fetchCities(): Promise<City[]> {
  const response = await fetch(`${API_BASE_URL}/api/cities`);
  if (!response.ok) {
    throw new ApiError(response.status, "Failed to fetch cities");
  }
  const data: City[] = await response.json();
  return data;
}

export async function toggleCurrentCity(
  id: number,
  token: string
): Promise<City> {
  const response = await fetch(`${API_BASE_URL}/api/cities/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ is_current: true }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new ApiError(response.status, err.detail || "Failed to update city");
  }
  return await response.json();
}

export async function updateCity(
  id: number,
  payload: Partial<City>,
  token: string
): Promise<City> {
  const res = await fetch(`${API_BASE_URL}/api/cities/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new ApiError(res.status, err.detail || "Failed to update city");
  }
  return await res.json();
}

export async function uploadCityLocatorIcon(
  id: number,
  file: File,
  token: string
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/api/cities/${id}/locator-icon`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      err.detail || "Failed to upload locator icon"
    );
  }
  const data = await res.json();
  return data.url as string;
}

export async function fetchJourney(): Promise<JourneyResponse> {
  const res = await fetch(`${API_BASE_URL}/api/journey`);
  if (!res.ok) {
    throw new ApiError(res.status, "Failed to fetch journey");
  }
  const data: JourneyResponse = await res.json();
  return data;
}

// -------------------- Merch --------------------

export interface MerchItem {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  url?: string;
  active: boolean;
  shirtTexture?: string; // texture file path for model viewer
  defaultAnimation?: string;
  autoDisableAt?: string; // ISO timestamp when the item should auto-disable
  // Optional Shopify linkage when products are sourced from Shopify
  shopifyVariantId?: string;
  shopifyProductId?: string;
}

export async function fetchMerch(): Promise<MerchItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/merch`);
  if (!res.ok) throw new ApiError(res.status, "Failed to fetch merch");
  const items: MerchItem[] = await res.json();
  return items;
}

export async function createMerch(
  item: Omit<MerchItem, "id">,
  token: string
): Promise<MerchItem> {
  const res = await fetch(`${API_BASE_URL}/api/merch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new ApiError(res.status, err.detail || "Failed to create merch");
  }
  return await res.json();
}

export async function updateMerch(
  id: string,
  payload: Partial<MerchItem>,
  token: string
): Promise<MerchItem> {
  const res = await fetch(`${API_BASE_URL}/api/merch/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new ApiError(res.status, err.detail || "Failed to update merch");
  }
  return await res.json();
}

// -------------------- Sleep --------------------

export async function fetchSleep(): Promise<SleepResponse> {
  const res = await fetch(`${API_BASE_URL}/api/sleep`);
  if (!res.ok) throw new ApiError(res.status, "Failed to fetch sleep");
  return await res.json();
}

export async function toggleSleep(
  isSleep: boolean,
  token: string
): Promise<SleepResponse> {
  const res = await fetch(`${API_BASE_URL}/api/sleep`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isSleep }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new ApiError(res.status, err.detail || "Failed to toggle sleep");
  }
  return await res.json();
}

// -------------------- Social Posts --------------------

export interface SocialPost {
  id?: string;
  platform?: string;
  mediaUrl?: string;
  imageUrl?: string; // fallback key
  caption?: string;
  text?: string; // normalized text body; prefer this in UI
  username?: string;
  avatarUrl?: string;
  likeCount?: number;
  likes?: number;
  timestamp?: string;
  url?: string; // link to original post
}

function normalizeCaptionToText(caption?: string): string | undefined {
  if (!caption) return caption;
  try {
    const doc = new DOMParser().parseFromString(caption, "text/html");
    const tiktokSection = doc.querySelector("blockquote.tiktok-embed section");
    const target = tiktokSection || doc.body;
    const text = target.textContent?.trim() || "";
    return text || undefined;
  } catch {
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = caption;
      const text = (tmp.textContent || tmp.innerText || "").trim();
      return text || undefined;
    } catch {
      return caption;
    }
  }
}

export async function fetchCityPosts(cityId: number): Promise<SocialPost[]> {
  const res = await fetch(`${API_BASE_URL}/api/cities/${cityId}/posts`);
  if (!res.ok) throw new ApiError(res.status, "Failed to fetch city posts");
  const data: SocialPost[] = await res.json();
  // Normalize `text` from curator `caption` (e.g., TikTok embeds -> section text)
  return data.map((p) => ({ ...p, text: normalizeCaptionToText(p.caption) }));
}

export async function fetchAllPosts(): Promise<SocialPost[]> {
  const res = await fetch(`${API_BASE_URL}/api/posts`);
  if (!res.ok) throw new ApiError(res.status, "Failed to fetch posts");
  const data: SocialPost[] = await res.json();
  // Swap media/avatar URLs to proxy endpoint to avoid CORS issues and normalize `text` from `caption`
  return data.map((p) => ({
    ...p,
    mediaUrl: p.mediaUrl
      ? `${API_ORIGIN}/api/proxy-media?url=${encodeURIComponent(p.mediaUrl)}`
      : p.mediaUrl,
    imageUrl: p.imageUrl
      ? `${API_ORIGIN}/api/proxy-media?url=${encodeURIComponent(p.imageUrl)}`
      : p.imageUrl,
    avatarUrl: p.avatarUrl
      ? `${API_ORIGIN}/api/proxy-media?url=${encodeURIComponent(p.avatarUrl)}`
      : p.avatarUrl,
    text: normalizeCaptionToText(p.caption),
  }));
}

export async function runScrape(
  cityId: number,
  token: string,
  opts?: { ignoreTime?: boolean; noCap?: boolean }
): Promise<number> {
  const params: string[] = [];
  if (opts?.ignoreTime) params.push("ignoreTime=1");
  if (opts?.noCap) params.push("noCap=1");
  const qs = params.length ? `?${params.join("&")}` : "";
  console.debug(
    "[runScrape] cityId=%s ignoreTime=%s noCap=%s",
    cityId,
    opts?.ignoreTime,
    opts?.noCap
  );
  const res = await fetch(`${API_BASE_URL}/api/cities/${cityId}/scrape${qs}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new ApiError(res.status, err.detail || "Failed to run scrape");
  }
  const data = await res.json();
  console.debug("[runScrape] response", data);
  return data.saved as number;
}

export async function runScrapeAll(
  token: string,
  opts?: { ignoreTime?: boolean }
): Promise<number> {
  const params: string[] = [];
  if (opts?.ignoreTime) params.push("ignoreTime=1");
  const qs = params.length ? `?${params.join("&")}` : "";
  console.debug("[runScrapeAll] ignoreTime=%s", opts?.ignoreTime);
  const res = await fetch(`${API_BASE_URL}/api/scrape-all${qs}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.detail || "Failed to run scrape-all");
  }
  const data = await res.json();
  console.debug("[runScrapeAll] response", data);
  return data && typeof data.saved === "number" ? data.saved : 0;
}

// ---------------- Settings ----------------

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch(`${API_BASE_URL}/api/settings`);
  if (!res.ok) throw new ApiError(res.status, "Failed to fetch settings");
  const data = await res.json();
  // Ensure boolean fallback for disableMerch
  if (typeof data.disableMerch === "undefined") data.disableMerch = false;
  if (typeof data.sleepHideUserBar === "undefined")
    data.sleepHideUserBar = false;
  return data as Settings;
}

export async function updateSettings(
  payload: Partial<Settings>,
  token: string
): Promise<Settings> {
  const res = await fetch(`${API_BASE_URL}/api/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new ApiError(res.status, err.detail || "Failed to update settings");
  }
  return await res.json();
}
