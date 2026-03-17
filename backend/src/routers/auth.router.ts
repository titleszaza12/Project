/**
 * src/routers/auth.router.ts
 * ======================================================
 * Router สำหรับ Authentication (Student-only)
 *
 * Base path: /api/auth
 * - POST /register  สมัครสมาชิก
 * - POST /login     เข้าสู่ระบบ
 * - GET  /me        ดึงข้อมูลผู้ใช้ (ต้องมี token)
 */
import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authGuard } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authGuard, authController.me);

export default router;
