/**
 * src/routers/validationRuns.router.ts
 * ======================================================
 * Base path: /api/validation-runs
 *
 * - GET /?studyPlanId=    list
 * - GET /:id              getById
 *
 * หมายเหตุ:
 * - การสร้าง run จริง ๆ จะทำผ่าน /study-plans/:id/validate (MVP)
 */
import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as c from "../controllers/validationRuns.controller";

const router = Router();
router.use(authGuard);

router.get("/", c.list);
router.get("/:id", c.getById);

export default router;
