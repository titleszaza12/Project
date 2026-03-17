/**
 * src/routers/creditRequirements.router.ts
 * ======================================================
 * Base path: /api/credit-requirements
 *
 * - GET    /?curriculumId=
 * - GET    /:id
 * - POST   /
 * - PUT    /:id
 * - DELETE /:id
 */
import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as c from "../controllers/creditRequirements.controller";

const router = Router();
router.use(authGuard);

router.get("/", c.list);
router.get("/:id", c.getById);
router.post("/", c.create);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

export default router;
