/**
 * src/routers/index.ts
 * ======================================================
 * รวม router ทุกโมดูลไว้ในที่เดียว แล้วให้ server.ts mount ที่ /api
 *
 * ตัวอย่าง:
 *   app.use("/api", router)
 *   -> /api/auth/login
 *   -> /api/courses
 */
import { Router } from "express";

import authRouter from "./auth.router";
import curriculumRouter from "./curriculum.router";
import coursesRouter from "./courses.router";
import courseGroupsRouter from "./courseGroups.router";
import creditRequirementsRouter from "./creditRequirements.router";
import studyPlansRouter from "./studyPlans.router";
import validationRulesRouter from "./validationRules.router";
import validationRunsRouter from "./validationRuns.router";
import tracksRouter from "./tracks.router";
import transcriptRouter from "./transcript.router";
import dashboardRouter from "./dashboard.router";
import uploadsRouter from "./uploads.router";

const router = Router();

router.use("/auth", authRouter);

router.use("/curriculum", curriculumRouter);
router.use("/courses", coursesRouter);
router.use("/course-groups", courseGroupsRouter);
router.use("/credit-requirements", creditRequirementsRouter);

router.use("/study-plans", studyPlansRouter);

// Transcript (เกรดจริง) และ GPA สำหรับ Dashboard/ตรวจจบ
router.use("/transcripts", transcriptRouter);
router.use("/validation-rules", validationRulesRouter);
router.use("/validation-runs", validationRunsRouter);

router.use("/tracks", tracksRouter);

// Dashboard (สรุปข้อมูลจริงสำหรับหน้าแรกหลัง login)
router.use("/dashboard", dashboardRouter);

// Uploads (เช่น รูปโปรไฟล์ เก็บ binary ใน DB)
router.use("/uploads", uploadsRouter);

export default router;
