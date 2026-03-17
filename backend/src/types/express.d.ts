/**
 * src/types/express.d.ts
 * ======================================================
 * ขยายชนิดข้อมูลของ Express.Request เพื่อให้รองรับ req.user
 *
 * ระบบนี้เป็น Student-only:
 * - JWT payload หลักจะมี userId (UserAccount.id) และ studentCode (ใช้ล็อกอิน)
 * - เพื่อให้เรียก API ที่ผูกกับ StudentProfile ได้สะดวก เราใส่ studentProfileId เพิ่มด้วย
 *
 * หมายเหตุ:
 * - studentProfileId อาจไม่มีใน token เก่า ๆ (เผื่อมี token ที่ออกก่อนแก้ระบบ)
 *   middleware จะพยายาม lookup ให้ และใส่ให้ก่อนส่งต่อ
 */
export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;             // id ของ UserAccount
        studentCode: string;        // รหัสนักศึกษา (ใช้แทน username)
        studentProfileId?: number;  // id ของ StudentProfile (ใช้กับ Transcript/StudyPlan ที่ผูกกับ student)
      };
    }
  }
}
