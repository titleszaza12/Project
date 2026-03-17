import { fetchWithAuth, backendBaseUrl } from "@/lib/api";

export async function listStudyPlans() {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/study-plans`, { method: "GET" });
  return res.json();
}

export async function getStudyPlan(id: number) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/study-plans/${id}`, { method: "GET" });
  return res.json();
}

export async function deleteStudyPlan(id: number) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/study-plans/${id}`, { method: "DELETE" });
  return res.json();
}

export async function addTermFromTrack(
  studyPlanId: number,
  payload: { trackCode: string; termYear: number; termNo: number }
) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/study-plans/${studyPlanId}/add-term-from-track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function createPlanFromTrack(payload: { trackCode: string; planId?: string; planName?: string }) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/study-plans/from-track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function addEntry(
  studyPlanId: number,
  termId: number,
  payload: { courseId: number; status?: string }
) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(
    `${base}/api/study-plans/${studyPlanId}/terms/${termId}/entries`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    }
  );
  return res.json();
}


export async function updateEntry(
  studyPlanId: number,
  termId: number,
  entryId: number,
  payload: { status?: string; grade?: string | null; earnedCredits?: number | null }
) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(
    `${base}/api/study-plans/${studyPlanId}/terms/${termId}/entries/${entryId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = (data as any)?.message || "อัปเดตเกรดไม่สำเร็จ";
    throw new Error(msg);
  }
  return data;
}


export async function deleteEntry(studyPlanId: number, termId: number, entryId: number) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(
    `${base}/api/study-plans/${studyPlanId}/terms/${termId}/entries/${entryId}`,
    { method: "DELETE" }
  );
  return res.json();
}

export async function validatePlan(studyPlanId: number) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/study-plans/${studyPlanId}/validate`, {
    method: "POST",
  });
  return res.json();
}

export async function listTracks() {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/tracks`, { method: "GET" });
  return res.json();
}

/** ✅ เพิ่มให้ตรงกับหน้า plan */
export const getTracks = listTracks;

/** ✅ เพิ่ม: ดึงแผนตาม trackCode */
export async function getTrackPlan(trackCode: string) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/tracks/${encodeURIComponent(trackCode)}/plan`, {
    method: "GET",
  });
  return res.json();
}

/**
 * บันทึกผลการเรียนจริง (Transcript) ของตัวเอง
 * Backend: PUT /api/transcripts/me
 * - grade: "A","B+",...,"F" หรือ "-" (หมายถึง null)
 * - yearNo/termNo: ใช้ค่าปี/เทอมของแผนที่กำลังแก้
 */
export async function upsertMyTranscript(payload: {
  courseId: number;
  yearNo: number;
  termNo: number;
  grade: string;
  credits?: number;
}) {
  const base = backendBaseUrl();
  const res = await fetchWithAuth(`${base}/api/transcripts/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = (data as any)?.message || "บันทึก Transcript ไม่สำเร็จ";
    throw new Error(msg);
  }
  return data;
}
