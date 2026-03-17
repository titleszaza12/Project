import { fetchWithAuth, backendBaseUrl } from "@/lib/api";

export async function getMyTranscript() {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/transcripts/me`, { method: "GET" });
  return res.json();
}

export async function getMyGpa() {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/transcripts/me/gpa`, { method: "GET" });
  return res.json();
}
