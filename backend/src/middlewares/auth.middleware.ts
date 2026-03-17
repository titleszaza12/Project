/**
 * src/middlewares/auth.middleware.ts
 * ======================================================
 * Middleware ตรวจสอบการเข้าสู่ระบบ (Authentication)
 *
 * Frontend ต้องส่ง header:
 *   Authorization: Bearer <token>
 *
 * หน้าที่ของไฟล์นี้:
 * 1) ตรวจ token ว่าถูกต้องหรือไม่
 * 2) ถ้าถูกต้อง -> ใส่ข้อมูลผู้ใช้ลง req.user เพื่อให้ controller ใช้ต่อได้
 *
 * ระบบนี้เป็น Student-only:
 * - ไม่มี role / allowRoles
 *
 * โครง req.user ที่เราใช้:
 * - userId            : UserAccount.id
 * - studentCode       : รหัสนักศึกษา (ใช้ล็อกอิน)
 * - studentProfileId  : StudentProfile.id (ใช้ผูก Transcript/StudyPlan)
 *
 * หมายเหตุ:
 * - เพื่อความเข้ากันได้กับ token เก่า ๆ:
 *   ถ้า payload ไม่มี studentProfileId เราจะ lookup จาก DB ให้
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";

type JwtPayload = {
  userId: number;
  studentCode?: string;        // เวอร์ชันใหม่
  username?: string;           // เผื่อ token รุ่นเก่า (username=studentCode)
  studentProfileId?: number;   // เวอร์ชันใหม่
  iat?: number;
  exp?: number;
};

function getToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  if (!h.startsWith("Bearer ")) return null;
  return h.slice(7).trim();
}

export async function authGuard(req: Request, res: Response, next: NextFunction) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ (ไม่พบ token)" });

  try {
    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const payload = jwt.verify(token, secret) as JwtPayload;

    const studentCode = payload.studentCode ?? payload.username;
    if (!studentCode) {
      return res.status(401).json({ message: "token ไม่สมบูรณ์ (ไม่พบ studentCode)" });
    }

    // ใส่ user พื้นฐานก่อน
    req.user = { userId: payload.userId, studentCode, studentProfileId: payload.studentProfileId };

    // ถ้า token ไม่มี studentProfileId -> lookup จาก DB เพื่อให้ controller ใช้ต่อได้
    if (!req.user.studentProfileId) {
      const u = await prisma.userAccount.findUnique({
        where: { id: payload.userId },
        include: { studentProfile: true },
      });

      if (!u || !u.studentProfile) {
        return res.status(401).json({ message: "ไม่พบโปรไฟล์นักศึกษา" });
      }

      req.user.studentProfileId = u.studentProfile.id;
    }

    return next();
  } catch {
    return res.status(401).json({ message: "token ไม่ถูกต้องหรือหมดอายุ" });
  }
}
