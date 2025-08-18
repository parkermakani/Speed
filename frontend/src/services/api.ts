import type { Status, StatusUpdate } from "../types";

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
