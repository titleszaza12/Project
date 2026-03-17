/**
 * src/lib/authApi.ts
 * -----------------------------------------------------------------------------
 * แก้ให้ทนทาน: backend อาจคืน token หลายรูปแบบ (token/accessToken/access_token/jwt หรือซ้อนอยู่ใน data)
 * และ me() คืนรูปแบบ response ไม่เหมือนกันได้ (studentProfile อยู่คนละระดับ)
 */

import { backendBaseUrl, fetchWithAuth, setAccessToken } from "@/lib/api";

export type LoginInput = { studentCode: string; password: string };
export type RegisterInput = {
  studentCode: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findTokenDeep(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;

  const direct =
    obj.token ?? obj.accessToken ?? obj.access_token ?? obj.jwt ?? obj.idToken ?? obj.id_token;
  if (typeof direct === "string" && direct.length > 10) return direct;

  // ไล่ดูชั้นถัดไปแบบจำกัดความลึก เพื่อกัน recursion พัง
  const keys = Object.keys(obj);
  for (const k of keys) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (obj as any)[k];
    if (v && typeof v === "object") {
      const t = findTokenDeep(v);
      if (t) return t;
    }
  }
  return null;
}

/** Login */
export async function apiLogin(input: LoginInput) {
  const res = await fetch(`${backendBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentCode: input.studentCode, password: input.password }),
  });

  // ตาม requirement: ถ้าผิดให้ข้อความรวม ๆ
  if (!res.ok) throw new Error("รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง");

  const data = await res.json().catch(() => ({}));
  const token = findTokenDeep(data);
  if (token) setAccessToken(token);

  return data;
}

/** Register */
export async function apiRegister(input: RegisterInput) {
  const res = await fetch(`${backendBaseUrl()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentCode: input.studentCode,
      firstName: input.firstName,
      lastName: input.lastName,
      password: input.password,
      confirmPassword: input.confirmPassword,
    }),
  });

  const data = await res.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!res.ok) throw new Error((data as any)?.message || "สมัครสมาชิกไม่สำเร็จ");
  return data;
}

/**
 * me(): ดึงข้อมูลผู้ใช้ที่ล็อกอินอยู่
 * - ถ้า 401/403 ให้โยน error พร้อม status เพื่อให้หน้า dashboard ตัดสินใจ redirect
 */
export async function me() {
  const res = await fetchWithAuth(`${backendBaseUrl()}/api/auth/me`, { method: "GET" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: any = new Error((data as any)?.message || "ไม่สามารถดึงข้อมูลผู้ใช้ได้");
    err.status = res.status;
    throw err;
  }

  return data;
}
