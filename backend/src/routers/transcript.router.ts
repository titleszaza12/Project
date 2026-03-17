/**
 * src/routers/transcript.router.ts
 * ======================================================
 * Router สำหรับ Transcript (เกรดจริง)
 *
 * Route base: /api/transcripts
 *
 * Endpoint:
 * - PUT  /api/transcripts/me      -> upsert เกรดรายวิชา (ของตัวเอง)
 * - GET  /api/transcripts/me      -> ดูผลการเรียนทั้งหมด (ของตัวเอง)
 * - GET  /api/transcripts/me/gpa  -> คำนวณ GPA + หน่วยกิตสะสม (ของตัวเอง)
 *
 * หมายเหตุ:
 * - ใช้ authGuard ทุกเส้น เพราะเป็นข้อมูลส่วนตัวของนักศึกษา
 */

import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as c from "../controllers/transcript.controller";

const router = Router();

router.put("/me", authGuard, c.upsertMyTranscript);
router.get("/me", authGuard, c.getMyTranscript);
router.get("/me/gpa", authGuard, c.getMyGPA);

export default router;
