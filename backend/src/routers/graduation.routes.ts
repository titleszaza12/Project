import { Router } from "express";
import { getGraduationSummary } from "../controllers/graduation.controller";
import { authGuard } from "../middlewares/auth.middleware";

const router = Router();

// server.ts mount ไว้ที่ /api/graduation แล้ว
// ดังนั้น path ที่นี่คือ /:planId/summary
router.get("/:planId/summary", authGuard, getGraduationSummary);

export default router;