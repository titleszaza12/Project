import { fetchWithAuth, backendBaseUrl } from "@/lib/api";

export async function searchCourses(params: { curriculumId?: number; q?: string }) {
  const base = backendBaseUrl();
  const usp = new URLSearchParams();
  if (params.curriculumId) usp.set("curriculumId", String(params.curriculumId));
  if (params.q) usp.set("q", params.q);

  const res = await fetchWithAuth(`${base}/api/courses?${usp.toString()}`, { method: "GET" });
  return res.json();
}

/**
 * GET /api/courses?curriculumId=&groupId=&q=
 * (อ้างอิงจาก backend: src/routers/courses.router.ts)
 */
export async function getCourses(params: {
  curriculumId: number;
  groupId?: number | null;
  q?: string;
}) {
  const base = backendBaseUrl();
  const usp = new URLSearchParams();
  usp.set("curriculumId", String(params.curriculumId));
  if (params.groupId) usp.set("groupId", String(params.groupId));
  if (params.q) usp.set("q", params.q);

  const res = await fetchWithAuth(`${base}/api/courses?${usp.toString()}`, { method: "GET" });
  return res.json();
}

/**
 * GET /api/course-groups?curriculumId=
 * (อ้างอิงจาก backend: src/routers/courseGroups.router.ts)
 */
export async function getCourseGroups(curriculumId: number) {
  const base = backendBaseUrl();
  const usp = new URLSearchParams();
  usp.set("curriculumId", String(curriculumId));

  const res = await fetchWithAuth(`${base}/api/course-groups?${usp.toString()}`, { method: "GET" });
  return res.json();
}

export async function getCourse(id: number) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/courses/${id}`, { method: "GET" });
  return res.json();
}
