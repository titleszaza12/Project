/**
 * src/routers/validationRules.router.ts
 * ======================================================
 * Base path: /api/validation-rules
 *
 * - GET    /
 * - GET    /:id
 * - POST   /
 * - PUT    /:id
 * - DELETE /:id
 */
import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware";
import * as c from "../controllers/validationRules.controller";

const router = Router();
router.use(authGuard);

router.get("/", c.list);
router.get("/:id", c.getById);
router.post("/", c.create);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

export default router;
