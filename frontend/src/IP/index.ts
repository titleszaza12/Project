/**
 * ------------------------------------------------------
 * ไฟล์รวม IP / Base URL ของระบบ (Frontend ใช้เรียก API)
 *
 * แนวคิด:
 * - เก็บค่า host/port ไว้จุดเดียว แก้ที่เดียวทั้งโปรเจกต์
 * - ดึงค่าจาก .env.local เป็นหลัก เพื่อรองรับ Docker/Deploy
 * - มี fallback (ค่า default) เผื่อไม่ได้ตั้ง env
 *
 * วิธีใช้:
 *   import { BASE_URL, API } from "@/IP";
 *   fetch(API.AUTH_LOGIN, { ... })
 * ------------------------------------------------------
 */

export const IP = {
  BACKEND_HOST: process.env.NEXT_PUBLIC_BACKEND_HOST ?? "http://localhost",
  BACKEND_PORT: process.env.NEXT_PUBLIC_BACKEND_PORT ?? "3001",
} as const;

export const BASE_URL = {
  BACKEND: `${IP.BACKEND_HOST}:${IP.BACKEND_PORT}`,
} as const;

/**
 * รวม endpoint ที่ใช้บ่อย (กันพิมพ์ URL ผิด)
 * หมายเหตุ: backend ของเรามี prefix /api
 */
export const API = {
  HEALTH: `${BASE_URL.BACKEND}/health`,
  AUTH_LOGIN: `${BASE_URL.BACKEND}/api/auth/login`,
  AUTH_REGISTER: `${BASE_URL.BACKEND}/api/auth/register`,
  AUTH_ME: `${BASE_URL.BACKEND}/api/auth/me`,
} as const;
