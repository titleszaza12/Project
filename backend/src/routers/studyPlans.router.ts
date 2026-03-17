/**
 * src/routers/studyPlans.router.ts
 * ======================================================
 * Base path: /api/study-plans
 *
 * - GET    /                         listMyPlans
 * - GET    /:id                      getMyPlanById
 * - POST   /                         createPlan
 * - POST   /from-track               createPlanFromTrack
 * - DELETE /:id                      deletePlan
 *
 * Term:
 * - POST   /:id/terms                addTerm
 * - DELETE /:id/terms/:termId        removeTerm
 * - POST   /:id/add-term-from-track  addTermFromTrack   ✅ (เพิ่มเทอมจาก Track เข้าแผนเดิม)
 *
 * Entry:
 * - POST   /:id/terms/:termId/entries                    addEntry
 * - PUT    /:id/terms/:termId/entries/:entryId           updateEntry
 * - DELETE /:id/terms/:termId/entries/:entryId           removeEntry
 *
 * Validate:
 * - POST   /:id/validate              validatePlan
 */
import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as c from "../controllers/studyPlans.controller";

const router = Router();
router.use(authGuard);

// สร้างแผนจาก template ต้องวางก่อน "/:id" เพื่อไม่ให้ชน route
router.post("/from-track", c.createPlanFromTrack);

router.get("/", c.listMyPlans);
router.get("/:id", c.getMyPlanById);
router.post("/", c.createPlan);
router.delete("/:id", c.deletePlan);

// ✅ เพิ่มเทอมจาก Track เข้าแผนเดิม (แก้ 404 Cannot POST /api/study-plans/:id/add-term-from-track)
router.post("/:id/add-term-from-track", c.addTermFromTrack);

router.post("/:id/terms", c.addTerm);
router.delete("/:id/terms/:termId", c.removeTerm);

router.post("/:id/terms/:termId/entries", c.addEntry);
router.put("/:id/terms/:termId/entries/:entryId", c.updateEntry);
router.delete("/:id/terms/:termId/entries/:entryId", c.removeEntry);

router.post("/:id/validate", c.validatePlan);

export default router;
