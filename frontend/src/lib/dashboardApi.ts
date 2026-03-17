/**
 * src/lib/dashboardApi.ts
 * --------------------------------------------------------------------------
 * รวม API ที่หน้า Dashboard ใช้
 *
 * - fetchCreditBreakdown(): พยายามเรียก endpoint สรุปเครดิตโดยหมวด
 *   ถ้า backend ยังไม่มี endpoint นี้ จะ fallback เป็นค่า null เพื่อให้หน้าไม่พัง
 *
 * - updateProfileImageUrl(): อัปเดตรูปโปรไฟล์เป็น dataURL (base64) หรือ URL
 *   ฟังก์ชันนี้ลองยิงหลาย endpoint เผื่อชื่อ route ใน backend ต่างกัน
 */

import { backendBaseUrl, fetchWithAuth } from "@/lib/api";

export type CreditCategoryKey = "GENERAL" | "MAJOR_REQUIRED" | "MAJOR_ELECTIVE" | "FREE_ELECTIVE";

export type CreditBreakdown = {
  total: { earned: number | null; required: number | null };
  byCategory: Record<CreditCategoryKey, { nameTH: string; earned: number | null; required: number | null }>;
};

export async function fetchCreditBreakdown(): Promise<CreditBreakdown> {
  try {
    const res = await fetchWithAuth(`${backendBaseUrl()}/api/dashboard/credit-breakdown`, { method: "GET" });
    if (res.ok) return (await res.json()) as CreditBreakdown;
  } catch {}

  return {
    total: { earned: null, required: null },
    byCategory: {
      GENERAL: { nameTH: "วิชาศึกษาทั่วไป", earned: null, required: null },
      MAJOR_REQUIRED: { nameTH: "วิชาเฉพาะ (เอกบังคับ)", earned: null, required: null },
      MAJOR_ELECTIVE: { nameTH: "วิชาเลือก (เอกเลือก)", earned: null, required: null },
      FREE_ELECTIVE: { nameTH: "วิชาเสรี", earned: null, required: null },
    },
  };
}

export async function updateProfileImageUrl(profileImageUrl: string) {
  // NOTE: เดิมเคยอัปเดตเป็น dataURL ด้วย PATCH หลาย endpoint (fallback)
  // ตอนนี้ backend รองรับอัปโหลดไฟล์และเก็บใน DB แล้ว → ให้ใช้ uploadProfileImage แทน
  // ฟังก์ชันนี้คงไว้เพื่อ backward compatibility เฉย ๆ
  try {
    const res = await fetchWithAuth(`${backendBaseUrl()}/api/student-profiles/me`, {
      method: "PATCH",
      body: JSON.stringify({ profileImageUrl }),
    });
    if (res.ok) return await res.json();
  } catch {}

  return null;
}

export async function uploadProfileImage(file: File): Promise<{ fileId: number; url: string } | null> {
  try {
    const form = new FormData();
    form.append("file", file);

    const res = await fetchWithAuth(`${backendBaseUrl()}/api/uploads/profile-image`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) return null;
    const data = await res.json();
    // คาดหวังรูปแบบ: { fileId, url, message }
    if (typeof data?.fileId === "number" && typeof data?.url === "string") return data;
    return data ?? null;
  } catch {
    return null;
  }
}
