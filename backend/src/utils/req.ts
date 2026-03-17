/**
 * src/utils/req.ts
 * ======================================================
 * Helper สำหรับ "ดึงค่า param/query" ให้เป็น string เดียว
 *
 * ทำไมต้องมีไฟล์นี้?
 * - ใน Express v5 type ของ req.params / req.query อาจเป็น:
 *   string | string[] | undefined
 * - แต่ Prisma ต้องการ string (หรือ undefined/null ตาม field)
 * - ถ้าไม่แปลง TypeScript จะ error และบางที runtime ก็พังได้
 */

/** คืนค่า string ตัวแรก ถ้าเป็น array / ถ้าไม่มีคืน undefined */
export function pickFirst(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : undefined;
  return undefined;
}

/**
 * คืนค่า string ตัวแรก แต่ถ้าไม่มีให้ throw error พร้อม message
 * ใช้กับ path params ที่ "ต้องมี" เช่น /courses/:id
 */
export function pickFirstOrThrow(v: unknown, fieldName: string): string {
  const s = pickFirst(v);
  if (!s) {
    const err: any = new Error(`พารามิเตอร์ '${fieldName}' ไม่ถูกต้องหรือไม่มีค่า`);
    err.status = 400;
    throw err;
  }
  return s;
}
