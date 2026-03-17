/**
 * src/routers/dashboard.router.ts
 * ======================================================
 * Router สำหรับหน้า Dashboard
 *
 * Endpoint:
 * - GET /api/dashboard/summary
 * - GET /api/dashboard/credit-breakdown
 *
 * หมายเหตุ:
 * - ทั้งหมดต้อง login (ใช้ authGuard)
 */

import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import { getCreditBreakdown, getDashboardSummary } from "../controllers/dashboard.controller";

const router = Router();

router.get("/summary", authGuard, getDashboardSummary);
router.get("/credit-breakdown", authGuard, getCreditBreakdown);

export default router;
