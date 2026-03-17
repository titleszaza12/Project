/**
 * src/routers/courseGroups.router.ts
 * ======================================================
 * Base path: /api/course-groups
 *
 * - GET    /?curriculumId=1        list
 * - GET    /:id                    getById
 * - POST   /                       create
 * - PUT    /:id                    update
 * - DELETE /:id                    remove
 */
import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as c from "../controllers/courseGroups.controller";

const router = Router();
router.use(authGuard);

router.get("/", c.list);
router.get("/:id", c.getById);
router.post("/", c.create);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

export default router;
