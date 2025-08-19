import type { Status, StatusUpdate } from "../types";
import type { City, JourneyResponse, SleepResponse } from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || window.location.origin;

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

  return {
    ...data,
    cityPolygon: data.cityPolygon ?? data.city_polygon ?? null,
    state: data.state ?? data.state,
  } as Status;
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
  return await response.json();
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
