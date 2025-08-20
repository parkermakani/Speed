import type { Status, StatusUpdate } from "../types";
import type { City, JourneyResponse, SleepResponse, Settings } from "../types";

const API_BASE_URL = window.location.origin;

const HIDE = (import.meta.env.VITE_HIDE_CITIES ?? "false") === "true";

async function fetchAllCitiesRaw(): Promise<City[]> {
  const response = await fetch(`${API_BASE_URL}/api/cities`);
  if (!response.ok)
    throw new ApiError(response.status, "Failed to fetch cities");
  return (await response.json()) as City[];
}

function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

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
  username?: string;
  likeCount?: number;
  likes?: number;
  timestamp?: string;
}

export async function fetchCityPosts(cityId: number): Promise<SocialPost[]> {
  const res = await fetch(`${API_BASE_URL}/api/cities/${cityId}/posts`);
  if (!res.ok) throw new ApiError(res.status, "Failed to fetch city posts");
  const data: SocialPost[] = await res.json();
  return data;
}

export async function runScrape(
  cityId: number,
  token: string
): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/api/cities/${cityId}/scrape`, {
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
  return data.saved as number;
}

// ---------------- Settings ----------------

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch(`${API_BASE_URL}/api/settings`);
  if (!res.ok) throw new ApiError(res.status, "Failed to fetch settings");
  return await res.json();
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
