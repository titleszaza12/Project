/**
 * src/routers/courses.router.ts
 * ======================================================
 * Base path: /api/courses
 *
 * - GET    /?curriculumId=&groupId=&q=
 * - GET    /:id
 * - POST   /
 * - PUT    /:id
 * - DELETE /:id
 *
 * Prerequisites:
 * - POST   /:id/prerequisites
 * - DELETE /:id/prerequisites/:pid
 */
import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as c from "../controllers/courses.controller";

const router = Router();
router.use(authGuard);

router.get("/", c.list);
router.get("/:id", c.getById);
router.post("/", c.create);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

router.post("/:id/prerequisites", c.addPrerequisite);
router.delete("/:id/prerequisites/:pid", c.removePrerequisite);

export default router;
