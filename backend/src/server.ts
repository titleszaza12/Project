/**
 * src/server.ts
 * ======================================================
 * ไฟล์นี้คือ "จุดเริ่มต้น" ของ Backend API (Express)
 *
 * หน้าที่หลัก:
 * 1) โหลด .env
 * 2) ตั้งค่า middleware พื้นฐาน (CORS, JSON)
 * 3) Mount Router หลักทั้งหมดไว้ที่ "/api"
 * 4) Health Check สำหรับตรวจว่า server ยังทำงานอยู่
 * 5) Error Handler รวมท้ายสุด
 *
 * ------------------------------------------------------
 * ✅ Endpoint ทั้งหมดที่ Backend ตัวนี้รองรับ
 * ------------------------------------------------------
 *
 * [Health]
 * - GET  /health
 *   ใช้เช็คว่า backend ทำงานอยู่
 *
 * [Auth - Student Only]
 * Base: /api/auth
 * - POST /api/auth/register
 *   สมัครสมาชิกนักศึกษา
 *   body: { studentCode, firstName, lastName, password, profileImageUrl? }
 *
 * - POST /api/auth/login
 *   เข้าสู่ระบบ
 *   body: { studentCode, password }
 *
 * - GET  /api/auth/me
 *   ดึงข้อมูลผู้ใช้จาก token
 *   header: Authorization: Bearer <token>
 *
 * [Curriculum]
 * Base: /api/curriculum
 * - GET  /api/curriculum
 *   ดึงข้อมูลหลักสูตร (ระบบนี้ใช้หลักสูตรเดียวเป็นหลัก)
 *
 * - POST /api/curriculum
 * - PUT  /api/curriculum/:id
 *   (เปิดไว้เพื่อเติมข้อมูลหลักสูตรระหว่างพัฒนา)
 *
 * [Course Groups (หมวด/กลุ่มวิชา)]
 * Base: /api/course-groups
 * - GET    /api/course-groups
 * - GET    /api/course-groups/:id
 * - POST   /api/course-groups
 * - PUT    /api/course-groups/:id
 * - DELETE /api/course-groups/:id
 *
 * [Courses (รายวิชา)]
 * Base: /api/courses
 * - GET    /api/courses?curriculumId=...
 * - GET    /api/courses/:id
 * - POST   /api/courses
 * - PUT    /api/courses/:id
 * - DELETE /api/courses/:id
 *
 * - POST   /api/courses/:id/prerequisites
 *   ตั้ง prerequisite ของรายวิชา
 *   body: { prereqCourseIds: number[] }
 *
 * [Credit Requirements (เกณฑ์หน่วยกิตรายหมวด)]
 * Base: /api/credit-requirements
 * - GET    /api/credit-requirements?curriculumId=...
 * - POST   /api/credit-requirements
 * - PUT    /api/credit-requirements/:id
 * - DELETE /api/credit-requirements/:id
 *
 * [Tracks = แผนการเรียน (COOP / JOB_TRAINING)]
 * Base: /api/tracks
 * - GET  /api/tracks
 *   รายการแผนการเรียนทั้งหมด
 *
 * - GET  /api/tracks/:code/plan
 *   โครงแผนแนะนำของแผนนี้ (เทอม + วิชาบังคับ/แนะนำ + ช่องเลือกจากหมวด)
 *
 * [Study Plans (แผนการเรียนของนักศึกษา)]
 * Base: /api/study-plans   (ต้อง Login)
 * - GET    /api/study-plans
 * - GET    /api/study-plans/:id
 * - POST   /api/study-plans
 * - POST   /api/study-plans/from-track
 *   สร้างแผนเริ่มต้นจาก Track (สร้างเทอม + ใส่วิชาแนะนำเป็น PLANNED)
 *
 * - DELETE /api/study-plans/:id
 *
 * Term:
 * - POST   /api/study-plans/:id/terms
 * - DELETE /api/study-plans/:id/terms/:termId
 *
 * Entry (นักศึกษาเลือกวิชาจริงเอง):
 * - POST   /api/study-plans/:id/terms/:termId/entries
 * - PUT    /api/study-plans/:id/terms/:termId/entries/:entryId
 * - DELETE /api/study-plans/:id/terms/:termId/entries/:entryId
 *
 * Validate (MVP):
 * - POST   /api/study-plans/:id/validate
 *
 * [Validation Rules]
 * Base: /api/validation-rules
 * - GET    /api/validation-rules
 * - POST   /api/validation-rules
 * - PUT    /api/validation-rules/:id
 * - DELETE /api/validation-rules/:id
 *
 * [Validation Runs]
 * Base: /api/validation-runs
 * - GET /api/validation-runs?studyPlanId=...
 * - GET /api/validation-runs/:id
 *
 * ------------------------------------------------------
 * ⚠️ หมายเหตุเรื่อง CORS / Chrome PNA (ที่ตี้เจอ)
 * ------------------------------------------------------
 * ถ้า Frontend เปิดด้วย IP เช่น http://25.x.x.x:3000
 * แล้ว Frontend ยิงไป Backend ที่ http://localhost:3001
 * Chrome จะ block ด้วยกฎ PNA (loopback + insecure context)
 *
 * ✅ วิธีแก้: ให้ใช้ "IP เดียวกัน" ทั้ง frontend/backend
 * เช่น:
 * NEXT_PUBLIC_BACKEND_HOST=http://25.x.x.x
 * NEXT_PUBLIC_BACKEND_PORT=3001
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import router from "./routers";
import uploadsRouter from "./routers/uploads.router";
import { errorHandler } from "./middlewares/error.middleware";
import graduationRoutes from "../src/routers/graduation.routes";

const app = express();

// -------------------- Middleware พื้นฐาน --------------------
// เปิด CORS แบบ dev (เปิดกว้างไว้ก่อน)
// ถ้าต้องการล็อก origin: เปลี่ยน origin เป็น string/array ตามจริง
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// รับ JSON body
app.use(express.json());

// -------------------- Health Check --------------------
app.get("/health", (_req, res) => res.json({ ok: true }));

// -------------------- Mount Routers --------------------
// ทุก API route จะขึ้นต้นด้วย /api
app.use("/api/uploads", uploadsRouter);

// รวม router อื่น ๆ
app.use("/api", router);

app.use("/api/graduation", graduationRoutes);

// -------------------- Error Handler --------------------
app.use(errorHandler);

// -------------------- Start Server --------------------
const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
