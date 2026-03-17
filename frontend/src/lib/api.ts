/* eslint-disable @typescript-eslint/no-explicit-any */
let ACCESS_TOKEN = "";

export function setAccessToken(token: string) {
  ACCESS_TOKEN = token;
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
  }
}

// ใช้ตอน Logout / token หมดอายุ
export function clearAccessToken() {
  ACCESS_TOKEN = "";
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
  }
}

export function backendBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) return apiUrl.replace(/\/$/, "");

  const host = process.env.NEXT_PUBLIC_BACKEND_HOST || "http://localhost";
  const port = process.env.NEXT_PUBLIC_BACKEND_PORT || "3001";
  return `${host}:${port}`;
}

export async function fetchWithAuth(path: string, init: RequestInit = {}) {
  const token =
    ACCESS_TOKEN ||
    (typeof window !== "undefined" ? localStorage.getItem("token") || "" : "");

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Ensure JSON requests are parsed by Express (requires Content-Type: application/json).
  // Many calls pass body: JSON.stringify(...). Without this header, req.body may be empty.
  const body: any = (init as any).body;
  if (!headers.has("Content-Type") && typeof body === "string") {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  const url =
    path.startsWith("http")
      ? path
      : `${backendBaseUrl()}${path.startsWith("/api") ? "" : "/api"}${path.startsWith("/") ? "" : "/"}${path}`;

  return fetch(url, { ...init, headers });
}

// ===== Dashboard APIs (ของจริง) =====
export async function getDashboardSummary() {
  const res = await fetchWithAuth("/api/dashboard/summary");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCreditBreakdown() {
  const res = await fetchWithAuth("/api/dashboard/credit-breakdown");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


// ===== Upload APIs =====
export async function uploadProfileImage(file: File) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetchWithAuth("/api/uploads/profile-image", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ fileId: number; profileImageUrl: string }>;
}
