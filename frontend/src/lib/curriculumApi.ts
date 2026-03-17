import { fetchWithAuth, backendBaseUrl } from "@/lib/api";

export async function getCurriculum() {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/curriculum`, { method: "GET" });
  return res.json();
}

export async function getCreditRequirements(curriculumId: number) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(
    `${base}/api/credit-requirements?curriculumId=${encodeURIComponent(String(curriculumId))}`,
    { method: "GET" },
  );
  return res.json();
}
