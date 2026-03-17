import { Router } from "express";
import multer from "multer";
import { authGuard } from "../middlewares/auth.middleware";
import * as c from "../controllers/uploads.controller";

const router = Router();

// เก็บไฟล์ใน memory แล้วส่งเข้า controller ไปเก็บ DB
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/uploads/profile-image
router.post("/profile-image", authGuard, upload.single("file"), c.uploadProfileImage);

// GET /api/uploads/:id
router.get("/:id", c.getFileById);

export default router;
