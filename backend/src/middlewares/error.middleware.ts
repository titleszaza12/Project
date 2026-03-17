/**
 * src/middlewares/error.middleware.ts
 * ======================================================
 * Error handler กลาง (ตอบ JSON)
 *
 * วิธีใช้:
 * - ใน server.ts: app.use(errorHandler) ไว้ท้ายสุด
 * - ใน controller: ถ้า throw error -> จะมาจบที่นี่
 */
import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = Number(err?.status || 500);
  const message = err?.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์";

  const payload: any = { message };
  if (process.env.NODE_ENV !== "production" && err?.stack) payload.stack = err.stack;

  return res.status(status).json(payload);
}
