/**
 * src/routers/curriculum.router.ts
 * ======================================================
 * Base path: /api/curriculum
 *
 * - GET    /              list
 * - GET    /:id           getById
 * - POST   /              create
 * - PUT    /:id           update
 * - DELETE /:id           remove
 */
import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as c from "../controllers/curriculum.controller";

const router = Router();
router.use(authGuard);

router.get("/", c.list);
router.get("/:id", c.getById);
router.post("/", c.create);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

export default router;
